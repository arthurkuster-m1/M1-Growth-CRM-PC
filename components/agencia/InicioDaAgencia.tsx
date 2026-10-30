"use client";

import { useMemo } from "react";

import { Tag } from "@/components/agenda/CamposDoCompromisso";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { TarefasDaAgencia } from "@/components/agencia/TarefasDaAgencia";
import { useT } from "@/hooks/i18n/useT";
import { agruparTarefas, grupoDaTarefa, type TarefaDaAgencia } from "@/lib/agencia/tarefas";
import { chaveDoDia, somarDias } from "@/lib/inicio/datas";
import { FUSO_DO_CRONOGRAMA } from "@/lib/marketing/cronograma";

export interface CompromissoDaAgencia {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  status: string;
  cliente: string;
  contato: string;
}

export interface AlertaDaAgencia {
  id: string;
  titulo: string;
  corpo: string;
  severidade: string;
  cliente: string;
  em: string;
}

export interface ResumoDoCliente {
  id: string;
  nome: string;
  campanhasAtivas: number;
  leads: number;
}

function saudacao(hora: number): string {
  return hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
}

/**
 * O INÍCIO do modo agência: a mesma ideia do Início de uma empresa (saudação, o que vence hoje, a
 * semana), mas juntando as tarefas de TODOS os clientes escolhidos, cada uma com o cliente ao lado.
 * `agoraIso` nasce no servidor para a hidratação não divergir.
 */
export function InicioDaAgencia({
  nome,
  agoraIso,
  tarefas,
  clientes,
  compromissos,
  alertas,
}: {
  nome: string;
  agoraIso: string;
  tarefas: TarefaDaAgencia[];
  clientes: ResumoDoCliente[];
  compromissos: CompromissoDaAgencia[];
  alertas: AlertaDaAgencia[];
}) {
  const t = useT();
  const agora = useMemo(() => new Date(agoraIso), [agoraIso]);
  const hoje = chaveDoDia(agora, FUSO_DO_CRONOGRAMA);
  const hora = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: FUSO_DO_CRONOGRAMA,
    }).format(agora),
  );
  const abertas = tarefas.filter((x) => x.status !== "done" && x.status !== "cancelled");
  const atrasadas = abertas.filter((x) => grupoDaTarefa(x, agora) === "atrasadas").length;
  const dehoje = abertas.filter((x) => grupoDaTarefa(x, agora) === "hoje").length;

  const semana = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const dia = somarDias(hoje, i);
        const doDia = abertas.filter(
          (x) => x.prazo && chaveDoDia(new Date(x.prazo), FUSO_DO_CRONOGRAMA) === dia,
        );
        return { dia, tarefas: doDia };
      }),
    [abertas, hoje],
  );
  const rotuloDoDia = (dia: string, i: number) =>
    i === 0
      ? t("Hoje")
      : new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          timeZone: "UTC",
        });
  // Início mostra o que pede ação: nada de "concluídas recentemente" aqui.
  const grupos = agruparTarefas(tarefas, agora).filter((g) => g.grupo !== "feitas");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {t("Modo agência")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t(saudacao(hora))}
          {nome ? `, ${nome}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          {atrasadas > 0 ? `${atrasadas} ${t("atrasada(s)")} · ` : ""}
          {dehoje} {t("para hoje")} · {abertas.length} {t("tarefas abertas em")} {clientes.length}{" "}
          {t("clientes")}
        </p>
      </header>

      <section aria-label={t("A semana")} className="grid gap-2">
        <h2 className="text-sm font-semibold">{t("A semana")}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {semana.map((d, i) => (
            <div key={d.dia} className="min-h-24 rounded-2xl border p-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground capitalize">
                {rotuloDoDia(d.dia, i)}
              </p>
              <ul className="grid gap-1">
                {d.tarefas.slice(0, 4).map((x) => (
                  <li
                    key={x.id}
                    className="rounded-lg bg-secondary px-1.5 py-1 text-[11px] leading-tight"
                  >
                    <span className="line-clamp-2">{x.titulo}</span>
                    <span className="text-muted-foreground">{x.cliente}</span>
                  </li>
                ))}
                {d.tarefas.length > 4 ? (
                  <li className="text-[11px] text-muted-foreground">+{d.tarefas.length - 4}</li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {alertas.length > 0 ? (
        <section aria-label={t("Alertas")} className="grid gap-2">
          <h2 className="text-sm font-semibold">
            {t("Alertas")}{" "}
            <span className="font-normal text-muted-foreground">({alertas.length})</span>
          </h2>
          <ul className="divide-y rounded-2xl border">
            {alertas.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-3 py-2.5">
                <span
                  aria-hidden
                  className={
                    "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full " +
                    (a.severidade === "critical"
                      ? "bg-error-fg"
                      : a.severidade === "warn"
                        ? "bg-warning-fg"
                        : "bg-info-fg")
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.titulo}</p>
                  {a.corpo ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{a.corpo}</p>
                  ) : null}
                </div>
                <Etiqueta cor="blue" className="shrink-0">
                  {a.cliente}
                </Etiqueta>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label={t("Agenda")} className="grid gap-2">
        <h2 className="text-sm font-semibold">{t("Agenda dos próximos dias")}</h2>
        {compromissos.length === 0 ? (
          <p className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">
            {t("Nenhum compromisso nos próximos 7 dias.")}
          </p>
        ) : (
          <ul className="divide-y rounded-2xl border">
            {compromissos.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-24 shrink-0 text-xs text-muted-foreground tabular-nums">
                  {new Date(c.inicio).toLocaleString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: FUSO_DO_CRONOGRAMA,
                  })}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{c.titulo}</span>
                <Tag cor={c.status === "confirmed" ? "azul" : "amarelo"} className="shrink-0">
                  {c.status === "confirmed" ? t("Confirmado") : t("Não confirmado")}
                </Tag>
                <Etiqueta cor="blue" className="shrink-0">
                  {c.cliente}
                </Etiqueta>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={t("Clientes")} className="grid gap-2">
        <h2 className="text-sm font-semibold">{t("Clientes")}</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {clientes.map((c) => (
            <div key={c.id} className="rounded-2xl border p-3">
              <p className="truncate text-sm font-semibold">{c.nome}</p>
              <p className="text-xs text-muted-foreground">
                {c.campanhasAtivas} {t("campanhas ativas")} · {c.leads} {t("leads")} ·{" "}
                {abertas.filter((x) => x.clienteId === c.id).length} {t("tarefas abertas")}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label={t("Tarefas")} className="grid gap-2">
        <h2 className="text-sm font-semibold">{t("Tarefas de todos os clientes")}</h2>
        <TarefasDaAgencia
          tarefas={tarefas.filter((x) => grupos.some((g) => g.tarefas.includes(x)))}
        />
      </section>
    </div>
  );
}
