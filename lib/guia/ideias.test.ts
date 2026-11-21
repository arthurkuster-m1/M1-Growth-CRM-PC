import { describe, expect, it } from "vitest";

import { diagnosticar } from "./diagnostico";
import {
  LIMIARES,
  avaliarRegras,
  chaveDaIdeia,
  compararFotos,
  escolherNovas,
  fotoDaCampanha,
  quinzenaDe,
  semestreDe,
  type CampanhaParaIdeias,
  type IdeiaCandidata,
} from "./ideias";
import { paginasPublicadas, sinaisCompletos, sinaisVazios } from "./sinais-de-teste";
import type { Leitura, Perfil } from "./tipos";

const AGORA = new Date("2026-11-21T12:00:00Z");
const clinica: Perfil = { nicho: "clinica", modelos: ["agendamento"], jaTemOferta: false };
const loja: Perfil = { nicho: "loja", modelos: ["checkout"], jaTemOferta: false };
const diag = (perfil: Perfil = clinica) =>
  diagnosticar({ perfil, sinais: sinaisVazios(), agora: AGORA });

function campanha(sobre: Partial<CampanhaParaIdeias> = {}): CampanhaParaIdeias {
  return {
    id: "c1",
    nome: "Captação",
    status: "ativa",
    fim: null,
    metaCpl: 20,
    semana: { gasto: 500, leads: 25, impressoes: 40000, alcance: 20000, cliques: 600 },
    gasto14: 1000,
    vendas14: 3,
    coorte30: { leads: 100, agendados: 40, feitas: 20, vendas: 8 },
    diasDesdeOFim: null,
    temAprendizado: false,
    ...sobre,
  };
}
const regras = (cs: CampanhaParaIdeias[], d = diag()) =>
  avaliarRegras({ campanhas: cs, diagnostico: d, agora: AGORA }).map((i) => i.regra);

