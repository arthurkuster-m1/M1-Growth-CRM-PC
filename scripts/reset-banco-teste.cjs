/**
 * Limpa o banco de TESTE do M1 Growth CRM e reinstala o schema do zero.
 *
 * APAGA: todos os usuarios do Auth e todas as tabelas/dados do schema public.
 * NAO APAGA: os arquivos ja enviados ao Storage (o Supabase nao permite por SQL).
 *
 * Uso (na raiz do projeto):
 *   node scripts/reset-banco-teste.cjs --sim-apagar
 *
 * Sem a flag --sim-apagar ele so mostra o que faria e sai.
 * Le a conexao de SUPABASE_DB_URL no .env.local.
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const raiz = path.resolve(__dirname, "..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(raiz, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

if (!env.SUPABASE_DB_URL) {
  console.error("SUPABASE_DB_URL esta vazio no .env.local");
  process.exit(1);
}

(async () => {
  const c = new Client({
    connectionString: env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const host = new URL(env.SUPABASE_DB_URL).username; // postgres.<ref do projeto>
  const antes = await c.query(
    "select (select count(*) from information_schema.tables where table_schema='public')::int tabelas, (select count(*) from auth.users)::int usuarios",
  );
  console.log(`Banco: ${host}`);
  console.log(`Hoje tem: ${antes.rows[0].tabelas} tabelas e ${antes.rows[0].usuarios} usuario(s).`);

  if (!process.argv.includes("--sim-apagar")) {
    console.log("\nNADA FOI ALTERADO. Para apagar de verdade, rode:");
    console.log("  node scripts/reset-banco-teste.cjs --sim-apagar");
    await c.end();
    return;
  }

  await c.query("set statement_timeout=0");

  console.log("1/5 apagando usuarios do Auth...");
  const d = await c.query("delete from auth.users");
  console.log("    usuarios removidos:", d.rowCount);

  console.log("2/5 recriando o schema public (apaga as tabelas do sistema)...");
  await c.query(`
    drop schema if exists private cascade;
    drop schema public cascade;
    create schema public;
    grant usage on schema public to postgres, anon, authenticated, service_role;
    grant create on schema public to postgres, service_role;
    alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
  `);

  console.log("3/5 instalando extensoes (vector, citext, pg_trgm)...");
  await c.query(
    "create extension if not exists vector with schema public; create extension if not exists citext with schema public; create extension if not exists pg_trgm with schema public;",
  );

  console.log("4/5 aplicando supabase/baseline.sql (2,4 MB, pode levar 1-2 min)...");
  const sql = fs.readFileSync(path.join(raiz, "supabase", "baseline.sql"), "utf8");
  try {
    await c.query(sql);
    console.log("    baseline aplicado sem erros");
  } catch (e) {
    console.error("    ERRO NO BASELINE:", e.message, "| onde:", e.where || "", "| detalhe:", e.detail || "");
    process.exit(2);
  }

  console.log("5/5 conferindo...");
  const t = await c.query("select count(*)::int n from information_schema.tables where table_schema='public'");
  const f = await c.query(
    "select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'",
  );
  const o = await c.query(
    "select (select count(*) from public.organizations)::int org, (select count(*) from public.contacts)::int ct, (select count(*) from auth.users)::int us",
  );
  console.log(
    `    tabelas: ${t.rows[0].n} | funcoes: ${f.rows[0].n} | organizacoes: ${o.rows[0].org} | contatos: ${o.rows[0].ct} | usuarios: ${o.rows[0].us}`,
  );
  console.log("\nPRONTO. Banco limpo e com o schema novo.");
  await c.end();
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
