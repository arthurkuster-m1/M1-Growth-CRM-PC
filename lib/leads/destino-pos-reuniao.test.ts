import { describe, expect, it } from "vitest";

import { MODELOS_DE_FUNIL_FIXOS } from "@/lib/marketing/modelos-de-funil-fixos";

import { opcoesDeDestinoPosReuniao, type EtapaParaODestino } from "./destino-pos-reuniao";

/** As etapas de um modelo fixo como o banco as devolveria (ids e posições gerados). */
function etapasDe(chave: string): EtapaParaODestino[] {
  const m = MODELOS_DE_FUNIL_FIXOS.find((x) => x.chave === chave)!;
  return m.stages.map((e, i) => ({
    id: `e${i}`,
    name: e.name,
    slug: e.slug ?? null,
    position: (i + 1) * 1000,
    is_won: e.is_won,
    is_lost: e.is_lost,
    qualification: e.qualification,
  }));
}

const idDe = (etapas: EtapaParaODestino[], nome: string) => etapas.find((e) => e.name === nome)!.id;

describe("opcoesDeDestinoPosReuniao", () => {
  it("funil com reunião: negociação, desqualificado e não comprou, nessa ordem", () => {
    const etapas = etapasDe("trafego-pago-com-reuniao");
    const opcoes = opcoesDeDestinoPosReuniao(etapas, idDe(etapas, "Reunião realizada"));
    expect(opcoes.map((o) => [o.tipo, o.nome])).toEqual([
      ["negociacao", "Em negociação"],
      ["desqualificado", "Desqualificado"],
      ["nao_comprou", "Não comprou"],
    ]);
  });

  it("a prospecção ativa oferece os mesmos três (a perda se chama Perdido)", () => {
    const etapas = etapasDe("prospeccao-ativa");
    const opcoes = opcoesDeDestinoPosReuniao(etapas, idDe(etapas, "Reunião realizada"));
    expect(opcoes.map((o) => o.tipo)).toEqual(["negociacao", "desqualificado", "nao_comprou"]);
    expect(opcoes.find((o) => o.tipo === "nao_comprou")?.nome).toBe("Perdido");
  });

  it("funil sem etapa de negociação não oferece 'Em negociação'", () => {
    const etapas = etapasDe("trafego-pago-com-reuniao").filter((e) => e.name !== "Em negociação");
    const opcoes = opcoesDeDestinoPosReuniao(etapas, idDe(etapas, "Reunião realizada"));
    expect(opcoes.map((o) => o.tipo)).toEqual(["desqualificado", "nao_comprou"]);
  });

  it("negociação que ficou ATRÁS da etapa atual não é oferecida (voltar não é seguir a conversa)", () => {
    const etapas = etapasDe("trafego-pago-com-reuniao");
    const opcoes = opcoesDeDestinoPosReuniao(etapas, idDe(etapas, "Em negociação"));
    expect(opcoes.some((o) => o.tipo === "negociacao")).toBe(false);
  });

  it("funil de fábrica (Novo, Em andamento, Comprou, Não comprou) oferece só 'Não comprou'", () => {
    const etapas: EtapaParaODestino[] = [
      { id: "a", name: "Novo", position: 1, is_won: false, is_lost: false, qualification: null },
      {
        id: "b",
        name: "Em andamento",
        position: 2,
        is_won: false,
        is_lost: false,
        qualification: null,
      },
      { id: "c", name: "Comprou", position: 3, is_won: true, is_lost: false, qualification: null },
      {
        id: "d",
        name: "Não comprou",
        position: 4,
        is_won: false,
        is_lost: true,
        qualification: null,
      },
    ];
    expect(opcoesDeDestinoPosReuniao(etapas, "b").map((o) => o.tipo)).toEqual(["nao_comprou"]);
  });
});
