"use client";

import { useState } from "react";

import { ClienteDaAgenciaProvider } from "@/components/agencia/ClienteDaAgenciaProvider";
import { DashboardsClient } from "@/components/dashboards/DashboardsClient";
import { useT } from "@/hooks/i18n/useT";
import { cn } from "@/lib/utils";

/**
 * Os DASHBOARDS de qualquer cliente com troca rápida: os botões trocam o cliente na hora (sem
 * recarregar e sem entrar no perfil dele); o período e o painel escolhidos continuam os mesmos.
 */
export function DashboardsDaAgencia({
  clientes,
  inicial,
  painelInicial,
}: {
  clientes: readonly { id: string; name: string }[];
  inicial: string;
  painelInicial?: string;
}) {
  const t = useT();
  const [id, setId] = useState(
    clientes.some((c) => c.id === inicial) ? inicial : (clientes[0]?.id ?? ""),
  );
  const cliente = clientes.find((c) => c.id === id);
  if (!cliente)
    return <p className="text-sm text-muted-foreground">{t("Nenhum cliente disponível.")}</p>;
  return (
    <div className="grid gap-3">
      <div role="tablist" aria-label={t("Cliente")} className="flex flex-wrap gap-1.5">
        {clientes.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === id}
            onClick={() => setId(c.id)}
            className={cn(
              "h-9 max-w-full truncate rounded-full px-3.5 text-sm font-medium transition-colors",
              c.id === id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-secondary/70",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
      <ClienteDaAgenciaProvider key={cliente.id} cliente={cliente}>
        <DashboardsClient empresa={cliente.name} painelInicial={painelInicial} />
      </ClienteDaAgenciaProvider>
    </div>
  );
}