describe("avaliarRegras", () => {
  it("campanha saudável não gera ideia nenhuma", () => {
    expect(regras([campanha()])).toEqual([]);
  });

  it("R01: custo por lead 30% acima da meta, com a evidência em números", () => {
    const [i] = avaliarRegras({
      campanhas: [
        campanha({
          semana: { gasto: 650, leads: 25, impressoes: 40000, alcance: 20000, cliques: 600 },
        }),
      ],
      diagnostico: diag(),
      agora: AGORA,
    });
    expect(i!.regra).toBe("R01");
    expect(i!.prioridade).toBe(2);
    expect(i!.passoRelacionado).toBe("P51");
    expect(i!.evidencia.join(" ").replace(/ /g, " ")).toContain("R$ 26,00"); // 650 / 25
    expect(i!.evidencia.join(" ")).toMatch(/30,0% acima/);
  });

  it("R01 vira prioridade alta quando passa de 60% acima da meta", () => {
    const i = avaliarRegras({
      campanhas: [
        campanha({
          semana: { gasto: 800, leads: 25, impressoes: 40000, alcance: 20000, cliques: 600 },
        }),
      ],
      diagnostico: diag(),
      agora: AGORA,
    }).find((x) => x.regra === "R01");
    expect(i!.prioridade).toBe(1);
  });

  it("R01 não dispara com poucos leads (pouco dado não é conclusão) nem sem meta", () => {
    const poucos = campanha({
      semana: { gasto: 500, leads: 3, impressoes: 40000, alcance: 20000, cliques: 600 },
    });
    expect(regras([poucos])).not.toContain("R01");
    expect(
      regras([
        campanha({
          metaCpl: null,
          semana: { gasto: 900, leads: 25, impressoes: 40000, alcance: 20000, cliques: 600 },
        }),
      ]),
    ).not.toContain("R01");
  });

  it("R02: taxa de clique baixa, só com impressões suficientes", () => {
    const baixo = campanha({
      semana: { gasto: 400, leads: 25, impressoes: 40000, alcance: 20000, cliques: 100 },
    });
    expect(regras([baixo])).toContain("R02");
    const pouco = campanha({
      semana: { gasto: 40, leads: 25, impressoes: 1000, alcance: 800, cliques: 1 },
    });
    expect(regras([pouco])).not.toContain("R02");
  });

  it("R03: frequência acima de 3", () => {
    const f = campanha({
      semana: { gasto: 400, leads: 25, impressoes: 40000, alcance: 10000, cliques: 600 },
    });
    expect(regras([f])).toContain("R03");
  });

  it("R11: gasto sem lead é prioridade alta e cala as regras de custo e clique", () => {
    const [i, ...resto] = avaliarRegras({
      campanhas: [
        campanha({
          semana: { gasto: 300, leads: 0, impressoes: 40000, alcance: 20000, cliques: 10 },
        }),
      ],
      diagnostico: diag(),
      agora: AGORA,
    });
    expect(i!.regra).toBe("R11");
    expect(i!.prioridade).toBe(1);
    expect(i!.passoRelacionado).toBe("P33");
    expect(resto.map((x) => x.regra)).not.toContain("R02");
  });

  it("R07: verba sem venda registrada, com leads suficientes", () => {
    expect(regras([campanha({ gasto14: 500, vendas14: 0 })])).toContain("R07");
    expect(
      regras([
        campanha({
          gasto14: 500,
          vendas14: 0,
          coorte30: { leads: 3, agendados: 1, feitas: 0, vendas: 0 },
        }),
      ]),
    ).not.toContain("R07");
    expect(regras([campanha({ gasto14: 50, vendas14: 0 })])).not.toContain("R07");
  });

  it("R04: poucos agendamentos — mas só para quem vende por agendamento", () => {
    const f = campanha({ coorte30: { leads: 100, agendados: 5, feitas: 4, vendas: 2 } });
    expect(regras([f], diag(clinica))).toContain("R04");
    expect(regras([f], diag(loja))).not.toContain("R04");
  });

  it("R06: reuniões que não viram venda, só com amostra", () => {
    expect(
      regras([campanha({ coorte30: { leads: 100, agendados: 40, feitas: 20, vendas: 1 } })]),
    ).toContain("R06");
    expect(
      regras([campanha({ coorte30: { leads: 100, agendados: 40, feitas: 4, vendas: 0 } })]),
    ).not.toContain("R06");
  });

  it("R10: campanha encerrada há pouco sem aprendizado; janela única", () => {
    const enc = campanha({ status: "encerrada", diasDesdeOFim: 5 });
    const [i] = avaliarRegras({ campanhas: [enc], diagnostico: diag(), agora: AGORA });
    expect(i).toMatchObject({ regra: "R10", janela: "unica", prioridade: 3 });
    expect(
      regras([campanha({ status: "encerrada", diasDesdeOFim: 5, temAprendizado: true })]),
    ).toEqual([]);
    expect(regras([campanha({ status: "encerrada", diasDesdeOFim: 90 })])).toEqual([]);
  });

  it("campanha pausada ou planejada não gera regra de desempenho", () => {
    const ruim = {
      semana: { gasto: 900, leads: 25, impressoes: 40000, alcance: 10000, cliques: 100 },
    };
    expect(
      regras([
        campanha({ status: "pausada", ...ruim }),
        campanha({ status: "planejada", ...ruim }),
      ]),
    ).toEqual([]);
  });

  it("R12: concorrência vencida vira ideia sobre o passo P22", () => {
    const antiga = new Date(AGORA.getTime() - 200 * 86_400_000).toISOString();
    const sinais = sinaisCompletos("2026-11-20T12:00:00Z");
    const paginas = { ...paginasPublicadas("2026-11-20T12:00:00Z") };
    for (const k of Object.keys(paginas))
      if (k.startsWith("analise-de-concorrencia--concorrente-")) paginas[k] = antiga;
    const d = diagnosticar({
      perfil: clinica,
      sinais: {
        ...sinais,
        paginas: { ok: true, valor: paginas } as Leitura<Record<string, string | null>>,
      },
      agora: AGORA,
    });
    const [i] = avaliarRegras({ campanhas: [], diagnostico: d, agora: AGORA });
    expect(i).toMatchObject({ regra: "R12", alvoTipo: "passo", alvoId: "P22", janela: "2026-S2" });
  });

  it("é determinística", () => {
    const c = [campanha({ gasto14: 500, vendas14: 0 })];
    expect(avaliarRegras({ campanhas: c, diagnostico: diag(), agora: AGORA })).toEqual(
      avaliarRegras({ campanhas: c, diagnostico: diag(), agora: AGORA }),
    );
  });
});

