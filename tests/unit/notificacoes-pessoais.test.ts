/**
 * NOTIFICAÇÕES POR PESSOA (migration 0697) — quem recebe e o que aparece.
 *
 * As três regras que o dono do produto pediu, medidas contra um banco de mentira:
 *   1. só o responsável recebe (atendente não recebe a conversa/lead de outro);
 *   2. sem responsável, recebem gestores e administradores — nunca a empresa inteira;
 *   3. erro de sistema vai só para administradores, com o botão que leva ao conserto.
 * E o texto: nome + telefone, e sempre um botão para resolver.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { avisoDeLeadNovo, avisoDeMensagem, paraPush } from "@/lib/notifications/aviso-pessoal";
import { avisoDaLinha } from "@/lib/notifications/aviso-na-tela";
import {
  montarAvisoDaCentral,
  montarAvisoDeLeadAtribuido,
  montarAvisoDeLeadNovo,
  montarAvisoDeMensagem,
} from "@/lib/notifications/montar-avisos";

type Linha = Record<string, unknown>;

/** Banco mínimo: select + eq/in/is/order/limit/maybeSingle, sempre por organização. */
function banco(tabelas: Record<string, Linha[]>): SupabaseClient {
  function consulta(nome: string) {
    let linhas = [...(tabelas[nome] ?? [])];
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => ((linhas = linhas.filter((l) => l[c] === v)), q),
      in: (c: string, vs: unknown[]) => ((linhas = linhas.filter((l) => vs.includes(l[c]))), q),
      is: (c: string, v: unknown) => ((linhas = linhas.filter((l) => (l[c] ?? null) === v)), q),
      order: () => q,
      limit: (n: number) => ((linhas = linhas.slice(0, n)), q),
      maybeSingle: async () => ({ data: linhas[0] ?? null, error: null }),
      then: (ok: (r: { data: Linha[]; error: null }) => unknown) =>
        Promise.resolve(ok({ data: linhas, error: null })),
    };
    return q;
  }
  return {
    from: consulta,
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) },
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { user_metadata: { full_name: "Bruna Lima" } } },
        }),
      },
    },
  } as unknown as SupabaseClient;
}

const ORG = "org-1";
const membros = [
  { organization_id: ORG, user_id: "admin-1", role: "admin", revoked_at: null },
  { organization_id: ORG, user_id: "gestor-1", role: "manager", revoked_at: null },
  { organization_id: ORG, user_id: "atendente-1", role: "agent", revoked_at: null },
  { organization_id: ORG, user_id: "atendente-2", role: "agent", revoked_at: null },
  { organization_id: ORG, user_id: "saiu", role: "agent", revoked_at: "2026-01-01" },
];
const contato = {
  id: "ct-1",
  organization_id: ORG,
  name: "Maria Souza",
  display_name: null,
  phone_number: "5511988887777",
  is_personal: false,
};
const funil = [{ id: "fu-1", organization_id: ORG, name: "Vendas" }];
const etapas = [{ id: "et-1", organization_id: ORG, name: "Novo" }];

function mundo(extra: Partial<Record<string, Linha[]>> = {}) {
  return banco({
    user_organizations: membros,
    contacts: [contato],
    crm_pipelines: funil,
    crm_stages: etapas,
    conversations: [],
    crm_leads: [],
    ...extra,
  } as Record<string, Linha[]>);
}

function conversa(over: Linha = {}): Linha {
  return {
    id: "cv-1",
    organization_id: ORG,
    contact_id: "ct-1",
    assigned_to_user_id: null,
    is_group: false,
    status: "open",
    ...over,
  };
}
function lead(over: Linha = {}): Linha {
  return {
    id: "ld-1",
    organization_id: ORG,
    contact_id: "ct-1",
    owner_user_id: null,
    title: "Maria",
    pipeline_id: "fu-1",
    stage_id: "et-1",
    source: "whatsapp",
    status: "open",
    created_at: "2020-01-01T00:00:00Z",
    ...over,
  };
}
const msg = {
  conversation_id: "cv-1",
  contact_id: "ct-1",
  body_preview: "Quero saber o preço",
  type: "text",
};

