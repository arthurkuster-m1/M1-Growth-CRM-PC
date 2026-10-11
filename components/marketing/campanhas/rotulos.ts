import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import type {
  CanalDaCampanha,
  PeriodoDoOrcamento,
  StatusDaCampanha,
  TipoDeNota,
} from "@/lib/marketing/campanhas";

type Traduz = (texto: string) => string;

/** Os nomes (já traduzidos) e as cores dos vocabulários das campanhas. `t()` só aceita literal. */
export function rotuloDoCanal(t: Traduz, c: CanalDaCampanha): string {
  switch (c) {
    case "trafego_pago":
      return t("Tráfego pago");
    case "prospeccao":
      return t("Prospecção");
    case "social_media":
      return t("Social media");
    case "indicacao":
      return t("Indicações");
    case "parcerias":
      return t("Parcerias");
  }
}

export const COR_DO_CANAL: Record<CanalDaCampanha, CorDaOpcao> = {
  trafego_pago: "blue",
  prospeccao: "orange",
  social_media: "pink",
  indicacao: "green",
  parcerias: "purple",
};

export function rotuloDoStatus(t: Traduz, s: StatusDaCampanha): string {
  switch (s) {
    case "planejada":
      return t("Planejada");
    case "ativa":
      return t("Ativa");
    case "pausada":
      return t("Pausada");
    case "encerrada":
      return t("Encerrada");
  }
}

export const COR_DO_STATUS: Record<StatusDaCampanha, CorDaOpcao> = {
  planejada: "gray",
  ativa: "green",
  pausada: "yellow",
  encerrada: "brown",
};

export function rotuloDoPeriodo(t: Traduz, p: PeriodoDoOrcamento): string {
  switch (p) {
    case "total":
      return t("Total da campanha");
    case "diario":
      return t("Por dia");
    case "semanal":
      return t("Por semana");
    case "mensal":
      return t("Por mês");
  }
}

export function rotuloDaNota(t: Traduz, k: TipoDeNota): string {
  switch (k) {
    case "analise":
      return t("Análise");
    case "feedback":
      return t("Feedback do cliente");
    case "planejamento":
      return t("Planejamento");
    case "otimizacao":
      return t("Otimização");
  }
}

export const COR_DA_NOTA: Record<TipoDeNota, CorDaOpcao> = {
  analise: "blue",
  feedback: "orange",
  planejamento: "purple",
  otimizacao: "green",
};

/** O nome das métricas digitadas por dia nos canais sem API. */
export function rotuloDaMetrica(t: Traduz, chave: string): string {
  switch (chave) {
    case "abordagens":
      return t("Abordagens");
    case "contatos":
      return t("Contatos");
    case "decisor":
      return t("Decisor");
    case "reunioes_agendadas":
      return t("Reuniões agendadas");
    case "reunioes_feitas":
      return t("Reuniões feitas");
    case "vendas":
      return t("Vendas");
    case "valor_total":
      return t("Valor total");
    case "publicacoes":
      return t("Publicações");
    case "alcance":
      return t("Alcance");
    case "engajamento":
      return t("Engajamento");
    case "visitas_ao_perfil":
      return t("Visitas ao perfil");
    case "cliques_no_link":
      return t("Cliques no link");
    case "novos_seguidores":
      return t("Novos seguidores");
    case "indicadores_ativos":
      return t("Indicadores ativos");
    case "indicacoes":
      return t("Indicações recebidas");
    case "qualificadas":
      return t("Qualificadas");
    case "reunioes":
      return t("Reuniões");
    case "recompensa_paga":
      return t("Recompensa paga");
    case "parceiros_ativos":
      return t("Parceiros ativos");
    case "entregas":
      return t("Entregas");
    case "cliques":
      return t("Cliques");
    default:
      return chave;
  }
}
