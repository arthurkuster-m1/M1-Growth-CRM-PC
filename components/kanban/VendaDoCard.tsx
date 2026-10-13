"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { DialogoDaVenda, type DadosDaVenda } from "@/components/vendas/DialogoDaVenda";
import { apiClient } from "@/lib/api/client";
import type { Lead } from "@/lib/types/leads";
import type { Venda } from "@/lib/vendas";

/**
 * O CARD DO FUNIL É A VENDA. Abrir um card abre a venda dele: produtos, valor, parcelas, status,
 * previsão de fechamento e descrição, e a etapa no funil. O que é da pessoa (cadastro, atendimento,
 * linha do tempo) está na ficha do lead, a um clique.
 *
 * `semVenda` é o que se mostra quando o card não tem venda (negócio antigo, sem contato): o
 * dossiê de antes.
 */
export function VendaDoCard({
  lead,
  etapas,
  aoFechar,
  semVenda,
}: {
  lead: Lead;
  etapas: Array<{ id: string; name: string; is_won: boolean; is_lost: boolean }>;
  aoFechar: () => void;
  semVenda: () => React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const contactId = lead.contact_id;
  const consulta = useQuery({
    queryKey: ["vendas-do-cliente", contactId],
    enabled: Boolean(contactId),
    retry: false,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?contato=${contactId}`)).data
        .vendas,
  });

  if (!contactId || consulta.isError) return <>{semVenda()}</>;
  if (consulta.isLoading) return null;
  const venda = (consulta.data ?? [])
    .filter((v) => v.lead_id === lead.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  if (!venda) return <>{semVenda()}</>;

  async function recarregar() {
    await queryClient.invalidateQueries();
  }

  async function salvar(v: DadosDaVenda) {
    try {
      const { id, contact_id: _contato, ...resto } = v;
      await apiClient.patch(`/api/v1/vendas/${id ?? venda!.id}`, resto);
      // Venda fechada: o card ganha (a venda já existe, o gatilho não cria outra).
      if (resto.status === "comprometida" && lead.status === "open") {
        await apiClient.post(`/api/v1/leads/${lead.id}/win`, {});
      }
      await recarregar();
    } catch (e) {
      showApiError(e);
    }
  }

  async function moverEtapa(etapaId: string) {
    try {
      await apiClient.post(`/api/v1/leads/${lead.id}/move`, {
        stage_id: etapaId,
        position_in_stage: Date.now(),
        expected_updated_at: lead.updated_at,
      });
      await recarregar();
    } catch (e) {
      showApiError(e);
    }
  }

  const abertas = etapas.filter((e) => !e.is_won && !e.is_lost);
  const atual = etapas.find((e) => e.id === lead.stage_id);
  const lista = atual && !abertas.some((e) => e.id === atual.id) ? [atual, ...abertas] : abertas;

  return (
    <DialogoDaVenda
      key={venda.id}
      venda={venda}
      contatoInicial={{ contact_id: contactId, nome: venda.cliente?.nome ?? lead.title }}
      clientes={[]}
      titulo={lead.title}
      aoFechar={aoFechar}
      aoSalvar={salvar}
      negocio={{
        etapas: lista.map((e) => ({ id: e.id, nome: e.name })),
        etapaId: lead.stage_id,
        aoMoverEtapa: moverEtapa,
        fichaHref: `/app/contacts/${contactId}`,
      }}
    />
  );
}
