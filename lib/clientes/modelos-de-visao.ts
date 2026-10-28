import type { PreferenciasDaTabela } from "@/lib/motor/layout";
import type { TipoDeVisualizacao } from "@/lib/motor/visualizacoes";

/**
 * VISUALIZAÇÕES PRONTAS do CRM — abas que a pessoa cria com um clique, em vez de montar o filtro.
 * Cada uma é só um nome, um tipo e a `config` de uma aba salva comum (filtros, ordem, agrupamento):
 * depois de criada, é editável como qualquer outra.
 */
export interface ModeloDeVisao {
  id: string;
  /** Nome da aba criada (e do botão). Vira aba do usuário, então fica no idioma do produto. */
  nome: string;
  descricao: string;
  tipo: TipoDeVisualizacao;
  config: PreferenciasDaTabela;
}

/**
 * TODAS as colunas da tabela de Oportunidades, na ordem de fábrica. Os modelos abaixo escolhem
 * quais delas aparecem (e em que ordem); as demais ficam escondidas, a um clique no menu.
 */
export const COLUNAS_DE_OPORTUNIDADES = [
  "nome",
  "cliente",
  "telefone",
  "etapa",
  "campanha",
  "responsavel",
  "radar",
  "sem-resposta",
  "op-tempo-na-etapa",
  "op-ultima-atividade",
  "tentativas",
  "resultado-rapido",
  "ligar",
  "whatsapp",
  "instagram",
  "inbox",
  "acao",
  "proxima-acao",
  "proxima-acao-em",
  "cadencia",
  "previsao",
  "entrou-no-funil",
  "produtos",
  "pago",
  "op-interesse",
  "previsto",
  "origem",
  "anuncio",
  "lp",
  "posicionamento",
  "op-utm-fonte",
  "op-utm-meio",
  "op-utm-campanha",
  "op-utm-termo",
  "op-utm-conteudo",
  "op-atribuido-em",
  "op-criado-por",
  "op-retomada",
  "op-etapa-da-perda",
  "op-motivo-da-perda",
  "op-dias-ate-perder",
  "op-tags",
] as const;

/** Só estas colunas aparecem, nesta ordem; as outras ficam escondidas. */
function colunas(
  ids: readonly string[],
  todas: readonly string[] = COLUNAS_DE_OPORTUNIDADES,
): PreferenciasDaTabela {
  const visiveis = Object.fromEntries(todas.map((id) => [id, ids.includes(id)]));
  return {
    ordem: [...ids, ...todas.filter((id) => !ids.includes(id))],
    visiveis,
  };
}

/** TODAS as colunas da tabela de Clientes (a pessoa), na ordem de fábrica. */
export const COLUNAS_DE_CLIENTES = [
  "nome",
  "ciclo",
  "mql",
  "dono",
  "ativo-ate",
  "ultimo-pagamento",
  "proximo-pagamento",
  "email",
  "telefone",
  "origem",
  "tags",
  "entrou",
  "abordagem",
  "primeira-compra",
  "ltv",
  "ltv-previsto",
  "interesse",
  "vendas",
  "oportunidades-abertas",
  "funis-ate-comprar",
  "dias-ate-comprar",
  "origem-campanha",
  "origem-posicionamento",
  "anuncio",
  "lp",
  "atividade",
] as const;

const colunasDeClientes = (ids: readonly string[]) => colunas(ids, COLUNAS_DE_CLIENTES);

/**
 * O RADAR: o que esfriou e pede ação — Crítico e Em risco, com o mais urgente em cima. "Em voo"
 * fica de fora de propósito: a IA ou a agenda já prometeram voltar, não há decisão pendente.
 * Só as colunas que servem a esse trabalho: o botão de agir, o radar, há quanto tempo está parado
 * e qual é o próximo passo.
 */
export const MODELO_RADAR: ModeloDeVisao = {
  id: "radar",
  nome: "Radar",
  descricao: "O que esfriou e pede ação: crítico e em risco, o mais urgente primeiro.",
  tipo: "tabela",
  config: {
    ...colunas([
      "nome",
      "proxima-acao",
      "proxima-acao-em",
      "radar",
      "cadencia",
      "sem-resposta",
      "ligar",
      "inbox",
      "acao",
      "op-ultima-atividade",
      "op-tempo-na-etapa",
      "etapa",
      "cliente",
      "telefone",
      "responsavel",
      "tentativas",
      "previsto",
    ]),
    filtros: [{ campo: "radar", operador: "e", valor: ["critico", "em_risco"] }],
    ordenacao: [
      { campo: "radar", direcao: "asc" },
      { campo: "sem-resposta", direcao: "desc" },
    ],
  },
};

