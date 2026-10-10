import type { Bloco } from "@/lib/marketing/blocos";

/**
 * Modelos da ANÁLISE DE CONCORRÊNCIA: a ficha de cada concorrente e as perguntas-chave, na
 * estrutura que a agência já usa (breve análise, promessa, anúncios, página e cópia, dados,
 * SWOT, o que copiar/adaptar/evitar, ações). Conteúdo editável em português.
 */
type NovoId = () => string;

const t1 = (id: string, texto: string): Bloco => ({ id, tipo: "titulo", nivel: 1, texto });
const t2 = (id: string, texto: string): Bloco => ({ id, tipo: "titulo", nivel: 2, texto });
const cards = (id: string, itens: { titulo: string; texto: string }[]): Bloco => ({
  id,
  tipo: "cards",
  itens,
});
const lista = (
  id: string,
  estilo: "marcadores" | "numerada" | "check",
  itens: string[],
): Bloco => ({
  id,
  tipo: "lista",
  estilo,
  itens,
});

export function concorrente(n: NovoId): Bloco[] {
  return [
    {
      id: n(),
      tipo: "ficha",
      intro: "Quem é, o que vende e para quem, em duas frases.",
      links: [
        { rotulo: "Abrir o site", url: "", destaque: true },
        { rotulo: "Abrir a página de vendas (LP)", url: "", destaque: true },
        { rotulo: "Instagram", url: "", destaque: false },
        { rotulo: "YouTube", url: "", destaque: false },
        { rotulo: "WhatsApp comercial", url: "", destaque: false },
      ],
    },
    t1(n(), "Veredito"),
    {
      id: n(),
      tipo: "destaque",
      tom: "atencao",
      texto: "Em uma frase: por que este concorrente importa (ou não) para nós.",
    },
    {
      id: n(),
      tipo: "metricas",
      itens: [
        { rotulo: "Nível de ameaça", valor: "—", detalhe: "Alto, médio ou baixo" },
        { rotulo: "Proximidade com a nossa oferta", valor: "—", detalhe: "" },
        { rotulo: "Faixa de preço", valor: "—", detalhe: "" },
        { rotulo: "Canal principal", valor: "—", detalhe: "" },
      ],
    },
    t1(n(), "Posicionamento e promessa"),
    cards(n(), [
      { titulo: "Para quem fala", texto: "O público e o nicho que ele escolheu." },
      { titulo: "Promessa central", texto: "O resultado e o sentimento que vende, não o produto." },
      {
        titulo: "Mecanismo ou diferencial",
        texto: "O método, nome próprio ou razão para escolhê-lo.",
      },
      { titulo: "Tom de voz", texto: "Como fala: técnico, próximo, agressivo, sóbrio…" },
    ]),
    t1(n(), "Oferta e preço"),
    cards(n(), [
      { titulo: "O que vende", texto: "Produtos, planos e o que cada um inclui." },
      {
        titulo: "Preço e condições",
        texto: "Valores, faixa ou “sob consulta”; contrato e fidelidade.",
      },
      { titulo: "Garantia e risco", texto: "O que garante e o que deixa por conta do cliente." },
      {
        titulo: "Porta de entrada",
        texto: "A isca ou o primeiro passo (diagnóstico, teste, aula).",
      },
    ]),
    t1(n(), "Como atrai e converte"),
    {
      id: n(),
      tipo: "fluxo",
      itens: [
        { titulo: "Atrai", texto: "" },
        { titulo: "Página", texto: "" },
        { titulo: "Contato", texto: "" },
        { titulo: "Fechamento", texto: "" },
        { titulo: "Pós-venda", texto: "" },
      ],
    },
    cards(n(), [
      {
        titulo: "Anúncios",
        texto: "Está anunciando? Onde, com qual ângulo e para qual página.",
      },
      {
        titulo: "Presença orgânica",
        texto: "Redes e conteúdo: frequência, engajamento e o que funciona.",
      },
      {
        titulo: "Conversão",
        texto: "Formulário, WhatsApp, agenda; e como é o atendimento.",
      },
    ]),
    t1(n(), "Prova e autoridade"),
    cards(n(), [
      { titulo: "Depoimentos e cases", texto: "Quantos, de quem e com qual resultado." },
      { titulo: "Números", texto: "Clientes, anos, resultados. Dá para comprovar?" },
      { titulo: "Autoridade", texto: "Rosto da marca, mídia, certificações, parcerias." },
    ]),
    t1(n(), "Forças, fraquezas, oportunidades e ameaças"),
    {
      id: n(),
      tipo: "matriz",
      estilo: "swot",
      celulas: [
        { titulo: "Forças dele", texto: "O que faz bem e não devemos ignorar." },
        { titulo: "Fraquezas dele", texto: "Onde falha e dá espaço para nós." },
        { titulo: "Oportunidades para nós", texto: "O que ele deixa aberto." },
        { titulo: "Ameaças para nós", texto: "Onde ele pode nos atrapalhar." },
      ],
    },
    t1(n(), "O que fazer com isso"),
    cards(n(), [
      { titulo: "Copiar", texto: "O que funciona e vale replicar." },
      { titulo: "Adaptar", texto: "Boas ideias para fazer do nosso jeito." },
      { titulo: "Evitar", texto: "Os erros dele que não devemos cometer." },
    ]),
    t2(n(), "Ações priorizadas"),
    lista(n(), "numerada", ["Ação 1 (a mais importante)", "Ação 2", "Ação 3"]),
    t2(n(), "Fontes e data da análise"),
    {
      id: n(),
      tipo: "texto",
      texto:
        "Analisado em __/__/____. Fontes: site, redes, Biblioteca de Anúncios, avaliações. O que não foi possível verificar: …",
    },
  ];
}

export function perguntasChave(n: NovoId): Bloco[] {
  const perguntas = [
    "Quais são seus 3 principais concorrentes? O que eles vendem?",
    "São maiores ou menores que você?",
    "Qual a idade e a classe social do cliente ideal deles?",
    "Os produtos deles são os mesmos que os seus?",
    "Qual deles é mais próximo de você?",
    "Qual de vocês está melhor posicionado?",
    "Quais os pontos fortes deles?",
    "O que você acha interessante neles?",
    "O que eles não fazem? O que não são tão bons em fazer?",
    "Quais as críticas que eles recebem?",
    "Quais são as garantias que eles oferecem?",
    "O que eles não podem garantir?",
    "O que eles fazem que você não faz ou não pode fazer?",
    "O que de bom deles você poderia começar a usar?",
    "O que eles fazem melhor do que você?",
    "Quais são as dores e os prazeres dos clientes deles?",
    "O que você faz melhor do que eles?",
    "Em quais áreas você pode e precisa melhorar?",
    "Quais são as críticas e cobranças que você recebe?",
  ];
  return [
    t1(n(), "As perguntas-chave"),
    cards(
      n(),
      perguntas.slice(0, 12).map((p) => ({ titulo: p, texto: "Resposta…" })),
    ),
    cards(
      n(),
      perguntas.slice(12).map((p) => ({ titulo: p, texto: "Resposta…" })),
    ),
  ];
}
