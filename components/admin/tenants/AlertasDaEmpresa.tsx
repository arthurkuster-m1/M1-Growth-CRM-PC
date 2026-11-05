"use client";

import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import type { TenantDetailResponse } from "@/hooks/useTenantDetail";
import type { TenantHealthResponse } from "@/hooks/useTenantHealth";
import { alertasDaEmpresa, type GravidadeDoAlerta } from "@/lib/admin/alertas-da-empresa";
import { cn } from "@/lib/utils";

const COR: Record<GravidadeDoAlerta, string> = {
  critico: "bg-error-fg",
  atencao: "bg-warning-fg",
  info: "bg-text-muted",
};

/** "Alertas": as informações importantes sobre a empresa agora (ver `lib/admin/alertas-da-empresa.ts`). */
export function AlertasDaEmpresa({
  detalhe,
  health,
}: {
  detalhe: TenantDetailResponse["data"];
  health?: TenantHealthResponse | null;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const alertas = alertasDaEmpresa({
    organization: detalhe.organization,
    counts: detalhe.counts,
    health,
    mensalidade: detalhe.mensalidade,
    formatarDia: (iso) =>
      new Intl.DateTimeFormat(tag, { dateStyle: "short", timeZone: "UTC" }).format(new Date(iso)),
  });
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-2 text-xs font-medium tracking-wide text-text-muted uppercase">
        {t("Alertas")}
      </h2>
      {alertas.length === 0 ? (
        <p className="text-sm text-text-muted">{t("Nada exige atenção agora.")}</p>
      ) : (
        <ul className="space-y-2">
          {alertas.map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-sm">
              <span
                aria-hidden
                className={cn("mt-1.5 size-2 shrink-0 rounded-full", COR[a.gravidade])}
              />
              <span>
                {t(a.texto)}
                {a.detalhe ? <span className="text-text-muted"> {a.detalhe}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