/** CONVERSÃO — trabalhar o lead: quem está parado, quem ligar, qual o próximo passo. */
export const MODELO_CONVERSAO: ModeloDeVisao = {
  id: "conversao",
  nome: "Conversão",
  descricao: "Trabalhar o lead: o que esfriou, quem ligar e qual é o próximo passo.",
  tipo: "tabela",
  config: {
    ...colunas([
      "nome",
      "proxima-acao",
      "proxima-acao-em",
      "cadencia",
      "ligar",
      "inbox",
      "acao",
      "cliente",
      "telefone",
      "etapa",
      "responsavel",
      "radar",
      "sem-resposta",
      "op-tempo-na-etapa",
      "op-ultima-atividade",
      "tentativas",
      "previsao",
      "previsto",
    ]),
    // Só abertas (a perdida e a ganha não têm "sem resposta"), o mais urgente em cima.
    filtros: [{ campo: "sem-resposta", operador: "preenchido" }],
    ordenacao: [
      { campo: "radar", direcao: "asc" },
      { campo: "sem-resposta", direcao: "desc" },
    ],
  },
};

/** ANÁLISE DE ORIGEM — de onde vem cada oportunidade e quem a criou ou atribuiu. */
export const MODELO_ORIGEM: ModeloDeVisao = {
  id: "origem",
  nome: "Origem",
  descricao: "De onde vem cada oportunidade: campanha, anúncio, página, UTMs e quem criou.",
  tipo: "tabela",
  config: colunas([
    "nome",
    "cliente",
    "campanha",
    "origem",
    "anuncio",
    "lp",
    "posicionamento",
    "op-utm-fonte",
    "op-utm-meio",
    "op-utm-campanha",
    "op-utm-termo",
    "op-utm-conteudo",
    "entrou-no-funil",
    "op-atribuido-em",
    "op-criado-por",
    "responsavel",
    "op-retomada",
    "etapa",
    "pago",
  ]),
};

/** ANÁLISE DE VENDAS E PAGAMENTOS — o dinheiro de cada oportunidade. */
export const MODELO_VENDAS: ModeloDeVisao = {
  id: "vendas-e-pagamentos",
  nome: "Vendas e pagamentos",
  descricao: "O dinheiro de cada oportunidade: pago, em interesse e comprometido.",
  tipo: "tabela",
  config: colunas([
    "nome",
    "cliente",
    "campanha",
    "produtos",
    "etapa",
    "pago",
    "op-interesse",
    "previsto",
    "previsao",
    "entrou-no-funil",
    "responsavel",
  ]),
};

/** PERDAS — onde e por que as oportunidades se perdem. */
export const MODELO_PERDAS: ModeloDeVisao = {
  id: "perdas",
  nome: "Perdas",
  descricao: "Onde e por que as oportunidades se perdem.",
  tipo: "tabela",
  config: {
    ...colunas([
      "nome",
      "cliente",
      "campanha",
      "op-etapa-da-perda",
      "op-motivo-da-perda",
      "responsavel",
      "op-dias-ate-perder",
      "entrou-no-funil",
    ]),
    // Toda oportunidade perdida tem motivo: é o que separa as perdidas das demais.
    filtros: [{ campo: "op-motivo-da-perda", operador: "preenchido" }],
  },
};

/** QUADRO DE CONVERSÃO — o cartão enxuto: o que se precisa para trabalhar o lead de relance. */
export const MODELO_QUADRO: ModeloDeVisao = {
  id: "quadro-de-conversao",
  nome: "Quadro de conversão",
  descricao:
    "O quadro do funil com o cartão enxuto: cliente, telefone, valor, radar e próxima ação.",
  tipo: "kanban",
  config: colunas([
    "nome",
    "cliente",
    "telefone",
    "responsavel",
    "previsto",
    "radar",
    "proxima-acao",
    "proxima-acao-em",
    "op-tempo-na-etapa",
    "op-tags",
  ]),
};

