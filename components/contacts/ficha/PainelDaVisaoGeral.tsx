"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";

import { BlocoDaFicha, SeloDaFicha } from "@/components/contacts/ficha/BlocoDaFicha";
import { RegistrarAcaoDoLead } from "@/components/contacts/ficha/LinhaDoTempoDoLead";
import { UltimasAcoesDoLead } from "@/components/contacts/ficha/UltimasAcoesDoLead";
import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import type { Tarefa } from "@/lib/tarefas/tipos";
import { nomeDaVenda, type Venda } from "@/lib/vendas";
import { Star } from "@/lib/ui/icons";

const reais = (c: number) => moedaDoNumero(c / 100);
const PESO: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const ROTULO_PRIORIDADE: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};
const COR_PRIORIDADE: Record<string, "red" | "yellow" | "blue" | "gray"> = {
  urgent: "red",
  high: "yellow",
  medium: "blue",
  low: "gray",
};

interface Anotacao {
  id: string;
  titulo: string;
  texto: string;
  fixada: boolean;
  criada_em: string;
}

/** O que a venda ainda tem a receber, e quando vence o próximo pagamento. */
function pendencia(v: Venda): { falta: number; vence: string | null } {
  const abertas = (v.parcelas ?? []).filter((p) => p.status === "prevista");
  if (abertas.length > 0) {
    const ordenadas = [...abertas].sort((a, b) => a.due_on.localeCompare(b.due_on));
    return {
      falta: abertas.reduce((s, p) => s + p.amount_cents, 0),
      vence: ordenadas[0]!.due_on,
    };
  }
  if (v.status === "comprometida") return { falta: v.amount_cents, vence: v.expected_on };
  return { falta: 0, vence: v.expected_on };
}

/**
 * A VISÃO GERAL: um painel do que pede atenção neste cliente — o dinheiro mais urgente, as tarefas
 * mais urgentes e as anotações importantes. O cadastro completo mora na aba Cadastro.
 */
