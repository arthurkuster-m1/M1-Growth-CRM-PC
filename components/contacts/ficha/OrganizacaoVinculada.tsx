"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { SeletorEmPopup } from "@/components/ui/SeletorEmPopup";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

interface Dados {
  permitido: boolean;
  vinculada?: string | null;
  opcoes?: Array<{ id: string; nome: string }>;
}

/**
 * "Organização vinculada" — só para o super-admin da agência. Liga este contato (o cliente no CRM da
 * agência) à organização dele: as tarefas da agência para este contato passam a aparecer também na
 * empresa do cliente (marcadas "da agência" no cronograma), e as marcadas "da agência" lá aparecem aqui.
 */
export function OrganizacaoVinculada({ contactId }: { contactId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const chave = ["organizacao-vinculada", contactId];
  const consulta = useQuery({
    queryKey: chave,
    staleTime: 30_000,
    queryFn: async () =>
      (await apiClient.get<{ data: Dados }>(`/api/v1/contacts/${contactId}/organizacao-vinculada`)).data,
  });
  const d = consulta.data;
  if (!d?.permitido) return null;

  async function mudar(id: string) {
    try {
      await apiClient.put(`/api/v1/contacts/${contactId}/organizacao-vinculada`, {
        organization_id: id === "" ? null : id,
      });
      await qc.invalidateQueries({ queryKey: chave });
      toast.success(id === "" ? t("Vínculo removido.") : t("Organização vinculada."));
    } catch (e) {
      showApiError(e);
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{t("Organização vinculada (cliente da agência)")}</p>
      <SeletorEmPopup
        rotulo={t("Organização vinculada")}
        valor={d.vinculada ?? ""}
        placeholder={t("Nenhuma")}
        rotuloVazio={t("Nenhuma")}
        opcoes={(d.opcoes ?? []).map((o) => ({ id: o.id, rotulo: o.nome }))}
        aoEscolher={(id) => void mudar(id)}
      />
      <p className="text-xs text-muted-foreground">
        {t("As tarefas da agência deste contato ficam espelhadas na empresa dele, como tarefas da agência.")}
      </p>
    </div>
  );
}
