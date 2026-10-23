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
    case "aproveitamento_de_base":
      return t("Aproveitamento de base");
  }
}

export const COR_DO_CANAL: Record<CanalDaCampanha, CorDaOpcao> = {
  trafego_pago: "blue",
  prospeccao: "orange",
  social_media: "pink",
  indicacao: "green",
  parcerias: "purple",
  aproveitamento_de_base: "yellow",
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
    case "clientes_contatados":
      return t("Clientes contatados");
    case "respostas":
      return t("Respostas");
    case "propostas":
      return t("Propostas");
    default:
      return chave;
  }
}

import type { FormatoDoCriativo, StatusDoCriativo } from "@/lib/marketing/criativos";

export function rotuloDoStatusDoCriativo(t: Traduz, s: StatusDoCriativo): string {
  switch (s) {
    case "planejado":
      return t("Planejado");
    case "ativo":
      return t("Ativo");
    case "pausado":
      return t("Pausado");
    case "encerrado":
      return t("Encerrado");
  }
}

export const COR_DO_STATUS_DO_CRIATIVO: Record<StatusDoCriativo, CorDaOpcao> = {
  planejado: "blue",
  ativo: "green",
  pausado: "orange",
  encerrado: "gray",
};

export function rotuloDoFormato(t: Traduz, f: FormatoDoCriativo): string {
  switch (f) {
    case "imagem":
      return t("Imagem");
    case "video":
      return t("Vídeo");
    case "carrossel":
      return t("Carrossel");
    case "outro":
      return t("Outro");
  }
}

/** "11/10 | Investido: R$ 138,52 | 62 Leads | CPL R$ 2,23" — o estado atual em uma linha. */
export function textoDoEstado(
  t: Traduz,
  e: { ate: string; investido: number; leads: number } | null | undefined,
): string {
  if (!e) return "—";
  const [, mes, dia] = e.ate.split("-");
  const reais = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ");
  const cpl = e.leads > 0 && e.investido > 0 ? reais(e.investido / e.leads) : "—";
  return `${dia}/${mes} | ${t("Investido")}: ${reais(e.investido)} | ${e.leads} ${t("Leads")} | ${t("CPL")} ${cpl}`;
}

import type { MeioDaAbordagem } from "@/lib/marketing/abordagens";

export function rotuloDoMeio(t: Traduz, m: MeioDaAbordagem): string {
  switch (m) {
    case "whatsapp":
      return t("WhatsApp");
    case "ligacao":
      return t("Ligação");
    case "email":
      return t("E-mail");
    case "linkedin":
      return t("LinkedIn");
    case "instagram":
      return t("Instagram");
    case "presencial":
      return t("Presencial");
    case "outro":
      return t("Outro");
  }
}
