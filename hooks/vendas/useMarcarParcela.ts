"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type { StatusDaVenda, Venda } from "@/lib/vendas";

/**
 * Marca (ou desmarca) UMA parcela como recebida. Todas recebidas = venda concluída; desmarcar uma
 * de venda concluída volta para "comprometida". Depois relê as telas que mostram dinheiro.
 */
export function useMarcarParcela() {
  const queryClient = useQueryClient();
  return useCallback(
    async (v: Venda, numero: number, recebida: boolean): Promise<boolean> => {
      const hoje = new Date().toISOString().slice(0, 10);
      const pagamentos = (v.parcelas ?? []).map((p) => ({
        number: p.number,
        due_on: p.due_on,
        amount_cents: p.amount_cents,
        status: (p.number === numero ? (recebida ? "recebida" : "prevista") : p.status) as
          | "prevista"
          | "recebida"
          | "cancelada",
        paid_on: p.number === numero ? (recebida ? hoje : null) : (p.paid_on ?? null),
      }));
      const ativas = pagamentos.filter((p) => p.status !== "cancelada");
      const todasRecebidas = ativas.length > 0 && ativas.every((p) => p.status === "recebida");
      const status: StatusDaVenda | undefined = todasRecebidas
        ? "concluida"
        : v.status === "concluida"
          ? "comprometida"
          : undefined;
      try {
        await apiClient.patch(`/api/v1/vendas/${v.id}`, {
          pagamentos,
          ...(status && status !== v.status
            ? { status, paid_on: status === "concluida" ? hoje : null }
            : {}),
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["vendas"] }),
          queryClient.invalidateQueries({ queryKey: ["vendas-do-cliente", v.contact_id] }),
          queryClient.invalidateQueries({ queryKey: ["clientes"] }),
        ]);
        return true;
      } catch (e) {
        showApiError(e);
        return false;
      }
    },
    [queryClient],
  );
}
