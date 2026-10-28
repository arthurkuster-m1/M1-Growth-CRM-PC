"use client";

import { useT } from "@/hooks/i18n/useT";
import { LinhaDoTempoVisual } from "@/components/timeline/LinhaDoTempoVisual";
import type { TimelineItemView } from "@/lib/types/contacts";

interface Props {
  itens: TimelineItemView[];
  /** Ids que chegaram por realtime nesta sessão — ganham a marca "agora". */
  chegouAoVivo: Set<string>;
  isLoading: boolean;
  isError: boolean;
}

/**
 * A timeline de UM negócio (Atividade da oportunidade, ficha e dossiê). O desenho é o mesmo do
 * Histórico da ficha do cliente — `LinhaDoTempoVisual` —, porque as duas leem a mesma tabela.
 */
export function LeadTimeline({ itens, chegouAoVivo, isLoading, isError }: Props) {
  const t = useT();

  if (isLoading) {
    return <p className="py-4 text-xs text-text-muted">{t("Carregando a linha do tempo…")}</p>;
  }
  // TRÊS estados, não dois: "não consegui ler" é diferente de "não há nada".
  // Transformar erro em lista vazia diria ao usuário que o lead não tem
  // história, quando o que houve foi uma falha de leitura.
  if (isError) {
    return (
      <p className="py-4 text-xs text-warning-fg">
        {t("Não consegui carregar a linha do tempo. Tente de novo em instantes.")}
      </p>
    );
  }
  if (itens.length === 0) {
    return (
      <p className="py-4 text-xs text-text-muted">
        {t("Nada aconteceu ainda.")}
      </p>
    );
  }

  return <LinhaDoTempoVisual itens={itens} aoVivo={chegouAoVivo} />;
}
