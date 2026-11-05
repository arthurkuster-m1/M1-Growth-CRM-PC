"use client";

import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";

import { Etiqueta } from "@/components/motor/Etiqueta";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantAgent } from "@/hooks/useTenantAgent";
import { ArrowsClockwise } from "@/lib/ui/icons";
import { useT } from "@/hooks/i18n/useT";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TenantAgentClientProps {
  id: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TenantAgentClient({ id }: TenantAgentClientProps) {
  const tagDoIdioma = useTagDeIdioma();
  const t = useT();
  const { data, isLoading, isError, isFetching, dataUpdatedAt } = useTenantAgent(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center text-sm text-text-muted">
        {t("Não foi possível carregar os agentes da empresa. Tente recarregar a página.")}
      </div>
    );
  }

  const agentes = data.data.agents;
  const atualizadoEm = dataUpdatedAt
    ? new Intl.DateTimeFormat(tagDoIdioma, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(dataUpdatedAt))
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium tracking-wide text-text-muted uppercase">
          {t("Agentes")}
        </h2>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          {isFetching && <ArrowsClockwise size={13} className="animate-spin" aria-hidden />}
          {atualizadoEm && (
            <span>
              {t("Atualizado às")} {atualizadoEm}
            </span>
          )}
        </div>
      </div>

      {agentes.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center text-sm text-text-muted">
          {t("Nenhum agente publicado")}
        </div>
      ) : (
        <ul className="space-y-3">
          {agentes.map((agente) => (
            <li key={agente.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{agente.name}</span>
                <Etiqueta cor={agente.is_active ? "green" : "gray"} ponto>
                  {agente.is_active ? t("Ativo") : t("Inativo")}
                </Etiqueta>
              </div>

              <dl className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                <div>
                  <dt className="tracking-wider text-text-muted uppercase">{t("Tipo")}</dt>
                  <dd className="mt-1">{agente.kind}</dd>
                </div>
                <div>
                  <dt className="tracking-wider text-text-muted uppercase">
                    {t("Versão publicada")}
                  </dt>
                  <dd className="mt-1">
                    {agente.published_version
                      ? `v${agente.published_version.version_number} · ${agente.published_version.provider} · ${agente.published_version.model}`
                      : t("Nenhum agente publicado")}
                  </dd>
                </div>
                <div>
                  <dt className="tracking-wider text-text-muted uppercase">{t("Publicado em")}</dt>
                  <dd className="mt-1">
                    {agente.published_version?.published_at
                      ? new Intl.DateTimeFormat(tagDoIdioma, {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(agente.published_version.published_at))
                      : "—"}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
