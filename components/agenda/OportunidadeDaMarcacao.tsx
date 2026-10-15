"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { SeletorEmPopup } from "@/components/ui/SeletorEmPopup";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { nomeDaVenda, type Venda } from "@/lib/vendas";

/**
 * A OPORTUNIDADE do compromisso. O compromisso pertence a uma oportunidade (e, por ela, à
 * campanha e às métricas); reunião de atendimento ao cliente fica só no contato ("sem
 * oportunidade"). Com uma única oportunidade aberta ela já vem escolhida; com várias, vem a mais
 * recente — visível e trocável, para ninguém marcar na oportunidade errada sem ver.
 */
export function OportunidadeDaMarcacao({
  contactId,
  leadId,
  aoMudar,
}: {
  contactId: string;
  leadId: string;
  aoMudar: (leadId: string) => void;
}) {
  const t = useT();
  const consulta = useQuery({
    queryKey: ["agenda", "oportunidades-do-contato", contactId],
    enabled: Boolean(contactId),
    staleTime: 15_000,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?contato=${contactId}`)).data
        .vendas,
  });
  const abertas = (consulta.data ?? [])
    .filter((v) => v.lead_status === "open" && v.lead_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  // O padrão: a única aberta, ou a mais recente; se a escolhida não é deste cliente, troca.
  useEffect(() => {
    if (!consulta.isSuccess) return;
    if (leadId && abertas.some((v) => v.lead_id === leadId)) return;
    const padrao = abertas[0]?.lead_id ?? "";
    if (padrao !== leadId) aoMudar(padrao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta.isSuccess, contactId, abertas.length]);

  if (!contactId) return null;
  return (
    <div className="grid gap-1" data-testid="oportunidade-da-marcacao">
      <p className="text-sm font-medium">{t("Oportunidade")}</p>
      <SeletorEmPopup
        rotulo={t("Oportunidade do compromisso")}
        valor={leadId}
        rotuloVazio={t("Sem oportunidade (atendimento ao cliente)")}
        opcoes={abertas.map((v) => ({
          id: v.lead_id!,
          rotulo: `${nomeDaVenda(v) || t("Oportunidade")}${v.funil ? ` · ${v.funil}` : ""}${v.etapa ? ` › ${v.etapa}` : ""}`,
        }))}
        aoEscolher={aoMudar}
      />
      <p className="text-xs text-muted-foreground">
        {t("O compromisso entra nas métricas da campanha desta oportunidade.")}
      </p>
    </div>
  );
}
