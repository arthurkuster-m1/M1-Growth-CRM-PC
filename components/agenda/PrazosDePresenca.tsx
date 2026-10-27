"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { showApiError } from "@/components/feedback/ApiErrorToast";
type Config = {
  confirmation_delay_minutes: number;
  unknown_protection_minutes: number;
  pending_expires_after_minutes: number;
};
export function PrazosDePresenca({ podeEditar }: { podeEditar: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Config | null>(null);
  const query = useQuery({
    queryKey: ["agenda", "configuracao"],
    queryFn: async () =>
      (await apiClient.get<{ data: Config }>("/api/v1/agenda/configuracao")).data,
  });
  const mutation = useMutation({
    mutationFn: (value: Config) => apiClient.patch("/api/v1/agenda/configuracao", value),
    onSuccess: () => {
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ["agenda", "configuracao"] });
    },
    onError: showApiError,
  });
  const value = draft ?? query.data;
  return (
    <section className="space-y-4 rounded-xl border p-4">
      <h2 className="font-semibold">{t("Registro do resultado da reunião")}</h2>
      <p className="text-sm text-text-muted">
        {t(
          "Isto vale para DEPOIS da reunião. Quando uma reunião termina, ninguém sabe ainda se o cliente compareceu. O sistema então avisa a equipe, na Central, para registrar o resultado: compareceu e comprou, compareceu e não comprou, ou não compareceu. Aqui você escolhe quanto tempo ele espera para avisar e por quanto tempo segura as cobranças automáticas.",
        )}
      </p>
      {query.isError ? (
        <Button variant="outline" onClick={() => void query.refetch()}>
          {t("Tentar novamente")}
        </Button>
      ) : value ? (
        <>
          <div className="space-y-1">
            <label className="block text-sm font-medium">
              {t("Avisar a equipe quantos minutos depois que a reunião terminar")}
              <input
                aria-label={t("Pedir confirmação após o fim (minutos)")}
                className="ml-2 w-24 rounded-xl border p-2"
                type="number"
                min={1}
                max={10080}
                disabled={!podeEditar}
                value={value.confirmation_delay_minutes}
                onChange={(e) =>
                  setDraft({ ...value, confirmation_delay_minutes: Number(e.target.value) })
                }
              />
            </label>
            <p className="text-sm text-text-muted">
              {t(
                "Exemplo: com 10 minutos, uma reunião que termina às 15h gera o aviso às 15h10 para quem atende registrar o resultado.",
              )}
            </p>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">
              {t("Segurar cobranças automáticas por quantos minutos depois do fim")}
              <input
                aria-label={t("Proteger de cobranças por silêncio após o fim (minutos)")}
                className="ml-2 w-24 rounded-xl border p-2"
                type="number"
                min={1}
                max={10080}
                disabled={!podeEditar}
                value={value.unknown_protection_minutes}
                onChange={(e) =>
                  setDraft({ ...value, unknown_protection_minutes: Number(e.target.value) })
                }
              />
            </label>
            <p className="text-sm text-text-muted">
              {t(
                "Enquanto ninguém registra o resultado, o sistema não manda follow-up nem cobrança automática para esse cliente — ele pode ter comparecido. Passado esse prazo, o sistema deixa de segurar, mas o aviso continua na Central até alguém registrar. Precisa ser maior ou igual ao prazo de cima. 1440 minutos = 24 horas.",
              )}
            </p>
          </div>
          {podeEditar ? (
            <Button disabled={!draft || mutation.isPending} onClick={() => mutation.mutate(value)}>
              {t("Salvar prazos")}
            </Button>
          ) : null}
          {mutation.isSuccess && !draft ? <p role="status">{t("Prazos salvos.")}</p> : null}
        </>
      ) : (
        <p>{t("Carregando…")}</p>
      )}
    </section>
  );
}
