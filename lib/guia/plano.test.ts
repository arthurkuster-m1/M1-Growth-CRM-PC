import { describe, expect, it } from "vitest";

import { diagnosticar } from "./diagnostico";
import {
  MAXIMO_DO_PLANO_PADRAO,
  ladoPadraoDoPasso,
  planoPadrao,
  prazoDaTarefa,
  prazoParaTarefa,
  visaoDoPlano,
} from "./plano";
import { sinaisCompletos, sinaisVazios } from "./sinais-de-teste";
import type { ItemDoPlano, Perfil } from "./tipos";

const AGORA = new Date("2026-11-21T12:00:00Z");
const clinica: Perfil = {
  nicho: "clinica",
  modelos: ["agendamento", "whatsapp"],
  jaTemOferta: false,
};
const diag = (sinais = sinaisVazios(), manuais = {}) =>
  diagnosticar({ perfil: clinica, sinais, manuais, agora: AGORA });

const item = (passoId: string, extra: Partial<ItemDoPlano> = {}): ItemDoPlano => ({
  passoId,
  lado: null,
  responsavelId: null,
  prazo: null,
  ordem: 1,
  tarefaId: null,
  ...extra,
});

describe("planoPadrao", () => {
  const ids = planoPadrao(diag());

  it("só passos essenciais que ainda não estão prontos, em ordem do mapa, no máximo 12", () => {
    const d = diag();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThanOrEqual(MAXIMO_DO_PLANO_PADRAO);
    const porId = new Map(d.passos.map((p) => [p.id, p]));
    for (const id of ids) {
      expect(porId.get(id)!.classificacao).toBe("E");
      expect(["falta", "em_andamento", "bloqueado", "desatualizado"]).toContain(
        porId.get(id)!.estado,
      );
    }
    const ordens = ids.map((id) => porId.get(id)!.ordem);
    expect(ordens).toEqual([...ordens].sort((a, b) => a - b));
  });

  it("inclui os bloqueados (entram na ordem certa) e deixa de fora recomendado, feito e dispensado", () => {
    expect(ids).toContain("P24"); // bloqueado por P21 e P22, mas é essencial
    expect(ids).not.toContain("P00.3"); // recomendado
    expect(ids).not.toContain("P00.1"); // já feito (o perfil existe)
    const dispensado = planoPadrao(diag(sinaisVazios(), { P10: { estado: "dispensado" } }));
    expect(dispensado).not.toContain("P10");
  });

  it("empresa com tudo pronto não tem o que pôr no plano padrão além do manual essencial", () => {
    const pronto = planoPadrao(diag(sinaisCompletos("2026-11-20T12:00:00Z")));
    expect(pronto).toEqual(["P46"]);
  });
});

describe("lado e prazo", () => {
  it("quem costuma fazer: cliente nos passos de acesso e equipe; agência no resto", () => {
    expect(ladoPadraoDoPasso("P00.5")).toBe("cliente");
    expect(ladoPadraoDoPasso("P47")).toBe("cliente");
    expect(ladoPadraoDoPasso("P22")).toBe("agencia");
  });

  it("o prazo é meio-dia em São Paulo e volta à mesma data (nunca cai no dia errado)", () => {
    const instante = prazoParaTarefa("2026-12-01");
    expect(instante).toBe("2026-12-01T12:00:00-03:00");
    expect(prazoDaTarefa(instante)).toBe("2026-12-01");
    expect(prazoDaTarefa("2026-12-01T02:30:00Z")).toBe("2026-11-30"); // 23h30 do dia anterior em SP
    expect(prazoDaTarefa(null)).toBeNull();
    expect(prazoDaTarefa("lixo")).toBeNull();
  });
});

describe("visaoDoPlano", () => {
  const d = diag();
  const HOJE = "2026-11-21";

  it("ordena pelo plano e descarta passo que não existe mais no mapa", () => {
    const v = visaoDoPlano(
      d,
      [item("P22", { ordem: 5 }), item("P10", { ordem: 2 }), item("P99", { ordem: 1 })],
      {},
      HOJE,
    );
    expect(v.map((x) => x.passo.id)).toEqual(["P10", "P22"]);
  });

  it("o lado vem do item, ou do costume do passo", () => {
    const v = visaoDoPlano(
      d,
      [item("P00.5", { ordem: 1 }), item("P10", { ordem: 2, lado: "cliente" })],
      {},
      HOJE,
    );
    expect(v.map((x) => x.lado)).toEqual(["cliente", "cliente"]);
    expect(visaoDoPlano(d, [item("P10")], {}, HOJE)[0]!.lado).toBe("agencia");
  });

  it("atrasado: prazo vencido e passo ainda por fazer", () => {
    const [v] = visaoDoPlano(d, [item("P10", { prazo: "2026-11-01" })], {}, HOJE);
    expect(v!.atrasado).toBe(true);
    const [noPrazo] = visaoDoPlano(d, [item("P10", { prazo: "2026-11-21" })], {}, HOJE);
    expect(noPrazo!.atrasado).toBe(false);
  });

  it("passo feito ou tarefa concluída não é atrasado", () => {
    const feito = diag(sinaisVazios(), { P10: { estado: "feito", em: "2026-11-20T12:00:00Z" } });
    expect(visaoDoPlano(feito, [item("P10", { prazo: "2026-11-01" })], {}, HOJE)[0]!.atrasado).toBe(
      false,
    );
    const concluida = visaoDoPlano(
      d,
      [item("P10", { prazo: "2026-11-01", tarefaId: "t1" })],
      { t1: { status: "done", prazo: "2026-11-01" } },
      HOJE,
    );
    expect(concluida[0]!.atrasado).toBe(false);
  });

  it("fecha o laço sem decidir sozinho: tarefa concluída sugere confirmar o passo", () => {
    const [v] = visaoDoPlano(
      d,
      [item("P10", { tarefaId: "t1" })],
      { t1: { status: "done", prazo: null } },
      HOJE,
    );
    expect(v!.sugestao).toBe("confirmar_passo");
  });

  it("passo pronto com tarefa aberta sugere concluir a tarefa", () => {
    const feito = diag(sinaisVazios(), { P10: { estado: "feito", em: "2026-11-20T12:00:00Z" } });
    const [v] = visaoDoPlano(
      feito,
      [item("P10", { tarefaId: "t1" })],
      { t1: { status: "pending", prazo: null } },
      HOJE,
    );
    expect(v!.sugestao).toBe("concluir_tarefa");
  });

  it("sem tarefa ou com tarefa em dia, não sugere nada", () => {
    expect(visaoDoPlano(d, [item("P10")], {}, HOJE)[0]!.sugestao).toBeNull();
    const [v] = visaoDoPlano(
      d,
      [item("P10", { tarefaId: "t1" })],
      { t1: { status: "in_progress", prazo: null } },
      HOJE,
    );
    expect(v!.sugestao).toBeNull();
  });
});
