"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { salvarClientesDaAgencia, salvarOrdemDosClientes } from "@/app/actions/agencia/modoAgencia";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { ArrowDown, ArrowUp, Buildings, CaretDown } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface OpcaoDeCliente {
  id: string;
  name: string;
}

/**
 * O seletor de clientes do modo agência, no desenho do seletor de campanhas do CRM: pílula que abre uma
 * lista com busca e caixinhas — um, vários ou todos —, e as setas ↑↓ para mudar a ORDEM dos clientes
 * (a ordem vale para todas as telas do modo agência). `selecionados` vazio = todos.
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
  const [busca, setBusca] = useState("");
  const [pendente, iniciar] = useTransition();
  const todos = selecionados.length === 0 || selecionados.length === clientes.length;
  const marcados = new Set(todos ? [] : selecionados);

  function gravarSelecao(ids: string[]) {
    iniciar(async () => {
      await salvarClientesDaAgencia(ids.length === clientes.length ? [] : ids);
      router.refresh();
    });
  }
  function alternar(id: string) {
    const prox = new Set(todos ? [] : selecionados);
    if (prox.has(id)) prox.delete(id);
    else prox.add(id);
    gravarSelecao([...prox]);
  }
  function mover(i: number, passo: -1 | 1) {
    const novo = [...clientes];
    const j = i + passo;
    if (j < 0 || j >= novo.length) return;
    [novo[i], novo[j]] = [novo[j]!, novo[i]!];
    iniciar(async () => {
      await salvarOrdemDosClientes(novo.map((c) => c.id));
      router.refresh();
    });
  }

  const termo = busca.trim().toLowerCase();
  const rotulo = todos
    ? t("Todos os clientes")
    : selecionados.length === 1
      ? (clientes.find((c) => c.id === selecionados[0])?.name ?? t("1 cliente"))
      : `${selecionados.length} ${t("clientes")}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={pendente}
          aria-label={t("Clientes que aparecem")}
          data-testid="seletor-de-clientes"
          className={cn(
            "inline-flex h-11 max-w-full items-center gap-2 rounded-full border bg-secondary/60 px-4 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60",
            !todos && "border-primary bg-primary/10",
          )}
        >
          <Buildings size={15} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="max-w-[16rem] truncate">{rotulo}</span>
          <CaretDown size={13} weight="bold" aria-hidden className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={8}
        className="max-h-[var(--radix-popover-content-available-height)] w-[min(94vw,380px)] overflow-y-auto overscroll-contain p-3"
      >
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={t("Buscar cliente")}
          className="mb-2 h-10 w-full rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60"
        />
        <button
          type="button"
          onClick={() => gravarSelecao([])}
          className={cn(
            "mb-1 flex h-10 w-full items-center justify-between rounded-lg px-3 text-left text-sm hover:bg-secondary",
            todos && "bg-secondary font-medium",
          )}
        >
          {t("Todos os clientes")}
          <span className="text-xs text-muted-foreground">{clientes.length}</span>
        </button>
        <div className="grid gap-0.5">
          {clientes.map((c, i) => {
            if (termo && !c.name.toLowerCase().includes(termo)) return null;
            const marcado = marcados.has(c.id);
            return (
              <div
                key={c.id}
                className={cn(
                  "flex min-h-10 items-center gap-1 rounded-lg pr-1 pl-3 hover:bg-secondary",
                  marcado && "bg-primary/10",
                )}
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => alternar(c.id)}
                    className="h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{c.name}</span>
                </label>
                <button
                  type="button"
                  aria-label={`${t("Subir")} ${c.name}`}
                  disabled={i === 0 || pendente}
                  onClick={() => mover(i, -1)}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-card disabled:opacity-30"
                >
                  <ArrowUp size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`${t("Descer")} ${c.name}`}
                  disabled={i === clientes.length - 1 || pendente}
                  onClick={() => mover(i, 1)}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-card disabled:opacity-30"
                >
                  <ArrowDown size={14} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
