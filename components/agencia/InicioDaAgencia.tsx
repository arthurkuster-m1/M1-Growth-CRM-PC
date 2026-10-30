"use client";

import { useMemo } from "react";

import { TarefasDaAgencia } from "@/components/agencia/TarefasDaAgencia";
import { useT } from "@/hooks/i18n/useT";
import { agruparTarefas, grupoDaTarefa, type TarefaDaAgencia } from "@/lib/agencia/tarefas";
import { chaveDoDia, somarDias } from "@/lib/inicio/datas";
import { FUSO_DO_CRONOGRAMA } from "@/lib/marketing/cronograma";

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
}: {
  nome: string;
  agoraIso: string;
  tarefas: TarefaDaAgencia[];
  clientes: ResumoDoCliente[];
}) {
  const t = useT();
  const agora = useMemo(() => new Date(agoraIso), [agoraIso]);
  const hoje = chaveDoDia(agora, FUSO_DO_CRONOGRAMA);
  const hora = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: FUSO_DO_CRONOGRAMA }).format(agora),
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
      : new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
  // Início mostra o que pede ação: nada de "concluídas recentemente" aqui.
  const grupos = agruparTarefas(tarefas, agora).filter((g) => g.grupo !== "feitas");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{t("Modo agência")}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t(saudacao(hora))}
          {nome ? `, ${nome}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          {atrasadas > 0 ? `${atrasadas} ${t("atrasada(s)")} · ` : ""}
          {dehoje} {t("para hoje")} · {abertas.length} {t("tarefas abertas em")} {clientes.length} {t("clientes")}
        </p>
      </header>

      <section aria-label={t("A semana")} className="grid gap-2">
        <h2 className="text-sm font-semibold">{t("A semana")}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {semana.map((d, i) => (
            <div key={d.dia} className="min-h-24 rounded-2xl border p-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground capitalize">{rotuloDoDia(d.dia, i)}</p>
              <ul className="grid gap-1">
                {d.tarefas.slice(0, 4).map((x) => (
                  <li key={x.id} className="rounded-lg bg-secondary px-1.5 py-1 text-[11px] leading-tight">
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
        <TarefasDaAgencia tarefas={tarefas.filter((x) => grupos.some((g) => g.tarefas.includes(x)))} />
      </section>
    </div>
  );
}