export function PainelDaVisaoGeral({
  contactId,
  aoAbrir,
  podeEditar = false,
  aoAbrirTarefa,
}: {
  contactId: string;
  aoAbrir: (aba: string) => void;
  podeEditar?: boolean;
  /** Abrir uma tarefa para editar (a ficha leva para a aba Atendimento e Tarefas). */
  aoAbrirTarefa?: (id: string) => void;
}) {
  const t = useT();
  const locale = useLocaleDeData();
  const [hoje] = useState(() => new Date().toISOString().slice(0, 10));

  const vendasQ = useQuery({
    queryKey: ["vendas-do-cliente", contactId],
    retry: false,
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?contato=${contactId}`)).data
        .vendas,
  });
  const tarefasQ = useQuery({
    queryKey: ["tarefas-do-contato", contactId],
    staleTime: 10_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { tasks: Tarefa[] } }>(
          `/api/v1/tasks?contact_id=${contactId}&aberto=true`,
        )
      ).data.tasks ?? [],
  });
  const notasQ = useQuery({
    queryKey: ["anotacoes-do-lead", contactId],
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: Anotacao[] }>(`/api/v1/contacts/${contactId}/anotacoes`)).data,
  });

  const vendas = vendasQ.data ?? [];
  const realizadas = vendas.filter((v) => v.status === "comprometida" || v.status === "concluida");
  const recebido = (v: Venda) => {
    const p = v.parcelas ?? [];
    if (p.length === 0) return v.status === "concluida" ? v.amount_cents : 0;
    return p.filter((x) => x.status === "recebida").reduce((a, x) => a + x.amount_cents, 0);
  };
  const ltv = realizadas.reduce((s, v) => s + recebido(v), 0);
  const faltaTotal = realizadas.reduce((s, v) => s + pendencia(v).falta, 0);

  const urgentesVendas = vendas
    .filter((v) => v.status === "interesse" || v.status === "comprometida")
    .map((v) => ({ v, ...pendencia(v) }))
    .sort((a, b) => (a.vence ?? "9999").localeCompare(b.vence ?? "9999"))
    .slice(0, 5);

  const tarefas = [...(tarefasQ.data ?? [])]
    .sort((a, b) => {
      const da = a.due_date ?? "9999";
      const db = b.due_date ?? "9999";
      return da === db ? (PESO[a.priority] ?? 9) - (PESO[b.priority] ?? 9) : da.localeCompare(db);
    })
    .slice(0, 5);

  const notas = (notasQ.data ?? []).slice(0, 4);
  const dia = (iso: string, hora = false) =>
    format(new Date(iso), hora ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy", { locale });
  const diaBr = (iso: string) => iso.split("-").reverse().join("/");

  const cartoes: Array<[string, string, string]> = [
    [t("LTV atual"), reais(ltv), "border-l-green-500"],
    [t("A receber"), reais(faltaTotal), "border-l-blue-500"],
    [t("Vendas"), String(realizadas.length), "border-l-purple-500"],
    [t("Tarefas abertas"), String(tarefasQ.data?.length ?? 0), "border-l-orange-500"],
  ];

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cartoes.map(([rotulo, valor, barra]) => (
          <div key={rotulo} className={`rounded-2xl border border-l-4 bg-card p-4 shadow-sm ${barra}`}>
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {rotulo}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{valor}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BlocoDaFicha
          titulo={t("Vendas mais urgentes")}
          cor="green"
          acao={
            <button type="button" onClick={() => aoAbrir("vendas")} className="text-xs font-medium text-primary hover:underline">
              {t("Ver todas")}
            </button>
          }
        >
          {vendasQ.isError ? (
            <p className="text-sm text-muted-foreground">{t("Sem permissão para ver as vendas.")}</p>
          ) : urgentesVendas.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("Nada a receber ou em negociação.")}</p>
          ) : (
            <ul className="grid gap-2">
              {urgentesVendas.map(({ v, falta, vence }) => {
                const atrasada = vence !== null && vence < hoje && falta > 0;
                return (
                  <li key={v.id} className="flex items-center justify-between gap-3 rounded-xl border p-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{nomeDaVenda(v) || t("Sem produto")}</p>
                      <p className={atrasada ? "text-xs text-error-fg" : "text-xs text-muted-foreground"}>
                        {vence ? `${t("Vence")} ${diaBr(vence)}` : t("Sem data")}
                        {atrasada ? ` · ${t("atrasada")}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {reais(falta > 0 ? falta : v.amount_cents)}
                      </p>
                      <SeloDaFicha cor={v.status === "interesse" ? "blue" : "yellow"}>
                        {v.status === "interesse" ? t("Interesse") : t("Comprometida")}
                      </SeloDaFicha>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </BlocoDaFicha>

        <BlocoDaFicha
          titulo={t("Tarefas mais urgentes")}
          cor="orange"
          acao={
            <button type="button" onClick={() => aoAbrir("atendimento")} className="text-xs font-medium text-primary hover:underline">
              {t("Ver todas")}
            </button>
          }
        >
          {tarefas.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("Nenhuma tarefa pendente.")}</p>
          ) : (
            <ul className="grid gap-2">
              {tarefas.map((x) => {
                const atrasada = x.due_date !== null && x.due_date.slice(0, 10) < hoje;
                return (
                  <li key={x.id}>
                    <button
                      type="button"
                      title={t("Abrir e editar a tarefa")}
                      onClick={() => (aoAbrirTarefa ? aoAbrirTarefa(x.id) : aoAbrir("atendimento"))}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border p-2.5 text-left transition-colors hover:bg-secondary/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{x.title}</p>
                        <p
                          className={
                            atrasada ? "text-xs text-error-fg" : "text-xs text-muted-foreground"
                          }
                        >
                          {x.due_date ? dia(x.due_date, true) : t("Sem prazo")}
                          {atrasada ? ` · ${t("atrasada")}` : ""}
                        </p>
                      </div>
                      <SeloDaFicha cor={COR_PRIORIDADE[x.priority] ?? "blue"}>
                        {t(ROTULO_PRIORIDADE[x.priority] ?? "Média")}
                      </SeloDaFicha>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </BlocoDaFicha>
      </div>

      <RegistrarAcaoDoLead contactId={contactId} podeEditar={podeEditar} />
      <UltimasAcoesDoLead contactId={contactId} aoVerTodas={() => aoAbrir("timeline")} />

      <BlocoDaFicha
        titulo={t("Anotações importantes")}
        cor="yellow"
        acao={
          <button type="button" onClick={() => aoAbrir("anotacoes")} className="text-xs font-medium text-primary hover:underline">
            {t("Ver todas")}
          </button>
        }
      >
        {notas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("Nenhuma anotação. Fixe a estrela nas importantes para elas aparecerem aqui.")}
          </p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {notas.map((n) => (
              <li key={n.id} className="rounded-xl border p-3">
                <div className="flex items-start gap-2">
                  {n.fixada ? (
                    <Star size={14} weight="fill" className="mt-0.5 shrink-0 text-yellow-500" aria-label={t("Importante")} />
                  ) : null}
                  <div className="min-w-0">
                    {n.titulo ? <p className="text-sm font-semibold break-words">{n.titulo}</p> : null}
                    <p className="line-clamp-3 text-sm break-words whitespace-pre-wrap">{n.texto}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{dia(n.criada_em, true)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </BlocoDaFicha>
    </div>
  );
}