/** PRÓXIMOS PASSOS — quem tem um passo marcado nos próximos 5 dias, o que vence primeiro em cima. */
export const MODELO_PROXIMOS_PASSOS: ModeloDeVisao = {
  id: "proximos-passos",
  nome: "Próximos passos",
  descricao: "Quem tem o próximo passo marcado nos próximos 5 dias, o mais próximo primeiro.",
  tipo: "tabela",
  config: {
    ...colunas([
      "nome",
      "proxima-acao",
      "proxima-acao-em",
      "cliente",
      "telefone",
      "etapa",
      "responsavel",
      "ligar",
      "inbox",
      "acao",
      "previsto",
    ]),
    filtros: [{ campo: "proxima-acao-em", operador: "periodo", valor: "proximos_5_dias" }],
    ordenacao: [{ campo: "proxima-acao-em", direcao: "asc" }],
  },
};

/** As visualizações de fábrica das Oportunidades (criadas na migration 0673) e o Radar. */
export const VISOES_DE_FABRICA_DAS_OPORTUNIDADES: readonly ModeloDeVisao[] = [
  MODELO_CONVERSAO,
  MODELO_PROXIMOS_PASSOS,
  MODELO_ORIGEM,
  MODELO_VENDAS,
  MODELO_PERDAS,
  MODELO_QUADRO,
];

/** Os modelos que cada aba do CRM oferece no "+" (a pessoa cria com um clique e edita à vontade). */
export const MODELOS_DAS_OPORTUNIDADES: readonly ModeloDeVisao[] = [
  ...VISOES_DE_FABRICA_DAS_OPORTUNIDADES,
  MODELO_RADAR,
];

/** LISTA DE CLIENTES — quem é a pessoa, como falar com ela e em que ponto da relação está. */
export const MODELO_LISTA_DE_CLIENTES: ModeloDeVisao = {
  id: "lista-de-clientes",
  nome: "Lista de clientes",
  descricao: "Quem é cada cliente, como falar com ele e em que ponto da relação está.",
  tipo: "tabela",
  config: colunasDeClientes([
    "nome",
    "telefone",
    "email",
    "ciclo",
    "mql",
    "dono",
    "tags",
    "ativo-ate",
    "atividade",
  ]),
};

/** ANÁLISE DE COMPRAS — quanto cada cliente comprou e quanto demorou para comprar. */
export const MODELO_ANALISE_DE_COMPRAS: ModeloDeVisao = {
  id: "analise-de-compras",
  nome: "Análise de Compras",
  descricao: "Quanto cada cliente já pagou, o que está em interesse e quanto demorou para comprar.",
  tipo: "tabela",
  config: colunasDeClientes([
    "nome",
    "ciclo",
    "entrou",
    "abordagem",
    "primeira-compra",
    "funis-ate-comprar",
    "dias-ate-comprar",
    "vendas",
    "ltv",
    "ltv-previsto",
    "interesse",
    "ultimo-pagamento",
    "proximo-pagamento",
  ]),
};

/** ANÁLISE DE ORIGEM — de onde veio cada cliente (campanha, anúncio, página e posicionamento). */
export const MODELO_ANALISE_DE_ORIGEM: ModeloDeVisao = {
  id: "analise-de-origem-clientes",
  nome: "Análise de Origem",
  descricao: "De onde veio cada cliente: origem, campanha, anúncio, página e posicionamento.",
  tipo: "tabela",
  config: {
    ...colunasDeClientes([
      "nome",
      "ciclo",
      "mql",
      "entrou",
      "origem",
      "origem-campanha",
      "lp",
      "anuncio",
      "origem-posicionamento",
    ]),
    ordenacao: [{ campo: "origem", direcao: "asc" }],
  },
};

/** Os modelos que a aba Clientes oferece no "+" (a pessoa cria com um clique e edita à vontade). */
export const MODELOS_DOS_CLIENTES: readonly ModeloDeVisao[] = [
  MODELO_LISTA_DE_CLIENTES,
  MODELO_ANALISE_DE_COMPRAS,
  MODELO_ANALISE_DE_ORIGEM,
];
