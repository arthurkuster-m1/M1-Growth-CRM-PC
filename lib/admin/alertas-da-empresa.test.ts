import { describe, expect, it } from "vitest";

import { alertasDaEmpresa } from "./alertas-da-empresa";

const BASE = {
  organization: {
    status: "active" as const,
    suspended_reason: null,
    onboarded_at: "2026-01-01T00:00:00Z",
  },
  counts: { lgpd_requests_pending: 0 },
  health: {
    waha: { sessions: [], overall_status: "ok" as const },
    ai: {
      consumed_cents: 0,
      budget_cents: null,
      percent_used: null,
      enforcement_mode: "off" as const,
      status: "ok" as const,
    },
  },
  mensalidade: { status: "pago" as const, proximo_pagamento: "2026-12-05" },
  formatarDia: (iso: string) => iso.split("-").reverse().join("/"),
};

const ids = (e: Parameters<typeof alertasDaEmpresa>[0]) => alertasDaEmpresa(e).map((a) => a.id);

describe("alertas da empresa", () => {
  it("empresa em ordem não tem alerta", () => {
    expect(alertasDaEmpresa(BASE)).toEqual([]);
  });

  it("suspensa é crítico, traz o motivo e vem antes dos de atenção", () => {
    const r = alertasDaEmpresa({
      ...BASE,
      organization: { status: "suspended", suspended_reason: "Fraude", onboarded_at: null },
      mensalidade: { status: "pendente", proximo_pagamento: "2026-11-10" },
    });
    expect(r[0]).toMatchObject({ id: "suspensa", gravidade: "critico", detalhe: "Fraude" });
    // suspensa não acusa onboarding pendente (só ativa é cobrada dele)
    expect(r.map((a) => a.id)).toEqual(["suspensa", "mensalidade"]);
  });

  it("mensalidade pendente mostra a data formatada; paga ou sem lead não alerta", () => {
    const pendente = alertasDaEmpresa({
      ...BASE,
      mensalidade: { status: "pendente", proximo_pagamento: "2026-11-10" },
    });
    expect(pendente[0]).toMatchObject({ id: "mensalidade", detalhe: "10/11/2026" });
    expect(ids({ ...BASE, mensalidade: null })).toEqual([]);
    expect(ids({ ...BASE, mensalidade: { status: null, proximo_pagamento: null } })).toEqual([]);
  });

  it("onboarding pendente e LGPD em aberto são atenção", () => {
    expect(
      ids({
        ...BASE,
        organization: { ...BASE.organization, onboarded_at: null },
        counts: { lgpd_requests_pending: 2 },
      }),
    ).toEqual(["onboarding", "lgpd"]);
  });

  it("WhatsApp: falha é crítico (vem primeiro), sem sessão é atenção", () => {
    const comFalha = alertasDaEmpresa({
      ...BASE,
      organization: { ...BASE.organization, onboarded_at: null },
      health: { ...BASE.health, waha: { sessions: [], overall_status: "critical" } },
    });
    expect(comFalha.map((a) => [a.id, a.gravidade])).toEqual([
      ["whatsapp", "critico"],
      ["onboarding", "atencao"],
    ]);
    const semSessao = alertasDaEmpresa({
      ...BASE,
      health: { ...BASE.health, waha: { sessions: [], overall_status: "warning" } },
    });
    expect(semSessao[0]).toMatchObject({ id: "whatsapp", gravidade: "atencao" });
  });

  it("orçamento de IA: 80% avisa, 100% é crítico, sem orçamento não diz nada", () => {
    const com = (percent: number | null) =>
      alertasDaEmpresa({
        ...BASE,
        health: { ...BASE.health, ai: { ...BASE.health.ai, percent_used: percent } },
      });
    expect(com(null)).toEqual([]);
    expect(com(79)).toEqual([]);
    expect(com(85)[0]).toMatchObject({ id: "ia", gravidade: "atencao", detalhe: "85%" });
    expect(com(100)[0]).toMatchObject({ id: "ia", gravidade: "critico" });
  });

  it("sem leitura de saúde, só as regras do cadastro valem", () => {
    expect(ids({ ...BASE, health: null })).toEqual([]);
  });
});
