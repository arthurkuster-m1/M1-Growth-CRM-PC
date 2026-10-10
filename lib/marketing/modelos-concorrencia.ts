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
      intro: "Quem é o concorrente, o que vende e para quem, em poucas linhas.",
      links: [
        { rotulo: "Abrir o site", url: "", destaque: true },
        { rotulo: "Abrir a página de vendas (LP)", url: "", destaque: true },
        { rotulo: "Instagram", url: "", destaque: false },
        { rotulo: "YouTube", url: "", destaque: false },
        { rotulo: "WhatsApp comercial", url: "", destaque: false },
      ],
    },
    t1(n(), "Síntese"),
    cards(n(), [
      {
        titulo: "Objetivo da marca",
        texto: "Como ela se posiciona e o que quer ser para o público.",
      },
      { titulo: "Modelo comercial", texto: "Como entra em contato, o que oferece e como cobra." },
    ]),
    t1(n(), "Promessa"),
    cards(n(), [
      { titulo: "O que realmente vende", texto: "Não o produto, mas o resultado e o sentimento." },
      { titulo: "O sonho", texto: "O que o cliente quer alcançar." },
      { titulo: "A dor", texto: "O que o cliente quer deixar para trás." },
      { titulo: "Mecanismo único", texto: "O método ou nome próprio que sustenta a promessa." },
    ]),
    t1(n(), "Anúncios"),
    cards(n(), [
      {
        titulo: "Google Ads",
        texto: "Está ativo? Palavra-chave, ângulo do anúncio e página de destino.",
      },
      { titulo: "Meta Ads", texto: "Está ativo? Criativos e ofertas (Biblioteca de Anúncios)." },
    ]),
    t1(n(), "Página de vendas e copy"),
    t2(n(), "Estrutura da página"),
    {
      id: n(),
      tipo: "fluxo",
      itens: [
        { titulo: "Topo / promessa", texto: "" },
        { titulo: "Dores", texto: "" },
        { titulo: "Método", texto: "" },
        { titulo: "Prova", texto: "" },
        { titulo: "Oferta", texto: "" },
        { titulo: "Chamada para ação", texto: "" },
      ],
    },
    cards(n(), [
      { titulo: "Provas sociais", texto: "Depoimentos, cases, números e logos." },
      { titulo: "Chamadas para ação", texto: "Para onde cada botão leva." },
      { titulo: "Objeções tratadas", texto: "O que a página responde ao visitante." },
      { titulo: "Falhas e incoerências", texto: "Onde a mensagem quebra." },
    ]),
    t1(n(), "Dados"),
    cards(n(), [
      { titulo: "Site", texto: "Tráfego estimado, aquisição de leads e funil de vendas." },
      { titulo: "Instagram", texto: "Seguidores, engajamento e chamada da bio." },
      { titulo: "Facebook", texto: "Seguidores e atividade." },
      { titulo: "YouTube", texto: "Inscritos, vídeos e visualizações." },
      { titulo: "WhatsApp", texto: "Número comercial, catálogo e mensagem de saudação." },
      { titulo: "Tráfego pago", texto: "Anúncios ativos nas plataformas." },
    ]),
    t2(n(), "Tecnologia identificada"),
    cards(n(), [
      { titulo: "Site e rastreamento", texto: "Construtor, tag manager, analytics, pixels." },
      { titulo: "Conversão", texto: "Formulário, WhatsApp, agenda." },
    ]),
    t1(n(), "Oferta e planos"),
    cards(n(), [
      { titulo: "Plano 1", texto: "O que inclui e quanto custa." },
      { titulo: "Plano 2", texto: "O que inclui e quanto custa." },
      { titulo: "Plano 3", texto: "O que inclui e quanto custa." },
    ]),
    t1(n(), "Forças, fraquezas, oportunidades e ameaças"),
    {
      id: n(),
      tipo: "matriz",
      estilo: "swot",
      celulas: [
        { titulo: "Forças", texto: "O que o concorrente faz bem." },
        { titulo: "Fraquezas", texto: "Onde ele falha." },
        { titulo: "Oportunidades (para nós)", texto: "O espaço que ele deixa aberto." },
        { titulo: "Ameaças", texto: "O que nele pode atrapalhar a gente." },
      ],
    },
    t1(n(), "O que copiar, adaptar e evitar"),
    cards(n(), [
      { titulo: "Copiar", texto: "Boas práticas que valem a pena." },
      { titulo: "Adaptar", texto: "Ideias para fazer do nosso jeito." },
      { titulo: "Evitar", texto: "Erros que ele comete." },
    ]),
    t1(n(), "Ações recomendadas"),
    lista(n(), "numerada", ["Ação 1", "Ação 2", "Ação 3"]),
    t2(n(), "Checklist de verificação"),
    lista(n(), "check", [
      "Buscar redes sociais da marca",
      "Conferir a Biblioteca de Anúncios (Meta e Google)",
      "Estimar tráfego e palavras-chave",
      "Registrar tempo de resposta no WhatsApp (cliente oculto)",
    ]),
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
