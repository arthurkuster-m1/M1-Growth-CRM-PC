"use client";
import { useCallback, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { SelectDoApp } from "@/components/ui/SelectDoApp";
import type { AdminTenantsFilters } from "@/hooks/useAdminTenants";
import { useT } from "@/hooks/i18n/useT";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TenantsFiltersProps {
  filters: AdminTenantsFilters;
  onChange: (filters: AdminTenantsFilters) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TenantsFilters({ filters, onChange }: TenantsFiltersProps) {
  const t = useT();
  const [inputValue, setInputValue] = useState(filters.q ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setInputValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange({ ...filters, q: value || undefined });
      }, 300);
    },
    [filters, onChange],
  );

  const handleStatus = useCallback(
    (value: string) => {
      onChange({
        ...filters,
        status: value === "all" ? undefined : (value as AdminTenantsFilters["status"]),
      });
    },
    [filters, onChange],
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        placeholder={t("Buscar por nome, identificador ou CNPJ...")}
        value={inputValue}
        onChange={(e) => handleSearch(e.target.value)}
        className="sm:w-80"
        aria-label={t("Buscar empresas")}
      />
      <div className="sm:w-48">
        <SelectDoApp
          value={filters.status ?? "all"}
          onChange={(e) => handleStatus(e.target.value)}
          aria-label={t("Filtrar por status")}
        >
          <option value="all">{t("Todos os status")}</option>
          <option value="active">{t("Ativo")}</option>
          <option value="onboarding">{t("Onboarding")}</option>
          <option value="suspended">{t("Suspenso")}</option>
          <option value="redacted">{t("Redigido")}</option>
        </SelectDoApp>
      </div>
    </div>
  );
}
