import type { Bloco } from "@/lib/marketing/blocos";

/**
 * Modelos de "Produtos e ofertas": a página do módulo (a escada de valor) e uma oferta nova.
 * A oferta é um bloco só, com campos — a página do cliente e o texto para a IA saem dos
 * mesmos campos.
 */
type NovoId = () => string;

export function centralDeProdutos(n: NovoId): Bloco[] {
  return [
    { id: n(), tipo: "titulo", nivel: 1, texto: "A escada de valor" },
    {
      id: n(),
      tipo: "texto",
      texto:
        "Como os produtos e as ofertas se conectam: do primeiro contato até o cliente que fica e compra de novo. Mais abaixo, em “Aprofundamento”, cada oferta aparece na etapa em que você a colocou.",
    },
    {
      id: n(),
      tipo: "fluxo",
      itens: [
        { titulo: "Isca", texto: "O que atrai e qualifica o contato" },
        { titulo: "Entrada", texto: "O primeiro produto, de baixo risco" },
        { titulo: "Principal", texto: "A oferta que sustenta o negócio" },
        { titulo: "Expansão", texto: "O que o cliente compra a mais" },
        { titulo: "Recorrência", texto: "O que o mantém por perto" },
      ],
    },
  ];
}

export function oferta(n: NovoId): Bloco[] {
  return [
    {
      id: n(),
      tipo: "oferta",
      nivel: "simples",
      etapa: "principal",
      carroChefe: false,
      resumo: "",
      paraQuem: "",
      naoEParaQuem: "",
      inclui: [""],
      naoInclui: [],
      prazo: "",
      preco: { tipo: "unico", valor: "", setup: "", condicoes: "" },
      faq: [],
      nuncaPrometer: [],
      promessa: "",
      entregaveis: [],
      bonus: [],
      custoDaInacao: "",
      garantia: "",
      escassez: "",
      objecoes: [],
    },
  ];
}
