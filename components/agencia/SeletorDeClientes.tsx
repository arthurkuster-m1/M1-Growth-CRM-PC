"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { salvarClientesDaAgencia } from "@/app/actions/agencia/modoAgencia";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { CaretDown, Check } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface OpcaoDeCliente {
  id: string;
  name: string;
}

/**
 * O seletor de clientes do modo agência: um, vários ou todos (o desenho do seletor de campanhas do
 * CRM). `selecionados` vazio = todos. Grava a preferência no servidor e recarrega a tela.
 */
export function SeletorDeClientes({
  clientes,
  selecionados,
}: {
  clientes: readonly OpcaoDeCliente[];
  selecionados: readonly string[];
}) {
  const t = useT();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [pendente, iniciar] = useTransition();
  const todos = selecionados.length === 0 || selecionados.length === clientes.length;
  const marcados = new Set(todos ? clientes.map((c) => c.id) : selecionados);

  function gravar(ids: string[]) {
    iniciar(async () => {
      await salvarClientesDaAgencia(ids.length === clientes.length ? [] : ids);
      router.refresh();
    });
  }
  function alternar(id: string) {
    const prox = new Set(marcados);
    if (prox.has(id)) prox.delete(id);
    else prox.add(id);
    if (prox.size === 0) return;
    gravar([...prox]);
  }

  const termo = busca.trim().toLowerCase();
  const visiveis = termo ? clientes.filter((c) => c.name.toLowerCase().includes(termo)) : clientes;
  const rotulo = todos
    ? t("Todos os clientes")
    : marcados.size === 1
      ? (clientes.find((c) => marcados.has(c.id))?.name ?? "")
      : `${marcados.size} ${t("clientes")}`;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={pendente}
          aria-label={t("Clientes que aparecem")}
          data-testid="seletor-de-clientes"
          className="inline-flex h-10 max-w-full items-center gap-2 rounded-xl border bg-card px-3 text-sm font-medium hover:bg-secondary/50 disabled:opacity-60"
        >
          <span className="truncate">{rotulo}</span>
          <CaretDown size={12} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,90vw)] p-1.5">
        {clientes.length > 8 ? (
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t("Buscar…")}
            className="mb-1 h-8 w-full rounded-xl border bg-card px-2 text-sm outline-hidden focus:border-primary/60"
          />
        ) : null}
        <button
          type="button"
          onClick={() => gravar([])}
          className={cn(
            "flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left text-sm hover:bg-secondary",
            todos && "bg-secondary",
          )}
        >
          {t("Todos os clientes")}
          {todos ? <Check size={14} className="text-primary" aria-hidden /> : null}
        </button>
        <div className="max-h-72 overflow-y-auto">
          {visiveis.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => alternar(c.id)}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-secondary"
            >
              <span className="truncate">{c.name}</span>
              {marcados.has(c.id) && !todos ? (
                <Check size={14} className="shrink-0 text-primary" aria-hidden />
              ) : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
