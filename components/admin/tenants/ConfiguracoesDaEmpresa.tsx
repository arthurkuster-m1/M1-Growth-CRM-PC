"use client";

import { FichaDaEmpresa } from "@/components/admin/tenants/FichaDaEmpresa";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/i18n/useT";
import { useTenantDetail } from "@/hooks/useTenantDetail";

/**
 * A aba CONFIGURAÇÕES da empresa. A cor no Modo agência vem de cima (componente da agência, na
 * página); aqui entram, nesta ordem, as áreas de trabalho (o que aparece no menu dela, uma a
 * uma), região e idioma, privacidade (LGPD), limite de IA e marca.
 */
export function ConfiguracoesDaEmpresa({ id }: { id: string }) {
  const t = useT();
  const { data, isLoading, isError } = useTenantDetail(id);
  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (isError || !data?.data) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center text-sm text-text-muted">
        {t("Não foi possível carregar os dados da empresa. Tente recarregar a página.")}
      </div>
    );
  }
  const { organization, counts, agencia_lead: agenciaLead } = data.data;
  return (
    <FichaDaEmpresa
      organization={organization}
      counts={counts}
      agenciaLead={agenciaLead}
      partes={["areas", "regiao", "lgpd", "ia", "marca"]}
    />
  );
}
