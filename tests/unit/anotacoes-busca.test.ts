import { describe, expect, it } from "vitest";

import {
  camposDeBusca,
  dobrar,
  termoDeBusca,
  textoDoDocumento,
  trechoDaBusca,
} from "@/lib/anotacoes/busca";

describe("anotações — busca", () => {
  it("dobra para minúsculas sem acento, mantendo o comprimento", () => {
    expect(dobrar("Reunião de AÇÃO — Ñandú")).toBe("reuniao de acao — nandu");
    expect(dobrar("ção").length).toBe(3);
  });

  it("limpa o termo digitado dos caracteres que quebram o filtro", () => {
    expect(termoDeBusca('  Preço%_(final), "x"  ')).toBe("preco final x");
    expect(termoDeBusca("a".repeat(200))).toHaveLength(80);
  });

  it("extrai o texto de parágrafos, links, tabelas, blocos visuais e filhos", () => {
    const doc = [
      {
        id: "1",
        type: "paragraph",
        content: [{ type: "text", text: "Briefing do cliente" }],
        children: [
          {
            id: "2",
            type: "paragraph",
            content: [
              { type: "link", href: "x", content: [{ type: "text", text: "site oficial" }] },
            ],
          },
        ],
      },
      {
        id: "3",
        type: "table",
        content: {
          type: "tableContent",
          rows: [
            {
              cells: [
                [{ type: "text", text: "Canal" }],
                { content: [{ type: "text", text: "Instagram" }] },
              ],
            },
          ],
        },
      },
      {
        id: "4",
        type: "fluxo",
        props: { dados: JSON.stringify([{ titulo: "Captar", texto: "anúncios" }]) },
      },
      { id: "5", type: "matriz", props: { dados: "{não é json" } },
    ];
    const texto = textoDoDocumento(doc);
    for (const parte of [
      "Briefing do cliente",
      "site oficial",
      "Canal",
      "Instagram",
      "Captar",
      "anúncios",
    ]) {
      expect(texto).toContain(parte);
    }
  });

  it("monta os três campos de busca", () => {
    const c = camposDeBusca("Reunião", [
      { id: "1", type: "paragraph", content: [{ type: "text", text: "Orçamento aprovado" }] },
    ]);
    expect(c.title_fold).toBe("reuniao");
    expect(c.search_text).toBe("Orçamento aprovado");
    expect(c.search_fold).toBe("orcamento aprovado");
  });

  it("devolve um trecho em volta do termo, com o texto original", () => {
    const texto = `${"a ".repeat(60)}Orçamento aprovado ${"b ".repeat(60)}`;
    const trecho = trechoDaBusca(texto, "orcamento");
    expect(trecho).toContain("Orçamento aprovado");
    expect(trecho.startsWith("…")).toBe(true);
    expect(trecho.endsWith("…")).toBe(true);
    expect(trechoDaBusca("curto", "xyz")).toBe("curto");
  });
});