describe("janelas", () => {
  it("quinzena e semestre", () => {
    expect(quinzenaDe(new Date("2026-11-03T00:00:00Z"))).toBe("2026-11-Q1");
    expect(quinzenaDe(new Date("2026-11-21T00:00:00Z"))).toBe("2026-11-Q2");
    expect(semestreDe(new Date("2026-03-01T00:00:00Z"))).toBe("2026-S1");
    expect(semestreDe(new Date("2026-11-01T00:00:00Z"))).toBe("2026-S2");
  });
});

describe("escolherNovas", () => {
  const base: Omit<IdeiaCandidata, "regra" | "titulo" | "prioridade"> = {
    alvoTipo: "campanha",
    alvoId: "c1",
    janela: "j",
    acaoHref: "/x",
    passoRelacionado: null,
    evidencia: [],
  };
  const c = (regra: string, prioridade: 1 | 2 | 3) => ({
    ...base,
    regra,
    titulo: regra,
    prioridade,
  });

  it("respeita o teto de ideias abertas e põe a mais importante primeiro", () => {
    const r = escolherNovas([c("R10", 3), c("R11", 1), c("R01", 2)], new Set(), 3, 5);
    expect(r.map((x) => x.regra)).toEqual(["R11", "R01"]);
  });

  it("não repete o que já existe na mesma janela", () => {
    const existe = new Set([chaveDaIdeia(c("R11", 1))]);
    expect(escolherNovas([c("R11", 1), c("R01", 2)], existe, 0).map((x) => x.regra)).toEqual([
      "R01",
    ]);
  });

  it("sem vaga, nada entra", () => {
    expect(escolherNovas([c("R11", 1)], new Set(), LIMIARES.maximoDeAbertas)).toEqual([]);
  });
});

describe("antes × depois", () => {
  const foto = (sobre: Partial<ReturnType<typeof fotoDaCampanha>> = {}) => ({
    cpl: 30,
    ctr: 0.01,
    frequencia: 3.5,
    leads7: 20,
    gasto7: 600,
    ...sobre,
  });

  it("a foto sai dos números da semana", () => {
    expect(fotoDaCampanha(campanha())).toMatchObject({ cpl: 20, leads7: 25, gasto7: 500 });
    expect(
      fotoDaCampanha(
        campanha({ semana: { gasto: 10, leads: 0, impressoes: 0, alcance: 0, cliques: 0 } }),
      ),
    ).toMatchObject({
      cpl: null,
      ctr: null,
      frequencia: null,
    });
  });

  it("R01: custo por lead que cai 10% ou mais sugere 'funcionou'; que sobe, 'não funcionou'", () => {
    expect(compararFotos("R01", foto({ cpl: 30 }), foto({ cpl: 24 })).sugestao).toBe("funcionou");
    expect(compararFotos("R01", foto({ cpl: 30 }), foto({ cpl: 36 })).sugestao).toBe(
      "nao_funcionou",
    );
    expect(compararFotos("R01", foto({ cpl: 30 }), foto({ cpl: 29 })).sugestao).toBe(
      "inconclusivo",
    );
  });

  it("R02: taxa de clique que sobe sugere 'funcionou'; R03: frequência que cai também", () => {
    expect(compararFotos("R02", foto({ ctr: 0.005 }), foto({ ctr: 0.009 })).sugestao).toBe(
      "funcionou",
    );
    expect(compararFotos("R03", foto({ frequencia: 4 }), foto({ frequencia: 2.5 })).sugestao).toBe(
      "funcionou",
    );
  });

  it("R11: voltaram os leads?", () => {
    expect(compararFotos("R11", foto({ leads7: 0 }), foto({ leads7: 8 })).sugestao).toBe(
      "funcionou",
    );
    expect(compararFotos("R11", foto({ leads7: 0 }), foto({ leads7: 0 })).sugestao).toBe(
      "nao_funcionou",
    );
  });

  it("sem número para comparar ou regra sem métrica, fica 'inconclusivo' e mostra as linhas", () => {
    const c = compararFotos("R04", foto({ cpl: null }), foto({ cpl: null }));
    expect(c.sugestao).toBe("inconclusivo");
    expect(c.linhas.some((l) => l.startsWith("Leads na semana"))).toBe(true);
  });
});
