import { describe, expect, it } from "vitest";

import { passoPorId } from "./catalogo";
import { FORMATO_DO_TEXTO_ESTRUTURADO } from "./prompts-do-metodo";
import { PROMPTS, montarPrompt, promptPorId, promptsDoPasso } from "./prompts";

describe("prompts do Guia", () => {
  it("não repete id e todo passo citado existe no mapa", () => {
    expect(new Set(PROMPTS.map((p) => p.id)).size).toBe(PROMPTS.length);
    for (const p of PROMPTS)
      for (const id of p.passos) expect(passoPorId(id), `${p.id} → ${id}`).toBeDefined();
  });

  it("persona e árvore de situações são do passo de persona; premissa e concorrente têm o seu", () => {
    expect(promptsDoPasso("P21").map((p) => p.id)).toEqual(["persona", "arvore-de-situacoes"]);
    expect(promptsDoPasso("P25").map((p) => p.id)).toEqual(["premissa-persuasiva"]);
    expect(promptsDoPasso("P22").map((p) => p.id)).toEqual(["concorrente"]);
  });

  it("os prompts do método vieram dos documentos (não estão vazios)", () => {
    for (const id of ["persona", "arvore-de-situacoes", "premissa-persuasiva", "concorrente"]) {
      expect(promptPorId(id)!.instrucao.length, id).toBeGreaterThan(500);
    }
  });

  it("o formato do texto estruturado traz os marcadores que o importador lê", () => {
    expect(FORMATO_DO_TEXTO_ESTRUTURADO).toContain("::: metricas");
    expect(FORMATO_DO_TEXTO_ESTRUTURADO).toContain("::: matriz swot");
    expect(FORMATO_DO_TEXTO_ESTRUTURADO).toContain("# Título grande");
  });

  describe("montarPrompt", () => {
    const dossie = "# Dossiê do projeto — Teste\n\nconteúdo";

    it("junta instrução e dossiê; o consultor responde livre (sem formato de página)", () => {
      const texto = montarPrompt(promptPorId("consultor")!, dossie);
      expect(texto).toContain("Analise o dossiê abaixo");
      expect(texto).toContain("# Dossiê do projeto — Teste");
      expect(texto).not.toContain("FORMATO DA RESPOSTA");
    });

    it("quando a resposta vira página, pede o formato que o importador entende", () => {
      const texto = montarPrompt(promptPorId("concorrente")!, dossie);
      expect(texto).toContain("FORMATO DA RESPOSTA");
      expect(texto).toContain("::: tabela");
      expect(texto.indexOf("DOSSIÊ DO PROJETO")).toBeLessThan(texto.indexOf("FORMATO DA RESPOSTA"));
    });

    it("o rascunho genérico manda a IA marcar o que falta em vez de inventar", () => {
      const texto = montarPrompt(promptPorId("rascunho-p23")!, dossie);
      expect(texto).toContain("[PREENCHER");
      expect(texto).toContain("Planejamento empresarial");
    });
  });
});
