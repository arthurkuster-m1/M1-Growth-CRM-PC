import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import { lastLine, sql } from "./gov-helpers";

/**
 * Excluir e restaurar cliente COMO USUÁRIO LOGADO (migration 0696).
 *
 * O bug que este arquivo existe para pegar: a 0644 pôs `fn_excluir_cliente_para_lixeira` e
 * `fn_restaurar_cliente_da_lixeira` como security INVOKER chamando três funções internas; a 0679
 * tirou o EXECUTE de `authenticated` dessas três, achando que quem as chama roda como dono. Não
 * roda: o usuário logado recebia "permission denied for function fn_historico_apagar_do_contato"
 * ao apagar lead/cliente e ao restaurar. O gate antigo só olhava a EXISTÊNCIA da função — nenhum
 * teste percorria o caminho inteiro (excluir + restaurar) com o papel `authenticated`.
 *
 * Aqui o caminho é percorrido de ponta a ponta, com claims de JWT simulados (a mesma via
 * `auth.uid()` → `fn_user_org_ids()` de produção), e a porta fechada da 0679 é provada com
 * `has_function_privilege`: as três internas NÃO podem ser executáveis por authenticated nem anon.
 */

const ORG_A = "dddddddd-0000-4000-8000-00000000000a";
const ORG_B = "dddddddd-0000-4000-8000-00000000000b";
const AGENTE_A = "dddddddd-1111-4000-8000-00000000000a";
const VIEWER_A = "dddddddd-1111-4000-8000-0000000000a1";
const ADMIN_B = "dddddddd-1111-4000-8000-00000000000b";
const SESSAO_A = "dddddddd-2222-4000-8000-00000000000a";
const PIPE_A = "dddddddd-5555-4000-8000-00000000000a";
const ETAPA_1 = "dddddddd-5555-4000-8000-0000000000a1";
const ETAPA_2 = "dddddddd-5555-4000-8000-0000000000a2";
const CONTATO = "dddddddd-3333-4000-8000-00000000000a";
const LEAD = "dddddddd-6666-4000-8000-00000000000a";

const INTERNAS = [
  "public.fn_historico_apagar_do_contato(uuid, uuid)",
  "public.fn_historico_inserir_da_lixeira(uuid, jsonb)",
  "public.fn_recalcula_cliente_restaurado(uuid, uuid)",
] as const;
const PUBLICAS = [
  "public.fn_excluir_cliente_para_lixeira(uuid, uuid)",
  "public.fn_restaurar_cliente_da_lixeira(uuid, uuid)",
] as const;

/** Roda como `authenticated` com o JWT do usuário (ou sem `sub`, para o "ninguém logado"). */
function como(usuario: string | null, script: string): string {
  return sql(`
    \\set VERBOSITY verbose
    set role authenticated;
    select set_config('request.jwt.claims', '${usuario ? `{"sub":"${usuario}"}` : "{}"}', false);
    ${script}
  `);
}

const contagens = (): string =>
  sql(`select
    (select count(*) from public.contacts where id = '${CONTATO}') || '|' ||
    (select count(*) from public.crm_leads where contact_id = '${CONTATO}') || '|' ||
    (select count(*) from public.crm_tasks where contact_id = '${CONTATO}') || '|' ||
    (select count(*) from public.conversations where contact_id = '${CONTATO}') || '|' ||
    (select count(*) from public.messages where contact_id = '${CONTATO}') || '|' ||
    (select count(*) from public.crm_historico_de_estados where contact_id = '${CONTATO}') || '|' ||
    (select count(*) from public.crm_lixeira where contact_id = '${CONTATO}');`);

