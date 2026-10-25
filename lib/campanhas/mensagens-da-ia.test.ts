// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PASSO_NOVO_DO_FLUXO } from "@/lib/cadencia/fluxo-da-abordagem";

const geracao = vi.hoisted(() => ({ falharPara: new Set<string>() }));

vi.mock("ai", () => ({
  generateText: vi.fn(async (a: { prompt: string }) => {
    for (const nome of geracao.falharPara)
      if (a.prompt.includes(nome)) throw new Error("fornecedor fora do ar");
    return {
      text: '"Oi! Posso te contar uma ideia?"',
      usage: { inputTokens: 100, outputTokens: 20 },
    };
  }),
}));
vi.mock("@/lib/ai/cerebro-da-organizacao", () => ({
  cerebroDaOrganizacao: vi.fn(async () => ({
    provider: "anthropic",
    model: "claude-x",
    apiKey: "k",
  })),
}));
vi.mock("@/lib/ai/runtime/agent", () => ({ buildModel: vi.fn(() => ({})) }));
vi.mock("@/lib/ai/cost", () => ({ computeCost: vi.fn(async () => 0.5) }));

import {
  aprovarMensagensDaIA,
  editarMensagemDaIA,
  gerarMensagensDaIA,
  recusaPorMensagensDaIA,
  type DisparoComIA,
} from "./mensagens-da-ia";

const disparo: DisparoComIA = {
  id: "d1",
  organization_id: "o1",
  approach_id: "ab1",
  demand_campaign_id: "dc1",
  ai_approved_at: null,
};
const ia = { ...PASSO_NOVO_DO_FLUXO("mensagem"), ai_personalize: true };

interface Cfg {
  passos?: unknown[];
  elegiveis?: number;
  recipients?: Array<Record<string, unknown>>;
}

function fake(cfg: Cfg = {}) {
  const updates: Array<{ tabela: string; patch: Record<string, unknown> }> = [];
  const from = (tabela: string) => {
    let head = false;
    const c: Record<string, unknown> = {};
    c.select = (_: string, o?: { head?: boolean }) => {
      head = Boolean(o?.head);
      return c;
    };
    for (const m of ["eq", "in", "order"]) c[m] = () => c;
    c.limit = () => c;
    c.update = (patch: Record<string, unknown>) => {
      updates.push({ tabela, patch });
      return c;
    };
    c.maybeSingle = async () => ({
      data:
        tabela === "demand_campaign_approaches"
          ? { id: "ab1", name: "Cold", script: "", central_idea: "agenda cheia" }
          : tabela === "campaign_recipients"
            ? { id: "r1", eligibility_status: "eligible" }
            : null,
    });
    c.then = (ok: (v: unknown) => void) => {
      if (tabela === "campaign_recipients" && head) return ok({ count: cfg.elegiveis ?? 2 });
      if (tabela === "demand_approach_steps") return ok({ data: cfg.passos ?? [ia] });
      if (tabela === "campaign_recipients") return ok({ data: cfg.recipients ?? [] });
      return ok({ data: [], error: null });
    };
    return c;
  };
  return { admin: { from } as never, updates };
}

const alvo = (id: string, nome: string, extra: Record<string, unknown> = {}) => ({
  id,
  contact_id: `c-${id}`,
  contacts: { name: nome, display_name: null },
  ...extra,
});

