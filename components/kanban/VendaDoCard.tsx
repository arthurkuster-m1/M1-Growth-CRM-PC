"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { LoseLeadDialog } from "@/components/kanban/LoseLeadDialog";
import { DialogoDaVenda, type DadosDaVenda } from "@/components/vendas/DialogoDaVenda";
import { apiClient } from "@/lib/api/client";
import type { DadosDoLead } from "@/components/leads/FichaDoLead";
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
  const [perdendo, setPerdendo] = useState(false);
  const contactId = lead.contact_id;
  const consulta = useQuery({
    queryKey: ["vendas-do-cliente", contactId],
    enabled: Boolean(contactId),
    retry: false,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?contato=${contactId}`)).data
        .vendas,
  });

  // O que era do negócio (responsável e campos do funil) mora agora na venda.
  const dadosDoNegocio = useQuery({
    queryKey: ["ficha-do-lead", lead.id],
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: DadosDoLead }>(`/api/v1/leads/${lead.id}/origem`)).data,
  });
  if (!contactId || consulta.isError) return <>{semVenda()}</>;
  if (consulta.isLoading || dadosDoNegocio.isLoading) return null;
  const venda = (consulta.data ?? [])
    .filter((v) => v.lead_id === lead.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  if (!venda) return <>{semVenda()}</>;

  async function recarregar() {
    await queryClient.invalidateQueries();
  }

  async function salvar(v: DadosDaVenda): Promise<boolean> {
    try {
      const { id, contact_id: _contato, ...resto } = v;
      // A primeira parcela recebida leva a oportunidade a Comprou (o banco faz).
      await apiClient.patch(`/api/v1/vendas/${id ?? venda!.id}`, resto);
      await recarregar();
      return true;
    } catch (e) {
      showApiError(e);
      return false;
    }
  }

  async function moverEtapa(etapaId: string) {
    const alvo = etapas.find((e) => e.id === etapaId);
    // Etapa de perda pede o motivo; a de ganho fecha como venda. A etapa É o resultado.
    if (alvo?.is_lost) {
      setPerdendo(true);
      return;
    }
    try {
      if (alvo?.is_won && lead.status === "open") {
        await apiClient.post(`/api/v1/leads/${lead.id}/win`, {});
        await recarregar();
        return;
      }
      await apiClient.post(`/api/v1/leads/${lead.id}/move`, {
        stage_id: etapaId,
        position_in_stage: Date.now(),
        expected_updated_at: lead.updated_at,
      });
      await recarregar();
    } catch (e) {
      // Comprou sem pagamento: a venda já está aberta; o aviso diz o que falta.
      showApiError(e);
    }
  }

  // Todas as etapas: a etapa diz também se a venda deu certo ou não.
  const lista = etapas;

  return (
    <>
    {perdendo ? (
      <LoseLeadDialog
        open
        leadId={lead.id}
        pipelineId={lead.pipeline_id}
        onOpenChange={(aberta) => {
          if (aberta) return;
          setPerdendo(false);
          void recarregar();
        }}
      />
    ) : null}
    <DialogoDaVenda
      key={venda.id}
      venda={venda}
      contatoInicial={{ contact_id: contactId, nome: venda.cliente?.nome ?? lead.title }}
      clientes={[]}
      titulo={lead.title}
      aoFechar={aoFechar}
      aoSalvar={salvar}
      negocio={{
        etapas: lista.map((e) => ({
          id: e.id,
          nome: e.is_won ? `${e.name} ✓` : e.is_lost ? `${e.name} ✕` : e.name,
        })),
        etapaId: lead.stage_id,
        aoMoverEtapa: moverEtapa,
        fichaHref: `/app/contacts/${contactId}`,
        responsavelId: dadosDoNegocio.data?.sistema.dono_id ?? null,
        camposDoFunil: dadosDoNegocio.data?.negocio.field_defs ?? [],
        camposValores: dadosDoNegocio.data?.custom_fields ?? {},
        aoSalvarExtras: async (x) => {
          try {
            if (Object.keys(x).length > 0) await apiClient.patch(`/api/v1/leads/${lead.id}`, x);
            await recarregar();
          } catch (e) {
            showApiError(e);
          }
        },
      }}
    />
    </>
  );
}
