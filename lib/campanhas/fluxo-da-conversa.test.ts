// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { PASSO_NOVO_DO_FLUXO } from "@/lib/cadencia/fluxo-da-abordagem";

vi.mock("ai", () => ({
  generateText: vi.fn(async () => ({ text: '"Que bom, Ana! Qual o melhor horário?"' })),
}));
vi.mock("@/lib/ai/cerebro-da-organizacao", () => ({
  cerebroDaOrganizacao: vi.fn(async () => ({ provider: "anthropic", model: "m", apiKey: "k" })),
}));
vi.mock("@/lib/ai/runtime/agent", () => ({ buildModel: vi.fn(() => ({})) }));
const tarefa = vi.hoisted(() =>
  vi.fn(async () => ({ ok: true, tarefa_id: "t1", assigned_to: "u1" })),
);
vi.mock("@/lib/tarefas/criar-tarefa", () => ({ criarTarefaInterna: tarefa }));
const envio = vi.hoisted(() => ({
  enviar: vi.fn(async (..._a: unknown[]) => ({ id: "m1", status: "sent" })),
}));
vi.mock("@/app/api/v1/messages/_handler", () => ({ sendMessageHandler: envio.enviar }));
vi.mock("@/lib/atendimento/origem", () => ({
  beginServiceAtOrigin: vi.fn(async () => ({ conversation_id: "cv9" })),
}));

import {
  continuarFluxoAoResponder,
  enviarProposta,
  iniciarFluxoAposAbertura,
} from "./fluxo-da-conversa";

const ia = { ...PASSO_NOVO_DO_FLUXO("mensagem"), ai_personalize: true };
const fixa = { ...PASSO_NOVO_DO_FLUXO("mensagem"), body: "Oi {{primeiro_nome}}, tudo bem?" };
const abertura = { ...PASSO_NOVO_DO_FLUXO("mensagem"), body: "Olá" };

interface Cfg {
  passos: unknown[];
  recebe?: Record<string, unknown>[];
  bloqueado?: boolean;
  fluxo?: string | null;
  passo?: number;
  proposta?: { kind: "mensagem" | "audio"; body: string };
  audioNaBiblioteca?: boolean;
}

function fake(cfg: Cfg) {
  const updates: Array<Record<string, unknown>> = [];
  const from = (tabela: string) => {
    const c: Record<string, unknown> = {};
    let atualizando = false;
    for (const m of ["select", "eq", "in", "is", "not", "order", "gte"]) c[m] = () => c;
    c.limit = () => c;
    c.update = (patch: Record<string, unknown>) => {
      if (tabela === "campaign_recipients") updates.push(patch);
      atualizando = true;
      return c;
    };
    c.maybeSingle = async () => ({
      data:
        tabela === "campaign_recipients"
          ? {
              id: "r1",
              organization_id: "o1",
              campaign_id: "c1",
              contact_id: "ct1",
              conversation_id: "cv1",
              channel_session_id: "s1",
              rendered_body: "Olá Ana",
              sent_at: "2026-10-25T10:00:00Z",
              flow_state:
                cfg.fluxo === undefined
                  ? cfg.proposta
                    ? "proposta_pendente"
                    : "aguardando_resposta"
                  : cfg.fluxo,
              flow_step: cfg.passo ?? 1,
              flow_wait_until: null,
              proposal_kind: cfg.proposta?.kind ?? null,
              proposal_body: cfg.proposta?.body ?? null,
              proposal_ai: false,
            }
          : tabela === "campaigns"
            ? { id: "c1", name: "Disparo", approach_id: "ab1", demand_campaign_id: "dc1" }
            : tabela === "contacts"
              ? { name: "Ana Souza", display_name: null, is_blocked: Boolean(cfg.bloqueado) }
              : tabela === "demand_campaign_approaches"
                ? { id: "ab1", name: "Cold", script: "", central_idea: "agenda cheia" }
                : tabela === "approach_audios"
                  ? cfg.audioNaBiblioteca
                    ? { storage_path: "o1/audios-da-abordagem/a1.ogg", mime: "audio/ogg" }
                    : null
                  : tabela === "crm_leads"
                    ? { id: "l1" }
                    : null,
    });
    c.then = (ok: (v: unknown) => void) => {
      if (tabela === "demand_approach_steps") return ok({ data: cfg.passos });
      if (tabela === "campaign_recipients" && !atualizando)
        return ok({
          data: cfg.recebe ?? [
            { id: "r1", flow_step: cfg.passo ?? 1, sent_at: "2026-10-25T10:00:00Z" },
          ],
        });
      if (tabela === "messages") return ok({ data: [{ body: "Tenho interesse" }] });
      return ok({ data: [{ id: "r1" }], error: null });
    };
    return c;
  };
  const copias: Array<[string, string]> = [];
  const storage = {
    from: () => ({
      copy: async (de: string, para: string) => {
        copias.push([de, para]);
        return { error: null };
      },
    }),
  };
  return { admin: { from, storage } as never, updates, copias };
}

