"use client";

import { useState } from "react";

import { ClienteDaAgenciaProvider } from "@/components/agencia/ClienteDaAgenciaProvider";
import { CronogramaDoCliente } from "@/components/marketing/cronograma/CronogramaDoCliente";
import { useT } from "@/hooks/i18n/useT";
import { cn } from "@/lib/utils";

export interface ClienteDoCronograma {
  id: string;
  name: string;
}

/**
 * O cronograma e as tarefas da semana de TODOS os clientes numa tela: escolhe-se o cliente nos
 * botões (a troca é instantânea, sem recarregar e sem entrar no perfil dele) e edita-se no lugar.
 */
export function CronogramaDaAgencia({
  clientes,
  inicial,
}: {
  clientes: readonly ClienteDoCronograma[];
  inicial: string;
}) {
  const t = useT();
  const [id, setId] = useState(
    clientes.some((c) => c.id === inicial) ? inicial : (clientes[0]?.id ?? ""),
  );
  const cliente = clientes.find((c) => c.id === id);
  if (!cliente)
    return <p className="text-sm text-muted-foreground">{t("Nenhum cliente disponível.")}</p>;
  return (
    <div className="grid gap-4">
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
        <CronogramaDoCliente />
      </ClienteDaAgenciaProvider>
    </div>
  );
}
