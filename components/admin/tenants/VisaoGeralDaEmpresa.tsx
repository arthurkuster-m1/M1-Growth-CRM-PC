"use client";

import { AlertasDaEmpresa } from "@/components/admin/tenants/AlertasDaEmpresa";
import { FichaDaEmpresa } from "@/components/admin/tenants/FichaDaEmpresa";
import { HealthGrid } from "@/components/admin/tenants/HealthGrid";
import { OnboardingDaEmpresa } from "@/components/admin/tenants/OnboardingDaEmpresa";
import { TenantActions } from "@/components/admin/tenants/TenantActions";
import { Skeleton } from "@/components/ui/skeleton";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useTenantDetail } from "@/hooks/useTenantDetail";
import { useTenantHealth } from "@/hooks/useTenantHealth";
import { ArrowsClockwise } from "@/lib/ui/icons";

/**
 * A VISÃO GERAL da empresa, em dois blocos.
 *
 * Bloco A (o que ela é e como está): Status de Saúde, Identificação, Volumes e datas, Onboarding.
 * Bloco B (o que se faz e o que merece atenção): Ações (suspender / reativar) e Alertas.
 */
export function VisaoGeralDaEmpresa({ id }: { id: string }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const detalhe = useTenantDetail(id);
  const saude = useTenantHealth(id);

  if (detalhe.isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }
  if (detalhe.isError || !detalhe.data?.data) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center text-sm text-text-muted">
        {t("Não foi possível carregar os dados da empresa. Tente recarregar a página.")}
      </div>
    );
  }
  const dados = detalhe.data.data;
  const { organization, counts, agencia_lead: agenciaLead } = dados;
  const atualizadoEm = saude.dataUpdatedAt
    ? new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit" }).format(
        new Date(saude.dataUpdatedAt),
      )
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Bloco A */}
      <div className="min-w-0 space-y-4">
        <section aria-label={t("Status de Saúde")} className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium tracking-wide text-text-muted uppercase">
              {t("Status de Saúde")}
            </h2>
            <span className="flex items-center gap-1.5 text-xs text-text-muted">
              {saude.isFetching ? (
                <ArrowsClockwise size={12} className="animate-spin" aria-hidden />
              ) : null}
              {atualizadoEm ? `${t("Atualizado às")} ${atualizadoEm}` : null}
            </span>
          </div>
          {saude.isLoading ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : saude.data?.data ? (
            <HealthGrid health={saude.data.data} />
          ) : (
            <p className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-text-muted">
              {t("Não foi possível ler a saúde agora.")}
            </p>
          )}
        </section>
        <FichaDaEmpresa
          organization={organization}
          counts={counts}
          agenciaLead={agenciaLead}
          partes={["identificacao"]}
        />
        <FichaDaEmpresa
          organization={organization}
          counts={counts}
          agenciaLead={agenciaLead}
          partes={["volumes"]}
        />
        <OnboardingDaEmpresa org={organization} />
      </div>

      {/* Bloco B */}
      <div className="space-y-4">
        <TenantActions organizationId={organization.id} status={organization.status} />
        <AlertasDaEmpresa detalhe={dados} health={saude.data?.data ?? null} />
      </div>
    </div>
  );
}
