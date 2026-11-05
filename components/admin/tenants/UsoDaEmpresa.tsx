"use client";

import { useState } from "react";

import { UsageCharts } from "@/components/admin/usage/UsageCharts";
import { UsageTable } from "@/components/admin/usage/UsageTable";
import { SelectDoApp } from "@/components/ui/SelectDoApp";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/i18n/useT";
import { useAdminUsage, type UsageRange } from "@/hooks/useAdminUsage";

const PERIODOS: { valor: UsageRange; rotulo: string }[] = [
  { valor: "7d", rotulo: "Últimos 7 dias" },
  { valor: "30d", rotulo: "Últimos 30 dias" },
  { valor: "90d", rotulo: "Últimos 90 dias" },
];

/** A aba USO da empresa: consumo de mensagens, conversas e IA só desta empresa. */
export function UsoDaEmpresa({ id }: { id: string }) {
  const t = useT();
  const [periodo, setPeriodo] = useState<UsageRange>("30d");
  const { data, isLoading, isError } = useAdminUsage(periodo, id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          {t("Consumo de mensagens, conversas e IA desta empresa.")}
        </p>
        <div className="w-48">
          <SelectDoApp
            value={periodo}
            aria-label={t("Período")}
            onChange={(e) => setPeriodo(e.target.value as UsageRange)}
          >
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {t(p.rotulo)}
              </option>
            ))}
          </SelectDoApp>
        </div>
      </div>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      ) : isError || !data ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-text-muted">
          {t("Erro ao carregar dados de uso. Tente recarregar.")}
        </div>
      ) : (
        <>
          <UsageCharts series={data.series} />
          <UsageTable tenants={data.tenants} range={periodo} />
        </>
      )}
    </div>
  );
}