/** O retrato do cliente semeado (contato|lead|tarefa|conversa|mensagem|histórico|lixeira), tirado no beforeAll. */
let BASE = "";

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${AGENTE_A}', 'lixeira-agente@invariant.test'),
      ('${VIEWER_A}', 'lixeira-viewer@invariant.test'),
      ('${ADMIN_B}', 'lixeira-admin-b@invariant.test') on conflict do nothing;
    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG_A}', 'lixeira-inv-a', 'Lixeira A', 'Lixeira A'),
      ('${ORG_B}', 'lixeira-inv-b', 'Lixeira B', 'Lixeira B') on conflict do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${AGENTE_A}', '${ORG_A}', 'agent', now()),
      ('${VIEWER_A}', '${ORG_A}', 'viewer', now()),
      ('${ADMIN_B}', '${ORG_B}', 'admin', now()) on conflict do nothing;
    insert into public.channel_sessions (id, organization_id, waha_session_name, webhook_secret_encrypted)
      values ('${SESSAO_A}', '${ORG_A}', 'lixeira-inv-a', '\\x00'::bytea) on conflict do nothing;
    insert into public.crm_pipelines (id, organization_id, name, slug)
      values ('${PIPE_A}', '${ORG_A}', 'Funil', 'funil-lixeira') on conflict do nothing;
    insert into public.crm_stages (id, organization_id, pipeline_id, name, slug, position) values
      ('${ETAPA_1}', '${ORG_A}', '${PIPE_A}', 'Novo', 'novo', 1),
      ('${ETAPA_2}', '${ORG_A}', '${PIPE_A}', 'Contato', 'contato', 2) on conflict do nothing;
    insert into public.contacts (id, organization_id, display_name, phone_number)
      values ('${CONTATO}', '${ORG_A}', 'Cliente Lixeira', '+5511999990077') on conflict do nothing;
    insert into public.crm_leads (id, organization_id, pipeline_id, stage_id, title, contact_id)
      values ('${LEAD}', '${ORG_A}', '${PIPE_A}', '${ETAPA_1}', 'Lead da lixeira', '${CONTATO}') on conflict do nothing;
    -- Muda de etapa: o gatilho grava o histórico de estados (o que a exclusão precisa apagar).
    update public.crm_leads set stage_id = '${ETAPA_2}' where id = '${LEAD}';
    insert into public.crm_tasks (organization_id, title, contact_id, lead_id)
      values ('${ORG_A}', 'Tarefa da lixeira', '${CONTATO}', '${LEAD}');
    insert into public.conversations (organization_id, contact_id, channel_session_id)
      values ('${ORG_A}', '${CONTATO}', '${SESSAO_A}');
    insert into public.messages (organization_id, conversation_id, channel_session_id, contact_id, type, direction, body)
      select '${ORG_A}', c.id, '${SESSAO_A}', '${CONTATO}', 'text', 'inbound', 'oi da lixeira'
        from public.conversations c where c.contact_id = '${CONTATO}';
  `);
  BASE = contagens();
  // Sem histórico de estados semeado o teste não provaria o que importa (o que a 0679 fechou).
  if (!/^1\|1\|1\|1\|1\|[1-9]\d*\|0$/.test(BASE)) throw new Error(`seed inesperado: ${BASE}`);
});

describe("lixeira de clientes (0696): privilégios", () => {
  it("as 3 internas NÃO são executáveis por authenticated, anon nem public; as 2 públicas só por logado", () => {
    for (const fn of INTERNAS) {
      expect(
        sql(
          `select has_function_privilege('authenticated','${fn}','execute') || '|' ||
                  has_function_privilege('anon','${fn}','execute') || '|' ||
                  has_function_privilege('public','${fn}','execute');`,
        ),
        fn,
      ).toBe("false|false|false");
    }
    for (const fn of PUBLICAS) {
      expect(
        sql(
          `select has_function_privilege('authenticated','${fn}','execute') || '|' ||
                  has_function_privilege('anon','${fn}','execute');`,
        ),
        fn,
      ).toBe("true|false");
    }
  });

  it("as 2 públicas são security definer com search_path fixo; as 3 internas continuam definer", () => {
    for (const fn of [...PUBLICAS, ...INTERNAS]) {
      expect(
        sql(
          `select prosecdef::text || '|' || (coalesce(proconfig, '{}')::text like '%search_path=public, pg_temp%')::text
             from pg_proc where oid = '${fn}'::regprocedure;`,
        ),
        fn,
      ).toBe("true|true");
    }
  });

  it("o usuário não chama uma interna direto", () => {
    expect(() =>
      como(AGENTE_A, `select public.fn_historico_apagar_do_contato('${ORG_A}', '${CONTATO}');`),
    ).toThrow(/permission denied for function fn_historico_apagar_do_contato/);
    expect(() =>
      como(AGENTE_A, `select public.fn_recalcula_cliente_restaurado('${ORG_A}', '${CONTATO}');`),
    ).toThrow(/permission denied for function fn_recalcula_cliente_restaurado/);
  });

  it("anon não chama nem excluir nem restaurar", () => {
    expect(() =>
      sql(
        `set role anon; select public.fn_excluir_cliente_para_lixeira('${CONTATO}', '${ORG_A}');`,
      ),
    ).toThrow(/permission denied for function fn_excluir_cliente_para_lixeira/);
    expect(() =>
      sql(
        `set role anon; select public.fn_restaurar_cliente_da_lixeira('${CONTATO}', '${ORG_A}');`,
      ),
    ).toThrow(/permission denied for function fn_restaurar_cliente_da_lixeira/);
  });
});

describe("lixeira de clientes (0696): quem NÃO pode", () => {
  it("viewer da própria empresa recebe 42501 (papel insuficiente)", () => {
    expect(() =>
      como(VIEWER_A, `select public.fn_excluir_cliente_para_lixeira('${CONTATO}', '${ORG_A}');`),
    ).toThrow(/42501/);
    expect(() =>
      como(VIEWER_A, `select public.fn_restaurar_cliente_da_lixeira('${CONTATO}', '${ORG_A}');`),
    ).toThrow(/42501/);
  });

  it("admin de OUTRA empresa recebe 42501 ao apontar para a empresa A", () => {
    expect(() =>
      como(ADMIN_B, `select public.fn_excluir_cliente_para_lixeira('${CONTATO}', '${ORG_A}');`),
    ).toThrow(/42501/);
    expect(() =>
      como(ADMIN_B, `select public.fn_restaurar_cliente_da_lixeira('${CONTATO}', '${ORG_A}');`),
    ).toThrow(/42501/);
  });

  it("apontando para a PRÓPRIA empresa, o contato de outra empresa não é tocado (devolve falso/nulo)", () => {
    expect(
      lastLine(
        como(ADMIN_B, `select public.fn_excluir_cliente_para_lixeira('${CONTATO}', '${ORG_B}');`),
      ),
    ).toBe("f");
    expect(
      lastLine(
        como(
          ADMIN_B,
          `select coalesce(public.fn_restaurar_cliente_da_lixeira('${CONTATO}', '${ORG_B}')::text, 'nulo');`,
        ),
      ),
    ).toBe("nulo");
    expect(contagens()).toBe(BASE);
  });

  it("sem usuário logado (auth.uid() nulo) recebe 42501", () => {
    expect(() =>
      como(null, `select public.fn_excluir_cliente_para_lixeira('${CONTATO}', '${ORG_A}');`),
    ).toThrow(/42501/);
    expect(() =>
      como(null, `select public.fn_restaurar_cliente_da_lixeira('${CONTATO}', '${ORG_A}');`),
    ).toThrow(/42501/);
    expect(contagens()).toBe(BASE);
  });
});

describe("lixeira de clientes (0696): o caminho completo, como authenticated", () => {
  it("excluir leva tudo para crm_lixeira e restaurar devolve tudo", () => {
    const antes = BASE;

    // EXCLUIR (agente da empresa A)
    expect(
      lastLine(
        como(AGENTE_A, `select public.fn_excluir_cliente_para_lixeira('${CONTATO}', '${ORG_A}');`),
      ),
    ).toBe("t");
    // contato, lead, tarefa, conversa, mensagem e histórico saíram; 1 item na lixeira, por quem excluiu
    expect(contagens()).toBe("0|0|0|0|0|0|1");
    expect(
      sql(`select (excluido_por = '${AGENTE_A}')::text || '|' || (resumo ->> 'oportunidades') || '|' || (resumo ->> 'mensagens')
             from public.crm_lixeira where contact_id = '${CONTATO}';`),
    ).toBe("true|1|1");

    // RESTAURAR (o mesmo agente)
    expect(
      lastLine(
        como(
          AGENTE_A,
          `select public.fn_restaurar_cliente_da_lixeira(l.id, l.organization_id)
             from public.crm_lixeira l where l.contact_id = '${CONTATO}';`,
        ),
      ),
    ).toBe(CONTATO);
    // tudo voltou, inclusive o histórico de estados; a lixeira esvaziou
    expect(contagens()).toBe(antes);
    expect(
      sql(
        `select count(*) from public.crm_leads where id = '${LEAD}' and stage_id = '${ETAPA_2}';`,
      ),
    ).toBe("1");
  });

  it("excluir e restaurar de novo (a lixeira não fica presa a um ciclo só)", () => {
    expect(
      lastLine(
        como(AGENTE_A, `select public.fn_excluir_cliente_para_lixeira('${CONTATO}', '${ORG_A}');`),
      ),
    ).toBe("t");
    expect(contagens()).toBe("0|0|0|0|0|0|1");
    como(
      AGENTE_A,
      `select public.fn_restaurar_cliente_da_lixeira(l.id, l.organization_id)
         from public.crm_lixeira l where l.contact_id = '${CONTATO}';`,
    );
    expect(contagens()).toBe(BASE);
  });
});

describe("lixeira de clientes (0696): a cópia da lixeira não vira porta para outra empresa", () => {
  it("snapshot forjado com linha de OUTRA empresa é recusado (42501) e nada é gravado", () => {
    // O usuário pode inserir na própria lixeira (RLS) e a restauração roda como dono: por isso a
    // função confere que TODA linha do snapshot é da empresa de quem restaura.
    const forjado = `
      insert into public.crm_lixeira (id, organization_id, contact_id, nome, snapshot)
      values ('dddddddd-9999-4000-8000-000000000001', '${ORG_A}', 'dddddddd-3333-4000-8000-0000000000ff', 'Forjado',
        jsonb_build_object(
          'contato', jsonb_build_object('id', 'dddddddd-3333-4000-8000-0000000000ff', 'organization_id', '${ORG_A}'),
          'conversas', '[]'::jsonb, 'oportunidades', '[]'::jsonb, 'itens', '[]'::jsonb, 'parcelas', '[]'::jsonb,
          'compromissos', '[]'::jsonb, 'tarefas', '[]'::jsonb, 'notas', '[]'::jsonb, 'atividades', '[]'::jsonb,
          'historico', '[]'::jsonb,
          'mensagens', jsonb_build_array(jsonb_build_object(
            'id', 'dddddddd-9999-4000-8000-000000000002', 'organization_id', '${ORG_B}'))));
    `;
    como(AGENTE_A, forjado);
    expect(() =>
      como(
        AGENTE_A,
        `select public.fn_restaurar_cliente_da_lixeira('dddddddd-9999-4000-8000-000000000001', '${ORG_A}');`,
      ),
    ).toThrow(/42501/);
    expect(
      sql(`select (select count(*) from public.messages where id = 'dddddddd-9999-4000-8000-000000000002') || '|' ||
                  (select count(*) from public.contacts where id = 'dddddddd-3333-4000-8000-0000000000ff');`),
    ).toBe("0|0");
  });
});

describe("lixeira de clientes (0696): migração e baseline dizem o mesmo", () => {
  it("o apêndice do baseline repete o corpo da migration (instalação nova não diverge)", () => {
    const migration = readFileSync(
      "supabase/migrations/20261117120000_0696_lixeira_cliente_security_definer.sql",
      "utf8",
    );
    const corpo = migration.split("\n").slice(2).join("\n").trim();
    expect(readFileSync("supabase/baseline.sql", "utf8")).toContain(corpo);
  });
});
