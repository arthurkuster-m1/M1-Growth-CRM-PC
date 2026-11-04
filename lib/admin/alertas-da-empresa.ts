import type { TenantHealthResponse } from "@/app/api/v1/admin/tenants/[id]/health/route";
import type { TenantCounts, TenantOrganization } from "@/hooks/useTenantDetail";

/**
 * OS ALERTAS da Visão Geral da empresa: o que, na situação dela agora, pede a atenção de quem
 * opera a agência. Função pura (sem tela): cada regra é uma frase com gravidade, e a ordem é a
 * da gravidade (o que para a empresa primeiro).
 *
 * Fontes: o cadastro (suspensão, onboarding), os volumes (LGPD), o medidor de saúde (WhatsApp,
 * orçamento de IA) e a mensalidade do lead da agência. Nada daqui é gravado: é derivado a cada leitura.
 */
export type GravidadeDoAlerta = "critico" | "atencao" | "info";

export interface AlertaDaEmpresa {
  id: string;
  gravidade: GravidadeDoAlerta;
  /** Português; quem renderiza passa por `t()`. */
  texto: string;
  /** Complemento já formatado (motivo, data), sem tradução. */
  detalhe?: string;
}

const ORDEM: Record<GravidadeDoAlerta, number> = { critico: 0, atencao: 1, info: 2 };

export function alertasDaEmpresa(entrada: {
  organization: Pick<TenantOrganization, "status" | "suspended_reason" | "onboarded_at">;
  counts: Pick<TenantCounts, "lgpd_requests_pending">;
  health?: Pick<TenantHealthResponse, "waha" | "ai"> | null;
  mensalidade?: { status: "pago" | "pendente" | null; proximo_pagamento: string | null } | null;
  /** Formata `AAAA-MM-DD` na língua de quem olha. */
  formatarDia: (iso: string) => string;
}): AlertaDaEmpresa[] {
  const { organization: org, counts, health, mensalidade, formatarDia } = entrada;
  const lista: AlertaDaEmpresa[] = [];

  if (org.status === "suspended") {
    lista.push({
      id: "suspensa",
      gravidade: "critico",
      texto: "A empresa está suspensa: ninguém dela consegue usar o sistema.",
      detalhe: org.suspended_reason ?? undefined,
    });
  }
  if (org.status === "redacted") {
    lista.push({
      id: "anonimizada",
      gravidade: "critico",
      texto: "Empresa anonimizada (LGPD): ações de gestão não estão disponíveis.",
    });
  }
  if (mensalidade?.status === "pendente") {
    lista.push({
      id: "mensalidade",
      gravidade: "atencao",
      texto: "Mensalidade pendente.",
      detalhe: mensalidade.proximo_pagamento
        ? formatarDia(mensalidade.proximo_pagamento)
        : undefined,
    });
  }
  if (!org.onboarded_at && org.status === "active") {
    lista.push({
      id: "onboarding",
      gravidade: "atencao",
      texto: "O onboarding ainda não foi finalizado.",
    });
  }
  if (counts.lgpd_requests_pending > 0) {
    lista.push({
      id: "lgpd",
      gravidade: "atencao",
      texto: "Há solicitações de LGPD em aberto.",
      detalhe: String(counts.lgpd_requests_pending),
    });
  }
  if (health) {
    if (health.waha.overall_status === "critical") {
      lista.push({
        id: "whatsapp",
        gravidade: "critico",
        texto: "O WhatsApp está desconectado ou com falha.",
      });
    } else if (health.waha.overall_status === "warning") {
      lista.push({
        id: "whatsapp",
        gravidade: "atencao",
        texto: "Nenhum WhatsApp conectado.",
      });
    }
    const uso = health.ai.percent_used;
    if (uso !== null && uso >= 100) {
      lista.push({
        id: "ia",
        gravidade: "critico",
        texto: "O orçamento de IA acabou.",
        detalhe: `${uso}%`,
      });
    } else if (uso !== null && uso >= 80) {
      lista.push({
        id: "ia",
        gravidade: "atencao",
        texto: "O orçamento de IA está perto do limite.",
        detalhe: `${uso}%`,
      });
    }
  }
  return lista.sort((a, b) => ORDEM[a.gravidade] - ORDEM[b.gravidade]);
}
