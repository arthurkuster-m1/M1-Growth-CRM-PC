"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { DialogoDaVenda, type DadosDaVenda } from "@/components/vendas/DialogoDaVenda";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { Venda } from "@/lib/vendas";

/**
 * O POP-UP DE LEAD GANHO: quando o lead é movido para Ganho, o banco já efetiva a venda
 * (para nada se perder); este pop-up pede o que falta — produtos, valor real, forma de pagamento
 * e parcelas — e registra a venda certinha. Se a pessoa fechar, a venda fica marcada "a detalhar"
 * na página de Vendas.
 */
export function FinalizarVenda({
  contatoId,
  nome,
  leadId,
  aoFechar,
}: {
  contatoId: string;
  nome: string;
  leadId: string;
  aoFechar: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const consulta = useQuery({
    queryKey: ["vendas-do-contato", contatoId, leadId],
    // A venda nasce por trigger no mesmo instante da mudança; relê uma vez se ainda não apareceu.
    retry: 2,
    retryDelay: 800,
    queryFn: async () => {
      const r = await apiClient.get<{ data: { vendas: Venda[] } }>(
        `/api/v1/vendas?contato=${contatoId}`,
      );
      const daqui = r.data.vendas.filter(
        (v) => v.lead_id === leadId && (v.status === "comprometida" || v.status === "concluida"),
      );
      const venda = daqui.find((v) => v.needs_details) ?? daqui[0];
      if (!venda) throw new Error("venda ainda não criada");
      return venda;
    },
  });

  if (consulta.isLoading) return null;
  // Sem venda (sem permissão de ver vendas, por exemplo): o pop-up não aparece.
  if (!consulta.data) {
    return null;
  }

  async function salvar(v: DadosDaVenda) {
    try {
      const { id, contact_id: _c, ...resto } = v;
      await apiClient.patch(`/api/v1/vendas/${id}`, resto);
      await queryClient.invalidateQueries({ queryKey: ["vendas"] });
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e) {
      showApiError(e);
    }
  }

  return (
    <DialogoDaVenda
      venda={consulta.data}
      contatoInicial={{ contact_id: contatoId, nome }}
      clientes={[]}
      titulo={`${t("Finalizar venda")} — ${nome}`}
      aoFechar={aoFechar}
      aoSalvar={salvar}
    />
  );
}
