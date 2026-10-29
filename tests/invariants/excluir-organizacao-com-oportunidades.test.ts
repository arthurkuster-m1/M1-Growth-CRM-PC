import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

const pool = new pg.Pool({
  connectionString: `postgresql://postgres:postgres@127.0.0.1:${process.env.TEST_DB_PORT ?? 54329}/postgres`,
});
afterAll(() => pool.end());

/**
 * EXCLUIR UMA ORGANIZAÇÃO COM OPORTUNIDADES FUNCIONA.
 *
 * Apagar a organização apaga em cascata as oportunidades; o gatilho de cada uma recalculava o ciclo
 * de vida do contato e gravava `crm_historico_de_estados` apontando para a organização que já não
 * existia — violação de FK, e a exclusão inteira falhava (visto no `afterAll` de
 * `nascimento-do-lead.test.ts`). A 0679 faz o recálculo sair quando a organização não existe mais.
 */
describe("excluir a organização leva as oportunidades junto, sem violar a trilha de estados", () => {
  it("delete from organizations com contato e oportunidade abertos termina e não deixa rastro", async () => {
    const org = randomUUID();
    await pool.query(
      "insert into organizations (id, slug, legal_name, display_name) values ($1::uuid, $1::text, 'Excluir org', 'Excluir org')",
      [org],
    );
    const { rows: c } = await pool.query<{ id: string }>(
      "insert into contacts (organization_id, display_name, source) values ($1, 'Fulano', 'whatsapp') returning id",
      [org],
    );
    await pool.query(
      `insert into crm_leads (organization_id, pipeline_id, stage_id, contact_id, title)
       select p.organization_id, p.id,
              (select id from crm_stages where pipeline_id = p.id order by position limit 1), $2, 'L'
         from crm_pipelines p where p.organization_id = $1`,
      [org, c[0]!.id],
    );
    await expect(pool.query("delete from organizations where id = $1", [org])).resolves.toBeDefined();
    const { rows } = await pool.query<{ n: string }>(
      "select (select count(*) from contacts where organization_id = $1)::text || '|' || (select count(*) from crm_historico_de_estados where organization_id = $1)::text as n",
      [org],
    );
    expect(rows[0]!.n).toBe("0|0");
  });
});
