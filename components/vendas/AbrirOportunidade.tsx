"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { DialogoDaVenda, type DadosDaVenda } from "@/components/vendas/DialogoDaVenda";
import { apiClient } from "@/lib/api/client";
import type { Venda } from "@/lib/vendas";

/**
 * Abre a oportunidade (o pop-up de sempre) por cima da tela em que o operador está,
 * em vez de levá-lo à página antiga do funil. Fechar volta para onde ele estava.
 */
export function AbrirOportunidade({
  leadId,
  aoFechar,
}: {
  leadId: string;
  aoFechar: () => void;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["venda-da-oportunidade", leadId],
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?lead=${leadId}`)).data
        .vendas[0] ?? null,
  });
  const venda = q.data;

  React.useEffect(() => {
    if (q.isError) {
      showApiError(q.error);
      aoFechar();
    }
  }, [q.isError, q.error, aoFechar]);

  if (!venda) return null;
  return (
    <DialogoDaVenda
      key={venda.id}
      modo="oportunidade"
      venda={venda}
      contatoInicial={{ contact_id: venda.contact_id, nome: venda.cliente?.nome ?? "" }}
      clientes={[]}
      aoFechar={aoFechar}
      aoSalvar={async (v: DadosDaVenda) => {
        try {
          const { id: vid, contact_id: _c, ...resto } = v;
          await apiClient.patch(`/api/v1/vendas/${vid ?? venda.id}`, resto);
          await qc.invalidateQueries();
          aoFechar();
          return true;
        } catch (e) {
          showApiError(e);
          return false;
        }
      }}
    />
  );
}
