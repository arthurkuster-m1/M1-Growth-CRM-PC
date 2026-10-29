"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { BlocoRecolhivel } from "@/components/agenda/BlocoRecolhivel";
import { CardDaOportunidade } from "@/components/contacts/ficha/OportunidadesDoLead";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { Plus } from "@/lib/ui/icons";
import { nomeDaVenda, type StatusDaVenda, type Venda } from "@/lib/vendas";

const reais = (c: number) => moedaDoNumero(c / 100);

const ROTULO_DA_VENDA: Record<StatusDaVenda, string> = {
  interesse: "Possível venda",
  comprometida: "Comprometido",
  concluida: "Pago",
  recorrencia_ativa: "Recorrência ativa",
  recorrencia_encerrada: "Recorrência encerrada",
  cancelada: "Cancelado",
};
const COR_DA_VENDA: Record<StatusDaVenda, CorDaOpcao> = {
  interesse: "blue",
  comprometida: "yellow",
  concluida: "green",
  recorrencia_ativa: "blue",
  recorrencia_encerrada: "brown",
  cancelada: "gray",
};
const COR_NO_FUNIL: Record<string, CorDaOpcao> = { open: "blue", won: "green", lost: "gray" };

/**
 * OPORTUNIDADES E VENDAS num toggle só: uma linha por oportunidade (a venda é a mesma coisa), com o
 * nome, o funil, o status no funil, o valor e o status da venda. Clicar abre a oportunidade.
 */
export function OportunidadesEVendasDoLead({
  contactId,
  podeEditar,
}: {
  contactId: string;
  podeEditar: boolean;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const consulta = useQuery({
    queryKey: ["vendas-do-cliente", contactId],
    retry: false,
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?contato=${contactId}`))
        .data.vendas,
  });
  const lista = consulta.data ?? [];

  async function nova() {
    const base = lista[0];
    if (!base) return;
    setCriando(true);
    try {
      const r = await apiClient.post<{ data: { lead_id: string } }>(
        `/api/v1/leads/${base.id}/venda-adicional`,
        {},
      );
      await queryClient.invalidateQueries({ queryKey: ["vendas-do-cliente", contactId] });
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setAbertaId(r.data.lead_id);
    } catch (e) {
      showApiError(e);
    } finally {
      setCriando(false);
    }
  }

  return (
    <BlocoRecolhivel titulo={t("Oportunidades e vendas")}>
      {consulta.isError ? (
        <p className="text-sm text-muted-foreground">
          {t("Você não tem permissão para ver as oportunidades deste cliente.")}
        </p>
      ) : consulta.isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-secondary" />
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("Este lead ainda não tem nenhuma oportunidade.")}
        </p>
      ) : (
        <ul className="grid gap-2">
          {lista.map((v) => {
            const situacao = v.lead_status ?? "open";
            return (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => setAbertaId(v.id)}
                  className="grid w-full min-w-0 gap-2 rounded-xl border bg-card px-3 py-2.5 text-left hover:bg-secondary/50 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {nomeDaVenda(v) || t("Oportunidade")}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {v.funil ?? "—"}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {v.etapa ? (
                      <Etiqueta ponto cor={COR_NO_FUNIL[situacao] ?? "blue"}>
                        {v.etapa}
                      </Etiqueta>
                    ) : null}
                  </span>
                  <span className="text-sm font-semibold tabular-nums sm:text-right">
                    {reais(v.amount_cents)}
                  </span>
                  <span className="sm:text-right">
                    <Etiqueta ponto cor={COR_DA_VENDA[v.status] ?? "gray"}>
                      {t(ROTULO_DA_VENDA[v.status] ?? v.status)}
                    </Etiqueta>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {podeEditar && lista.length > 0 ? (
        <button
          type="button"
          disabled={criando}
          onClick={() => void nova()}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-medium hover:bg-secondary disabled:opacity-60"
        >
          <Plus size={14} weight="bold" aria-hidden />
          {t("Nova oportunidade")}
        </button>
      ) : null}
      {abertaId ? (
        <CardDaOportunidade leadId={abertaId} aoFechar={() => setAbertaId(null)} />
      ) : null}
    </BlocoRecolhivel>
  );
}