describe("quem recebe a mensagem nova", () => {
  it("conversa atribuída → SÓ o atendente dela", async () => {
    const e = await montarAvisoDeMensagem(
      mundo({ conversations: [conversa({ assigned_to_user_id: "atendente-1" })] }),
      ORG,
      msg,
    );
    expect(e?.destinatarios).toEqual(["atendente-1"]);
  });

  it("conversa sem atendente, lead com dono → o dono do lead", async () => {
    const e = await montarAvisoDeMensagem(
      mundo({ conversations: [conversa()], crm_leads: [lead({ owner_user_id: "atendente-2" })] }),
      ORG,
      msg,
    );
    expect(e?.destinatarios).toEqual(["atendente-2"]);
  });

  it("ninguém responsável → gestores e administradores, nunca os atendentes", async () => {
    const e = await montarAvisoDeMensagem(mundo({ conversations: [conversa()] }), ORG, msg);
    expect(e?.destinatarios.sort()).toEqual(["admin-1", "gestor-1"]);
  });

  it("responsável que saiu da empresa não recebe — cai para a equipe", async () => {
    const e = await montarAvisoDeMensagem(
      mundo({ conversations: [conversa({ assigned_to_user_id: "saiu" })] }),
      ORG,
      msg,
    );
    expect(e?.destinatarios.sort()).toEqual(["admin-1", "gestor-1"]);
  });

  it("IA atendendo sem ninguém atribuído → não avisa (quem avisa é a passagem para pessoa)", async () => {
    const e = await montarAvisoDeMensagem(
      mundo({ conversations: [conversa({ status: "ai_handling" })] }),
      ORG,
      msg,
    );
    expect(e).toBeNull();
  });

  it("contato pessoal → ninguém é avisado", async () => {
    const db = banco({
      user_organizations: membros,
      conversations: [conversa()],
      contacts: [{ ...contato, is_personal: true }],
    });
    expect(await montarAvisoDeMensagem(db, ORG, msg)).toBeNull();
  });

  it("o aviso traz o nome, a mensagem e os botões Responder / Abrir no CRM", async () => {
    const e = await montarAvisoDeMensagem(
      mundo({ conversations: [conversa()], crm_leads: [lead()] }),
      ORG,
      msg,
    );
    expect(e?.aviso.titulo).toBe("Maria Souza");
    expect(e?.aviso.corpo).toBe("Quero saber o preço");
    expect(e?.aviso.acoes).toEqual([
      { rotulo: "Responder", href: "/app/inbox?id=cv-1" },
      { rotulo: "Abrir no CRM", href: "/app/leads/ld-1" },
    ]);
  });
});

describe("lead novo e lead atribuído", () => {
  it("lead novo sem dono → gestores; título com o nome, corpo com telefone e funil", async () => {
    const e = await montarAvisoDeLeadNovo(
      mundo({ crm_leads: [lead()], conversations: [conversa()] }),
      ORG,
      "ld-1",
      {},
    );
    expect(e?.destinatarios.sort()).toEqual(["admin-1", "gestor-1"]);
    expect(e?.aviso.titulo).toBe("Novo lead: Maria Souza");
    expect(e?.aviso.corpo).toContain("Vendas › Novo");
    expect(e?.aviso.corpo).toMatch(/98888/);
    expect(e?.aviso.acoes.map((a) => a.rotulo)).toEqual(["Abrir conversa", "Abrir no CRM"]);
  });

  it("lead novo com dono → só o dono", async () => {
    const e = await montarAvisoDeLeadNovo(
      mundo({ crm_leads: [lead({ owner_user_id: "atendente-1" })] }),
      ORG,
      "ld-1",
      {},
    );
    expect(e?.destinatarios).toEqual(["atendente-1"]);
  });

  it("importação de planilha não avisa (seriam centenas)", async () => {
    expect(
      await montarAvisoDeLeadNovo(mundo({ crm_leads: [lead()] }), ORG, "ld-1", { via: "planilha" }),
    ).toBeNull();
  });

  it("lead atribuído → só quem recebeu", async () => {
    const e = await montarAvisoDeLeadAtribuido(
      mundo({ crm_leads: [lead()] }),
      ORG,
      "ld-1",
      "atendente-2",
    );
    expect(e?.destinatarios).toEqual(["atendente-2"]);
    expect(e?.aviso.titulo).toBe("Lead atribuído a você: Maria Souza");
  });
});

