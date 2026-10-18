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

/** Os modelos que cada aba do CRM oferece (só as Oportunidades têm o Radar). */
export const MODELOS_DAS_OPORTUNIDADES: readonly ModeloDeVisao[] = [MODELO_RADAR];
