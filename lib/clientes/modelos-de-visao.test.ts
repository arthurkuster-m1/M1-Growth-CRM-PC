import { describe, expect, it } from "vitest";

import { aplicarConsulta, type CampoConsultavel } from "@/lib/motor/consulta";
import { preferenciasDaTabelaSchema } from "@/lib/motor/layout";

import { MODELO_RADAR } from "./modelos-de-visao";

type Linha = { nome: string; radar: string | undefined };

const BALDES = ["critico", "em_risco", "em_voo", "em_dia"];
const CAMPOS: CampoConsultavel<Linha>[] = [
  {
    id: "radar",
    tipo: "opcao",
    valorDe: (l) => l.radar,
    ordemDoValor: (v) => BALDES.indexOf(v),
  },
];

describe("modelo de visão: Radar", () => {
  it("é uma config válida de aba salva", () => {
    expect(preferenciasDaTabelaSchema.safeParse(MODELO_RADAR.config).success).toBe(true);
  });

  it("mostra só crítico e em risco, o mais urgente primeiro", () => {
    const linhas: Linha[] = [
      { nome: "A", radar: "em_dia" },
      { nome: "B", radar: "em_risco" },
      { nome: "C", radar: "em_voo" },
      { nome: "D", radar: "critico" },
      { nome: "E", radar: undefined },
    ];
    const { linhas: vistas } = aplicarConsulta(linhas, CAMPOS, MODELO_RADAR.config, {
      hoje: "2026-10-18",
    });
    expect(vistas.map((l) => l.nome)).toEqual(["D", "B"]);
  });
});