const resposta = {
  organizationId: "o1",
  contactId: "ct1",
  recebidoEm: new Date("2026-10-25T11:00:00Z"),
};

describe("iniciarFluxoAposAbertura", () => {
  it("abordagem só com a abertura não liga o fluxo", async () => {
    const f = fake({ passos: [abertura], fluxo: null });
    await iniciarFluxoAposAbertura(f.admin, { organizationId: "o1", recipientId: "r1" });
    expect(f.updates).toHaveLength(0);
  });

  it("depois da abertura, uma espera deixa o destinatário aguardando a resposta com prazo", async () => {
    const f = fake({ passos: [abertura, PASSO_NOVO_DO_FLUXO("aguardar"), fixa], fluxo: null });
    await iniciarFluxoAposAbertura(f.admin, {
      organizationId: "o1",
      recipientId: "r1",
      agora: new Date("2026-10-25T10:00:00Z"),
    });
    const ultima = f.updates[f.updates.length - 1]!;
    expect(ultima).toMatchObject({ flow_state: "aguardando_resposta", flow_step: 1 });
    expect(ultima.flow_wait_until).toBe("2026-10-27T10:00:00.000Z");
  });
});

describe("continuarFluxoAoResponder", () => {
  it("o passo de mensagem com texto fixo vira proposta com o nome do lead — nada é enviado", async () => {
    const f = fake({ passos: [abertura, PASSO_NOVO_DO_FLUXO("aguardar"), fixa] });
    expect(await continuarFluxoAoResponder(f.admin, resposta)).toBe(1);
    expect(f.updates[f.updates.length - 1]).toMatchObject({
      flow_state: "proposta_pendente",
      flow_step: 2,
      proposal_kind: "mensagem",
      proposal_body: "Oi Ana, tudo bem?",
      proposal_ai: false,
    });
  });

  it("o passo da IA escreve a proposta a partir da resposta do lead", async () => {
    const f = fake({ passos: [abertura, PASSO_NOVO_DO_FLUXO("aguardar"), ia] });
    await continuarFluxoAoResponder(f.admin, resposta);
    expect(f.updates[f.updates.length - 1]).toMatchObject({
      flow_state: "proposta_pendente",
      proposal_body: "Que bom, Ana! Qual o melhor horário?",
      proposal_ai: true,
    });
  });

  it("áudio vira proposta de áudio, sem envio", async () => {
    const a = { ...PASSO_NOVO_DO_FLUXO("audio"), audio_label: "Apresentação" };
    const f = fake({ passos: [abertura, PASSO_NOVO_DO_FLUXO("aguardar"), a] });
    await continuarFluxoAoResponder(f.admin, resposta);
    expect(f.updates[f.updates.length - 1]).toMatchObject({
      proposal_kind: "audio",
      proposal_body: "Apresentação",
    });
  });

  it("encaminhar cria a tarefa do dono e marca o fluxo como encaminhado", async () => {
    tarefa.mockClear();
    const f = fake({
      passos: [abertura, PASSO_NOVO_DO_FLUXO("aguardar"), PASSO_NOVO_DO_FLUXO("encaminhar")],
    });
    await continuarFluxoAoResponder(f.admin, resposta);
    expect(f.updates[f.updates.length - 1]).toMatchObject({ flow_state: "encaminhado" });
    expect(tarefa).toHaveBeenCalledTimes(1);
  });

  it("fim do desenho conclui o fluxo", async () => {
    const f = fake({ passos: [abertura, PASSO_NOVO_DO_FLUXO("aguardar")] });
    await continuarFluxoAoResponder(f.admin, resposta);
    expect(f.updates[f.updates.length - 1]).toMatchObject({ flow_state: "concluido" });
  });

  it("contato bloqueado (pediu para parar) encerra o fluxo e não propõe nada", async () => {
    const f = fake({ passos: [abertura, PASSO_NOVO_DO_FLUXO("aguardar"), fixa], bloqueado: true });
    await continuarFluxoAoResponder(f.admin, resposta);
    expect(f.updates[f.updates.length - 1]).toMatchObject({
      flow_state: "parado",
      flow_stop_reason: "opt_out",
    });
  });

  it("resposta anterior ao envio não anda o fluxo", async () => {
    const f = fake({ passos: [abertura, PASSO_NOVO_DO_FLUXO("aguardar"), fixa] });
    const antes = { ...resposta, recebidoEm: new Date("2026-10-25T09:00:00Z") };
    expect(await continuarFluxoAoResponder(f.admin, antes)).toBe(0);
    expect(f.updates).toHaveLength(0);
  });
});

