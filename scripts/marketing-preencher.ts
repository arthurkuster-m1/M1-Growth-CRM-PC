/**
 * Preenche o RASCUNHO de uma página de Marketing a partir de um arquivo JSON de blocos — o jeito
 * de a agência mandar os dados do cliente e a página já sair montada no sistema (revisão e
 * publicação continuam sendo da agência, pela tela).
 *
 *   npx tsx scripts/marketing-preencher.ts <id-da-empresa> <modulo> <blocos.json> [--modelo]
 *
 * `--modelo` ignora o JSON e grava o modelo padrão do módulo. Os blocos passam pelo MESMO
 * schema da tela (inválido = recusa, nada é gravado). Usa SUPABASE_DB_URL do .env.local.
 * Imagens: suba o arquivo para o bucket `marketing-images` em `<empresa>/<uuid>.<png|jpg>` e
 * use só `<uuid>.<png|jpg>` no campo `arquivo`.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { Client } from "pg";

import { blocosSchema } from "../lib/marketing/blocos";
import { modeloDoModulo } from "../lib/marketing/modelos";
import { moduloPorChave } from "../lib/marketing/modulos";

function urlDoBanco(): string {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const m = env.match(/^SUPABASE_DB_URL=(.*)$/m);
  if (!m) throw new Error("SUPABASE_DB_URL ausente no .env.local");
  return m[1]!.trim().replace(/^["']|["']$/g, "");
}

async function main() {
  const [org, modulo, arquivo, flag] = process.argv.slice(2);
  if (!org || !modulo || !moduloPorChave(modulo)) {
    throw new Error("Uso: marketing-preencher.ts <id-da-empresa> <modulo> <blocos.json|--modelo>");
  }
  const bruto =
    arquivo === "--modelo" || flag === "--modelo"
      ? modeloDoModulo(modulo, () => randomUUID().slice(0, 12))
      : JSON.parse(readFileSync(arquivo!, "utf8"));
  const blocos = blocosSchema.parse(bruto);

  const c = new Client({ connectionString: urlDoBanco() });
  await c.connect();
  try {
    await c.query("begin");
    const p = await c.query(
      `insert into public.marketing_pages (organization_id, module_key)
       values ($1, $2)
       on conflict (organization_id, module_key) do update set updated_at = now()
       returning id`,
      [org, modulo],
    );
    await c.query(
      `insert into public.marketing_page_drafts (page_id, organization_id, blocks)
       values ($1, $2, $3::jsonb)
       on conflict (page_id) do update set blocks = excluded.blocks, updated_at = now()`,
      [p.rows[0].id, org, JSON.stringify(blocos)],
    );
    await c.query("commit");
    console.log(
      `Rascunho de "${modulo}" gravado (${blocos.length} blocos). Revise e publique pela tela.`,
    );
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
