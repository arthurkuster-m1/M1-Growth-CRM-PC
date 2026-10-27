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
 * O RADAR: o que esfriou e pede ação — Crítico e Em risco, com o mais urgente em cima. "Em voo"
 * fica de fora de propósito: a IA ou a agenda já prometeram voltar, não há decisão pendente.
 */
export const MODELO_RADAR: ModeloDeVisao = {
  id: "radar",
  nome: "Radar",
  descricao: "O que esfriou e pede ação: crítico e em risco, o mais urgente primeiro.",
  tipo: "tabela",
  config: {
    filtros: [{ campo: "radar", operador: "e", valor: ["critico", "em_risco"] }],
    ordenacao: [{ campo: "radar", direcao: "asc" }],
  },
};

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
function colunas(ids: readonly string[]): PreferenciasDaTabela {
  const visiveis = Object.fromEntries(COLUNAS_DE_OPORTUNIDADES.map((id) => [id, ids.includes(id)]));
  return {
    ordem: [...ids, ...COLUNAS_DE_OPORTUNIDADES.filter((id) => !ids.includes(id))],
    visiveis,
  };
}

/** CONVERSÃO — trabalhar o lead: quem está parado, quem ligar, qual o próximo passo. */
export const MODELO_CONVERSAO: ModeloDeVisao = {
  id: "conversao",
  nome: "Conversão",
  descricao: "Trabalhar o lead: o que esfriou, quem ligar e qual é o próximo passo.",
  tipo: "tabela",
  config: {
    ...colunas([
      "nome",
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
      "resultado-rapido",
      "proxima-acao",
      "proxima-acao-em",
      "cadencia",
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
  descricao: "O quadro do funil com o cartão enxuto: cliente, telefone, valor, radar e próxima ação.",
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

/** As visualizações de fábrica das Oportunidades (criadas na migration 0673) e o Radar. */
export const VISOES_DE_FABRICA_DAS_OPORTUNIDADES: readonly ModeloDeVisao[] = [
  MODELO_CONVERSAO,
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
