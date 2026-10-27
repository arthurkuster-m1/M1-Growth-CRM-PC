"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { DialogoDaVenda, type DadosDaVenda } from "@/components/vendas/DialogoDaVenda";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { EVENTO_PAGAMENTO_PEDIDO } from "@/lib/vendas-cliente";
import type { StatusDaVenda, Venda } from "@/lib/vendas";

/**
 * Abre a venda da oportunidade que tentou virar Comprou sem pagamento, para registrar ao menos o
 * sinal. Ao salvar com uma parcela recebida, o banco leva a oportunidade a Comprou sozinho.
 */
export function PagamentoPedidoDaOportunidade() {
  const t = useT();
  const queryClient = useQueryClient();
  const [leadId, setLeadId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusDaVenda | undefined>(undefined);

  useEffect(() => {
    const ouvir = (e: Event) => {
      const detalhe = (e as CustomEvent<{ leadId?: string; status?: StatusDaVenda }>).detail;
      if (detalhe?.leadId) {
        setStatus(detalhe.status);
        setLeadId(detalhe.leadId);
      }
    };
    window.addEventListener(EVENTO_PAGAMENTO_PEDIDO, ouvir);
    return () => window.removeEventListener(EVENTO_PAGAMENTO_PEDIDO, ouvir);
  }, []);

  const consulta = useQuery({
    queryKey: ["venda-da-oportunidade", leadId],
    enabled: leadId !== null,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?lead=${leadId}`)).data
        .vendas[0] ?? null,
  });

  if (!leadId || !consulta.data) return null;
  const venda = consulta.data;

  return (
    <DialogoDaVenda
      key={venda.id}
      venda={venda}
      contatoInicial={{ contact_id: venda.contact_id, nome: venda.cliente?.nome ?? "" }}
      clientes={[]}
      modo="venda"
      abrirComStatus={status}
      titulo={t("Registre o pagamento para marcar como Comprou")}
      aoFechar={() => setLeadId(null)}
      aoSalvar={async (v: DadosDaVenda) => {
        try {
          const { id, contact_id: _c, ...resto } = v;
          await apiClient.patch(`/api/v1/vendas/${id ?? venda.id}`, resto);
          await queryClient.invalidateQueries();
          setLeadId(null);
          return true;
        } catch (e) {
          showApiError(e);
          return false;
        }
      }}
    />
  );
}