describe("avisos da Central", () => {
  it("WhatsApp desconectado → só administradores, com o botão Reconectar", async () => {
    const db = mundo({
      agent_inbox_items: [
        {
          id: "av-1",
          organization_id: ORG,
          kind: "qr_rescan",
          severity: "critical",
          ref_kind: "channel_session",
          ref_id: "cs-1",
          title: 'WhatsApp "Comercial" desconectado',
          body: null,
        },
      ],
    });
    const e = await montarAvisoDaCentral(db, ORG, "av-1");
    expect(e?.destinatarios).toEqual(["admin-1"]);
    expect(e?.aviso.acoes[0]).toEqual({ rotulo: "Reconectar WhatsApp", href: "/app/connections" });
  });

  it("passagem para pessoa → o atendente da conversa, com o nome do cliente", async () => {
    const db = mundo({
      conversations: [conversa({ assigned_to_user_id: "atendente-1" })],
      agent_inbox_items: [
        {
          id: "av-2",
          organization_id: ORG,
          kind: "handoff",
          severity: "critical",
          ref_kind: "conversation",
          ref_id: "cv-1",
          title: "x",
          body: "y",
        },
      ],
    });
    const e = await montarAvisoDaCentral(db, ORG, "av-2");
    expect(e?.destinatarios).toEqual(["atendente-1"]);
    expect(e?.aviso.titulo).toBe("Maria Souza precisa de atendimento");
    expect(e?.aviso.acoes[0]).toEqual({ rotulo: "Assumir conversa", href: "/app/inbox?id=cv-1" });
  });

  it("aviso técnico (evento morto) fica só na Central", async () => {
    const db = mundo({
      agent_inbox_items: [
        {
          id: "av-3",
          organization_id: ORG,
          kind: "event_dead",
          severity: "critical",
          ref_kind: null,
          ref_id: null,
          title: "x",
          body: null,
        },
      ],
    });
    expect(await montarAvisoDaCentral(db, ORG, "av-3")).toBeNull();
  });
});

describe("texto, botões e tela", () => {
  it("mensagem de lead recém-nascido anuncia o lead novo com nome e telefone", () => {
    const a = avisoDeMensagem({
      pessoa: { nome: "Maria Souza", telefone: "(11) 98888-7777" },
      preview: "oi",
      midia: false,
      conversaId: "cv-1",
      leadId: "ld-1",
      leadNovo: true,
    });
    expect(a.titulo).toBe("Novo lead: Maria Souza · (11) 98888-7777");
  });

  it("o push leva os mesmos botões e o toque abre o primeiro", () => {
    const a = avisoDeLeadNovo({
      pessoa: { nome: "Ana", telefone: "" },
      leadId: "ld-9",
      contatoId: "ct-9",
      conversaId: null,
      funil: null,
      etapa: null,
      origem: null,
    });
    const p = paraPush(a);
    expect(p.href).toBe("/app/leads/ld-9");
    expect(p.acoes).toEqual([
      { rotulo: "Abrir no CRM", href: "/app/leads/ld-9" },
      { rotulo: "Ver contato", href: "/app/contacts/ct-9" },
    ]);
  });

  it("a tela não repete o aviso da conversa que a pessoa já está lendo, nem o de outra empresa", () => {
    const linha = {
      organization_id: ORG,
      categoria: "mensagem",
      titulo: "Maria",
      corpo: "oi",
      tag: "conversa:cv-1",
      acoes: [],
    };
    expect(avisoDaLinha(linha, { organizacaoAtiva: ORG, conversaAbertaEmFoco: "cv-1" })).toBeNull();
    expect(
      avisoDaLinha(linha, { organizacaoAtiva: "outra", conversaAbertaEmFoco: null }),
    ).toBeNull();
    expect(
      avisoDaLinha(linha, { organizacaoAtiva: ORG, conversaAbertaEmFoco: null })?.category,
    ).toBe("message");
  });

  it("botão com link para fora do CRM é descartado", () => {
    const linha = {
      organization_id: ORG,
      categoria: "sistema",
      titulo: "x",
      corpo: "",
      acoes: [
        { rotulo: "Mal", href: "https://fora.com" },
        { rotulo: "Bom", href: "/app/connections" },
      ],
    };
    expect(
      avisoDaLinha(linha, { organizacaoAtiva: ORG, conversaAbertaEmFoco: null })?.acoes,
    ).toEqual([{ rotulo: "Bom", href: "/app/connections" }]);
  });
});