describe("gerarMensagensDaIA", () => {
  beforeEach(() => geracao.falharPara.clear());

  it("escreve a mensagem de cada lead, guarda custo e derruba a aprovação", async () => {
    const f = fake({ recipients: [alvo("r1", "Ana"), alvo("r2", "Bia")] });
    const r = await gerarMensagensDaIA(f.admin, {
      ...disparo,
      ai_approved_at: "2026-10-25T00:00:00Z",
    });
    expect(r).toMatchObject({ ok: true, geradas: 2, falhas: 0, custo_cents: 1 });
    const gravadas = f.updates.filter((u) => u.tabela === "campaign_recipients");
    expect(gravadas).toHaveLength(2);
    expect(gravadas[0]!.patch).toMatchObject({
      rendered_body: "Oi! Posso te contar uma ideia?",
      ai_status: "gerada",
      ai_tokens: 120,
    });
    expect(f.updates.at(-1)).toEqual({
      tabela: "campaigns",
      patch: { ai_approved_at: null, ai_approved_by: null },
    });
  });

  it("falha de um lead não derruba a lista: ele fica 'falhou' e sem texto", async () => {
    geracao.falharPara.add("Bia");
    const f = fake({ recipients: [alvo("r1", "Ana"), alvo("r2", "Bia")] });
    const r = await gerarMensagensDaIA(f.admin, disparo);
    expect(r).toMatchObject({ ok: true, geradas: 1, falhas: 1 });
    expect(
      f.updates.some(
        (u) => u.patch.ai_status === "falhou" && u.patch.ai_error === "fornecedor fora do ar",
      ),
    ).toBe(true);
  });

  it("recusa acima do teto e quando a abertura não é da IA", async () => {
    const acima = await gerarMensagensDaIA(fake({ elegiveis: 21 }).admin, disparo);
    expect(acima).toMatchObject({ ok: false, codigo: "campanha_ia_acima_do_teto" });
    const semIA = await gerarMensagensDaIA(
      fake({ passos: [PASSO_NOVO_DO_FLUXO("mensagem")] }).admin,
      disparo,
    );
    expect(semIA).toMatchObject({ ok: false, codigo: "campanha_conteudo_invalido" });
  });
});

describe("recusaPorMensagensDaIA", () => {
  it("disparo sem IA na abertura não é barrado", async () => {
    expect(
      await recusaPorMensagensDaIA(
        fake({ passos: [PASSO_NOVO_DO_FLUXO("mensagem")] }).admin,
        disparo,
      ),
    ).toBeNull();
  });
  it("com IA: sem aprovação barra; aprovado passa; acima do teto barra", async () => {
    expect(await recusaPorMensagensDaIA(fake().admin, disparo)).toMatchObject({
      codigo: "campanha_mensagens_nao_aprovadas",
    });
    expect(
      await recusaPorMensagensDaIA(fake().admin, {
        ...disparo,
        ai_approved_at: "2026-10-25T00:00:00Z",
      }),
    ).toBeNull();
    expect(
      await recusaPorMensagensDaIA(fake({ elegiveis: 40 }).admin, {
        ...disparo,
        ai_approved_at: "x",
      }),
    ).toMatchObject({ codigo: "campanha_ia_acima_do_teto" });
  });
});

describe("aprovarMensagensDaIA", () => {
  const pronta = (id: string, status: string) => ({
    id,
    rendered_body: "Oi",
    ai_status: status,
    ai_error: null,
    ai_cost_cents: 0.5,
    contacts: { name: "Ana", display_name: null },
  });
  it("só aprova com todas prontas; com falha ou pendente, recusa", async () => {
    const f = fake({
      elegiveis: 2,
      recipients: [pronta("r1", "gerada"), { ...pronta("r2", "falhou") }],
    });
    const r = await aprovarMensagensDaIA(f.admin, disparo, "u1", new Date());
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(f.updates).toHaveLength(0);
  });
  it("aprova e registra quem e quando", async () => {
    const f = fake({ elegiveis: 2, recipients: [pronta("r1", "gerada"), pronta("r2", "editada")] });
    const agora = new Date("2026-10-25T12:00:00Z");
    expect(await aprovarMensagensDaIA(f.admin, disparo, "u1", agora)).toEqual({ ok: true });
    expect(f.updates).toEqual([
      { tabela: "campaigns", patch: { ai_approved_at: agora.toISOString(), ai_approved_by: "u1" } },
    ]);
  });
});

describe("editarMensagemDaIA", () => {
  it("o texto da pessoa vale ('editada') e a aprovação cai; tirar da lista exclui o destinatário", async () => {
    const f = fake();
    expect(await editarMensagemDaIA(f.admin, disparo, "r1", { corpo: "Texto meu" })).toEqual({
      ok: true,
    });
    expect(f.updates[0]!.patch).toMatchObject({ rendered_body: "Texto meu", ai_status: "editada" });
    expect(f.updates.at(-1)!.tabela).toBe("campaigns");

    const g = fake();
    await editarMensagemDaIA(g.admin, disparo, "r1", { excluir: true });
    expect(g.updates[0]!.patch).toMatchObject({
      eligibility_status: "excluded",
      exclusion_reason: "removido_na_revisao",
      status: "skipped",
    });
  });
  it("recusa texto vazio", async () => {
    expect(await editarMensagemDaIA(fake().admin, disparo, "r1", { corpo: "   " })).toMatchObject({
      ok: false,
      status: 422,
    });
  });
});
