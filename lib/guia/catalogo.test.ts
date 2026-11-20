import { describe, expect, it } from "vitest";

import { NAV_CATALOG } from "@/lib/navigation/catalogo";
import { moduloPorChave } from "@/lib/marketing/modulos";

import { PASSOS, classificar, passoPorId } from "./catalogo";
import { sinaisQueFalharam } from "./sinais-de-teste";
import { FASES, NICHOS } from "./tipos";

describe("catálogo do Guia (o mapa em código)", () => {
  it("não repete id", () => {
    const ids = PASSOS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo antecessor existe e vem ANTES no catálogo (a ordem é a das dependências)", () => {
    PASSOS.forEach((p, i) => {
      for (const dep of p.depende) {
        const j = PASSOS.findIndex((x) => x.id === dep);
        expect(j, `${p.id} depende de ${dep}, que não existe`).toBeGreaterThanOrEqual(0);
        expect(j, `${p.id} depende de ${dep}, que vem depois`).toBeLessThan(i);
      }
    });
  });

  it("a matriz tem as 5 colunas do mapa e só letras válidas", () => {
    for (const p of PASSOS) {
      expect(p.classes).toHaveLength(NICHOS.length);
      for (const c of p.classes) expect(["E", "R", "O", "-"]).toContain(c);
    }
  });

  it("toda fase do catálogo é uma fase conhecida", () => {
    for (const p of PASSOS) expect(FASES).toContain(p.fase);
  });

  it("passo manual não tem detector; passo detectável tem", () => {
    for (const p of PASSOS) {
      expect(Boolean(p.detectar), p.id).toBe(p.confianca !== "manual");
    }
  });

  it("toda tela do 'onde se faz' tem porta no catálogo de navegação", () => {
    const portas = NAV_CATALOG.map((n) => n.href as string);
    for (const p of PASSOS) {
      const caminho = p.onde.href.split("?")[0] as string;
      const temPorta = portas.some((h) => caminho === h || caminho.startsWith(`${h}/`));
      expect(temPorta, `${p.id} aponta para ${caminho}, sem porta no menu`).toBe(true);
    }
  });

  it("toda página de Estratégia citada existe como módulo", () => {
    for (const p of PASSOS) {
      const m = /^\/app\/marketing\/estrategia\/([a-z0-9-]+)$/.exec(p.onde.href);
      if (m) expect(moduloPorChave(m[1] as string), p.id).toBeDefined();
    }
  });

  it("todo detector respeita leitura que falhou: vira 'não verificado', nunca 'feito'", () => {
    const s = sinaisQueFalharam();
    for (const p of PASSOS) {
      if (!p.detectar || p.id === "P00.1" || p.id === "P00.6") continue; // vêm do perfil, não dos sinais
      expect(p.detectar(s, null).estado, p.id).toBe("nao_verificado");
    }
  });

  it("passo com prazo de validade tem prazo positivo", () => {
    for (const p of PASSOS) if (p.venceDias !== undefined) expect(p.venceDias).toBeGreaterThan(0);
  });

  describe("classificar", () => {
    const p = (id: string) => passoPorId(id)!;
    const base = { nicho: "clinica", modelos: ["agendamento"], jaTemOferta: false } as const;

    it("lê a coluna do nicho", () => {
      expect(classificar(p("P23"), { ...base, nicho: "clinica" })).toBe("E");
      expect(classificar(p("P23"), { ...base, nicho: "loja" })).toBe("R");
      expect(classificar(p("P31"), { ...base, nicho: "clinica" })).toBe("R");
      expect(classificar(p("P31"), { ...base, nicho: "loja" })).toBe("E");
    });

    it("passo de agenda só vale para quem vende por agendamento", () => {
      expect(classificar(p("P42"), base)).toBe("E");
      expect(classificar(p("P42"), { ...base, modelos: ["whatsapp"] })).toBe("-");
      expect(classificar(p("P44"), { ...base, modelos: ["checkout"] })).toBe("-");
    });

    it("checkout só vale para quem vende online", () => {
      expect(classificar(p("P48"), { ...base, nicho: "loja", modelos: ["checkout"] })).toBe("E");
      expect(classificar(p("P48"), { ...base, nicho: "loja", modelos: ["whatsapp"] })).toBe("-");
    });

    it("quem já tem oferta pronta: produto e oferta deixa de ser essencial", () => {
      const pronto = { ...base, jaTemOferta: true };
      expect(classificar(p("P22"), pronto)).toBe("R");
      expect(classificar(p("P24"), pronto)).toBe("R");
      // fora da fase de produto e oferta nada muda
      expect(classificar(p("P30"), pronto)).toBe("E");
    });
  });
});
