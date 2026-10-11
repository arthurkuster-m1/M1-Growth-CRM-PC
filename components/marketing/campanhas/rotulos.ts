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
