"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { TagDoCliente } from "@/components/agencia/TagDoCliente";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { useT } from "@/hooks/i18n/useT";
import { HEADER_CLIENTE_DA_AGENCIA } from "@/lib/agencia/cliente-da-aba";
import { agruparTarefas, ROTULO_DO_GRUPO, type TarefaDaAgencia } from "@/lib/agencia/tarefas";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const dia = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : "";

/**
 * As tarefas da agência de TODOS os clientes escolhidos, numa lista só: o que as tarefas da semana de
 * cada cliente marcam como "da agência". Marcar como feita grava no cliente certo (o header do
 * cliente vai na própria chamada e o servidor reconfere o direito).
 */
export function TarefasDaAgencia({ tarefas }: { tarefas: TarefaDaAgencia[] }) {
  const t = useT();
  const router = useRouter();
  const [feitas, setFeitas] = useState<Record<string, boolean>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  const lista = tarefas.map((x) =>
    x.id in feitas ? { ...x, status: feitas[x.id] ? ("done" as const) : ("pending" as const) } : x,
  );
  const grupos = agruparTarefas(lista);

  async function alternar(x: TarefaDaAgencia) {
    const feita = x.status === "done";
    setSalvando(x.id);
    try {
      await apiClient.patch(
        `/api/v1/marketing/cronograma/tarefas/${x.id}`,
        { status: feita ? "pending" : "done" },
        { headers: { [HEADER_CLIENTE_DA_AGENCIA]: x.clienteId } },
      );
      setFeitas((f) => ({ ...f, [x.id]: !feita }));
      router.refresh();
    } catch (e) {
      showApiError(e);
    } finally {
      setSalvando(null);
    }
  }

  if (grupos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        {t("Nenhuma tarefa da agência nos clientes escolhidos.")}
      </p>
    );
  }
  return (
    <div className="grid gap-6">
      {grupos.map((g) => (
        <section key={g.grupo} aria-label={t(ROTULO_DO_GRUPO[g.grupo])} className="grid gap-2">
          <h2 className="text-sm font-semibold">
            {t(ROTULO_DO_GRUPO[g.grupo])}{" "}
            <span className="font-normal text-muted-foreground">({g.tarefas.length})</span>
          </h2>
          <ul className="divide-y rounded-2xl border">
            {g.tarefas.map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={x.status === "done"}
                  disabled={salvando === x.id}
                  onChange={() => void alternar(x)}
                  aria-label={`${t("Concluir")}: ${x.titulo}`}
                  className="h-4 w-4 shrink-0"
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    x.status === "done" && "text-muted-foreground line-through",
                  )}
                >
                  {x.titulo}
                </span>
                {x.adiamentos > 0 ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t("adiada")} {x.adiamentos}×
                  </span>
                ) : null}
                <TagDoCliente nome={x.cliente} cor={x.cor} className="shrink-0" />
                <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {dia(x.prazo)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
