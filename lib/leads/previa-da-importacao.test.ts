import { describe, expect, it } from "vitest";

import type { LinhaDeLead } from "@/lib/leads/planilha";

import { chaveDeEmail, chaveDeTelefone, previaDaImportacao } from "./previa-da-importacao";

const linha = (n: number, p: Partial<LinhaDeLead>): LinhaDeLead => ({
  linha: n,
  title: `Lead ${n}`,
  description: null,
  value_cents: null,
  telefone: null,
  nome_do_contato: null,
  email: null,
  tags: [],
  source: "importacao_planilha",
  etapa: null,
  previsao: null,
  campos: {},
  ...p,
});

describe("previaDaImportacao", () => {
  it("separa novos, repetidos na planilha, já no CRM e inválidos", () => {
    const leads = [
      linha(2, { telefone: "+5511988887777" }),
      linha(3, { telefone: "+5511988887777" }), // repetida na planilha
      linha(4, { telefone: "+5521977776666" }), // já no CRM
      linha(5, { email: "ana@exemplo.com" }), // já no CRM, por e-mail
      linha(6, { email: "novo@exemplo.com" }),
      linha(7, {}), // sem telefone nem e-mail: pessoa nova
    ];
    const jaNoCrm = new Set([chaveDeTelefone("+5521977776666"), chaveDeEmail("ANA@exemplo.com")]);
    const p = previaDaImportacao(
      { leads, erros: [{ linha: 8, motivo: "telefone inválido" }], colunasIgnoradas: ["cor"] },
      jaNoCrm,
    );
    expect(p).toMatchObject({
      total_linhas: 7,
      validas: 6,
      invalidas: 1,
      repetidas_na_planilha: 1,
      ja_no_crm: 2,
      novos: 3,
      colunas_ignoradas: ["cor"],
    });
    // Toda linha válida cai em exatamente um balde.
    expect(p.novos + p.ja_no_crm + p.repetidas_na_planilha).toBe(p.validas);
    expect(p.erros).toEqual([{ linha: 8, motivo: "telefone inválido" }]);
    expect(p.amostra).toHaveLength(5);
  });

  it("limita a lista de erros devolvida, mas conta todos", () => {
    const erros = Array.from({ length: 50 }, (_, i) => ({ linha: i + 2, motivo: "x" }));
    const p = previaDaImportacao({ leads: [], erros, colunasIgnoradas: [] }, new Set(), 20);
    expect(p.invalidas).toBe(50);
    expect(p.erros).toHaveLength(20);
  });
});
