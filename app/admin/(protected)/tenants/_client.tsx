"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "@/lib/ui/icons";
import { TenantsFilters } from "@/components/admin/tenants/TenantsFilters";
import { TenantsTable, TenantsTableSkeleton } from "@/components/admin/tenants/TenantsTable";
import { useAdminTenants, type AdminTenantsFilters } from "@/hooks/useAdminTenants";
import { useT } from "@/hooks/i18n/useT";

export function TenantsClient({ selecionados = [] }: { selecionados?: string[] }) {
  const t = useT();
  const [filters, setFilters] = useState<AdminTenantsFilters>({});

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useAdminTenants(
    filters,
    selecionados,
  );

  const rows = data?.pages.flatMap((p) => p.data ?? []) ?? [];
  const total = rows.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t("Empresas")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? t("Carregando...")
              : `${total} ${total === 1 ? t("empresa") : t("empresas")}${hasNextPage ? "+" : ""}`}
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link href="/admin/tenants/new">
            <Plus size={16} aria-hidden />
            {t("Nova empresa")}
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <TenantsFilters filters={filters} onChange={setFilters} />

      {/* Table */}
      {isLoading ? (
        <TenantsTableSkeleton />
      ) : (
        <TenantsTable
          data={rows}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={() => void fetchNextPage()}
        />
      )}
    </div>
  );
}
