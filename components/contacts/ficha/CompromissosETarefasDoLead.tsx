"use client";

import { useQuery } from "@tanstack/react-query";

import { BlocoRecolhivel } from "@/components/agenda/BlocoRecolhivel";
import {
  CompromissosDaOportunidade,
  TarefasDaOportunidade,
} from "@/components/vendas/BlocosDaOportunidade";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { nomeDaVenda, type Venda } from "@/lib/vendas";

/**
 * Os blocos Compromissos e Tarefas da oportunidade, repetidos na Visão geral do lead (como
 * toggles). Cada oportunidade em aberto do lead tem os seus; com mais de uma, o título leva o nome
 * dela.
 */
export function CompromissosETarefasDoLead({
  contactId,
  podeEditar,
}: {
  contactId: string;
  podeEditar: boolean;
}) {
  const t = useT();
  const consulta = useQuery({
    queryKey: ["vendas-do-cliente", contactId],
    retry: false,
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?contato=${contactId}`))
        .data.vendas,
  });
  const abertas = (consulta.data ?? []).filter(
    (v) => (v.lead_status ?? "open") === "open" && v.lead_id,
  );
  if (abertas.length === 0) return null;
  const varias = abertas.length > 1;
  return (
    <>
      {abertas.map((v) => {
        const sufixo = varias ? ` · ${nomeDaVenda(v) || t("Oportunidade")}` : "";
        return (
          <div key={v.id} className="grid gap-4">
            <BlocoRecolhivel titulo={`${t("Compromissos")}${sufixo}`}>
              <CompromissosDaOportunidade
                contactId={contactId}
                leadId={v.lead_id!}
                vendeu={false}
                podeEditar={podeEditar}
              />
            </BlocoRecolhivel>
            <BlocoRecolhivel titulo={`${t("Tarefas")}${sufixo}`}>
              <TarefasDaOportunidade
                contactId={contactId}
                leadId={v.lead_id!}
                podeEditar={podeEditar}
              />
            </BlocoRecolhivel>
          </div>
        );
      })}
    </>
  );
}
