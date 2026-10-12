"use client";

import { useQuery } from "@tanstack/react-query";

import { FichaDoLead } from "@/components/leads/FichaDoLead";
import { QualificacaoDoLead } from "@/components/leads/QualificacaoDoLead";
import { VendasDoCliente } from "@/components/vendas/VendasDoCliente";
import { apiClient } from "@/lib/api/client";

/** A ficha do contato: a ficha única de cada lead (negócio) dele, uma abaixo da outra. */
export function FichasDoContato({ contactId }: { contactId: string }) {
  const consulta = useQuery({
    queryKey: ["qualificacao-do-lead", contactId],
    queryFn: async () =>
      (
        await apiClient.get<{
          data: { funis: Array<{ lead_id: string; funil: string; etapa: string }> };
        }>(`/api/v1/contacts/${contactId}/qualificacao`)
      ).data,
    staleTime: 15_000,
  });
  const funis = consulta.data?.funis ?? [];
  if (consulta.isLoading) return <div className="h-24 animate-pulse rounded-lg bg-secondary" />;
  if (funis.length === 0) {
    return (
      <div className="grid gap-3">
        <QualificacaoDoLead contactId={contactId} />
        <VendasDoCliente contactId={contactId} />
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {funis.map((f) => (
        <div key={f.lead_id} className="rounded-xl border p-3">
          <p className="mb-1 text-sm font-semibold">
            {f.funil} <span className="font-normal text-muted-foreground">· {f.etapa}</span>
          </p>
          <FichaDoLead leadId={f.lead_id} />
        </div>
      ))}
    </div>
  );
}
