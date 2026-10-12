"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { SeletorDeData } from "@/components/marketing/cronograma/SeletorDeData";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { useActiveOrg, useUser } from "@/hooks/auth/AuthProvider";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { ROLE_RANK } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

interface Qualificacao {
  entrou_em: string;
  primeira_abordagem: string | null;
  primeira_compra: string | null;
  is_mql: boolean;
  mql_at: string | null;
  funis: Array<{
    lead_id: string;
    status: string;
    entrou_em: string;
    funil: string;
    etapa: string;
  }>;
}

/**
 * A QUALIFICAÇÃO do lead (que é o contato, um por telefone): quando entrou, quando foi
 * abordado pela primeira vez, se é MQL e em quais funis está — com a etapa em cada um.
 */
export function QualificacaoDoLead({
  contactId,
  semTitulo = false,
}: {
  contactId: string | null;
  semTitulo?: boolean;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const queryClient = useQueryClient();
  const user = useUser();
  const org = useActiveOrg();
  const pode = user.is_platform_admin || (org && ROLE_RANK[org.role] >= ROLE_RANK.agent) || false;
  const chave = ["qualificacao-do-lead", contactId] as const;

  const consulta = useQuery({
    queryKey: chave,
    enabled: !!contactId,
    queryFn: async () =>
      (await apiClient.get<{ data: Qualificacao }>(`/api/v1/contacts/${contactId}/qualificacao`))
        .data,
    staleTime: 15_000,
  });
  const salvarCompra = useMutation({
    mutationFn: (primeira_compra: string | null) =>
      apiClient.put(`/api/v1/contacts/${contactId}/qualificacao`, { primeira_compra }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chave }),
    onError: showApiError,
  });
  const alternar = useMutation({
    mutationFn: (is_mql: boolean) =>
      apiClient.put(`/api/v1/contacts/${contactId}/qualificacao`, { is_mql }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chave }),
    onError: showApiError,
  });

  if (!contactId) return null;
  const d = consulta.data;
  const dia = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(tag, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
  const rotuloDoStatus = (s: string) =>
    s === "won" ? t("Ganho") : s === "lost" ? t("Perdido") : t("Aberto");

  return (
    <section className={semTitulo ? "" : "border-b border-border py-3"}>
      {semTitulo ? null : (
        <h3 className="mb-2 text-xs font-medium tracking-wide text-text-muted uppercase">
          {t("Qualificação")}
        </h3>
      )}
      {consulta.isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-secondary" aria-busy="true" />
      ) : !d ? null : (
        <div className="grid gap-3 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="text-text-muted">{t("Entrou em")}</dt>
              <dd className="font-medium">{dia(d.entrou_em)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">{t("Primeira abordagem")}</dt>
              <dd className="font-medium">{dia(d.primeira_abordagem)}</dd>
            </div>
          </dl>

          <div className="grid gap-1">
            <span className="text-xs text-text-muted">{t("Primeira compra")}</span>
            <SeletorDeData
              valor={d.primeira_compra ?? ""}
              rotulo={t("Primeira compra")}
              placeholder={t("Sem compra registrada")}
              aoMudar={(v) => (pode ? salvarCompra.mutate(v === "" ? null : v) : undefined)}
            />
          </div>

          <label
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border px-3 py-2",
              d.is_mql ? "border-primary/40 bg-primary/10" : "bg-card",
            )}
          >
            <span>
              <span className="block text-sm font-medium">{t("Lead qualificado (MQL)")}</span>
              <span className="block text-xs text-text-muted">
                {d.is_mql ? `${t("Marcado em")} ${dia(d.mql_at)}` : t("Ainda não qualificado")}
              </span>
            </span>
            <input
              type="checkbox"
              checked={d.is_mql}
              disabled={!pode || alternar.isPending}
              onChange={(e) => alternar.mutate(e.target.checked)}
              aria-label={t("Lead qualificado (MQL)")}
              className="h-5 w-5"
            />
          </label>

          <div>
            <p className="mb-1 text-xs text-text-muted">{t("Funis")}</p>
            {d.funis.length === 0 ? (
              <p className="text-xs text-text-muted">{t("Ainda não está em nenhum funil.")}</p>
            ) : (
              <ul className="grid gap-1">
                {d.funis.map((f) => (
                  <li
                    key={f.lead_id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 px-2.5 py-1.5 text-xs"
                  >
                    <span className="min-w-0 truncate font-medium">{f.funil}</span>
                    <span className="shrink-0 text-text-muted">
                      {f.etapa} · {rotuloDoStatus(f.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