describe("enviarProposta — áudio gravado", () => {
  const audioDoFluxo = {
    ...PASSO_NOVO_DO_FLUXO("audio"),
    audio_label: "Apresentação",
    audio_id: "a1",
  };
  const aprovar = (f: ReturnType<typeof fake>) =>
    enviarProposta(f.admin, { organizationId: "o1", campaignId: "c1", recipientId: "r1" });

  it("copia o arquivo da biblioteca para a pasta da conversa e envia como áudio", async () => {
    envio.enviar.mockClear();
    const f = fake({
      passos: [abertura, PASSO_NOVO_DO_FLUXO("aguardar"), audioDoFluxo],
      proposta: { kind: "audio", body: "Apresentação" },
      passo: 2,
      audioNaBiblioteca: true,
    });
    expect(await aprovar(f)).toEqual({ ok: true });
    expect(f.copias).toHaveLength(1);
    expect(f.copias[0]![0]).toBe("o1/audios-da-abordagem/a1.ogg");
    expect(f.copias[0]![1]).toMatch(/^o1\/cv9\/[0-9a-f-]{36}\.ogg$/);
    const corpo = envio.enviar.mock.calls[0]![2] as Record<string, unknown>;
    expect(corpo).toMatchObject({ type: "audio", media_mime: "audio/ogg" });
    expect(corpo.media_storage_path).toBe(f.copias[0]![1]);
    expect(corpo).not.toHaveProperty("body");
  });

  it("passo de áudio sem arquivo na biblioteca não envia nada", async () => {
    envio.enviar.mockClear();
    const f = fake({
      passos: [abertura, PASSO_NOVO_DO_FLUXO("aguardar"), { ...audioDoFluxo, audio_id: null }],
      proposta: { kind: "audio", body: "Apresentação" },
      passo: 2,
    });
    const r = await aprovar(f);
    expect(r).toMatchObject({ ok: false, status: 422 });
    expect(envio.enviar).not.toHaveBeenCalled();
  });
});
