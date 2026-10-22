"use client";

import { NumeroQueCabe } from "@/components/ui/NumeroQueCabe";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { SeletorDePeriodo, type AtalhoDePeriodo } from "@/components/motor/CalendarioDePeriodo";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { AnalisesDaAgenda as Analises, GrupoDaAgenda } from "@/lib/agenda/analises";
import { PERIODOS, janelaDoPeriodo, type Periodo } from "@/lib/marketing/periodos";
import { cn } from "@/lib/utils";

type Resposta = Analises & {
  de: string;
  ate: string;
  remarcados: number;
  tipos: Array<{ id: string; name: string }>;
  campanhas: Array<{ id: string; name: string }>;
};

const ROTULO_DO_PERIODO: Record<Periodo, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  ultimos_5_dias: "Últimos 5 dias",
  ultimos_7_dias: "Últimos 7 dias",
  ultimos_30_dias: "Últimos 30 dias",
  semana: "Esta semana",
  mes: "Este mês",
  mes_passado: "Mês passado",
  trimestre: "Este trimestre",
  semestre: "Este semestre",
  ano: "Este ano",
};

const pct = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("pt-BR")}%`);

/** As ANÁLISES da Agenda: comparecimento, conversão e quantidades (por atendente, tipo e campanha). */
export function AnalisesDaAgenda({
  periodo,
}: {
  /** Dentro dos Dashboards: usa o período do cabeçalho deles, sem cabeçalho nem seletor próprios. */
  periodo?: { de: string; ate: string };
} = {}) {
  const t = useT();
  const hoje = new Intl.DateTimeFormat("en-CA").format(new Date());
  const [propria, setJanela] = useState(() => janelaDoPeriodo("mes", hoje));
  const janela = periodo ?? propria;
  const atalhos: AtalhoDePeriodo[] = PERIODOS.map((p) => ({
    id: p,
    rotulo: t(ROTULO_DO_PERIODO[p]),
    ...janelaDoPeriodo(p, hoje),
  }));

  const dados = useQuery({
    queryKey: ["agenda", "analises", janela.de, janela.ate],
    staleTime: 30_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: Resposta }>(
          `/api/v1/agenda/analises?de=${janela.de}&ate=${janela.ate}`,
        )
      ).data,
  });
  const equipe = useQuery({
    queryKey: ["team", "assignable", "analises-agenda"],
    staleTime: 60_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: Array<{ user_id: string; full_name: string | null }> }>(
          "/api/v1/team/assignable",
        )
      ).data,
  });
  const nomeDoAtendente = (id: string) =>
    id === ""
      ? t("Sem responsável")
      : ((equipe.data ?? []).find((p) => p.user_id === id)?.full_name?.trim() ??
        t("Membro da equipe"));
  const nomeDoTipo = (id: string) =>
    id === "" ? t("Sem tipo") : (dados.data?.tipos.find((x) => x.id === id)?.name ?? "—");
  const nomeDaCampanha = (id: string) =>
    id === ""
      ? t("Sem campanha (atendimento ao cliente ou sem oportunidade)")
      : (dados.data?.campanhas.find((x) => x.id === id)?.name ?? "—");

  const d = dados.data;
  const cartao = (rotulo: string, valor: string, apoio?: string, destaque = false) => (
    <div className={cn("bg-card px-4 py-3", destaque && "ring-2 ring-primary/40 ring-inset")}>
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {rotulo}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        <NumeroQueCabe>{valor}</NumeroQueCabe>
      </p>
      {apoio ? <p className="text-[11px] text-muted-foreground">{apoio}</p> : null}
    </div>
  );

  const tabela = (titulo: string, grupos: GrupoDaAgenda[], nome: (id: string) => string) => {
    return (
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">{titulo}</h2>
        {grupos.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Nenhum compromisso no período.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1.5 pr-3 text-left font-medium">{titulo}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{t("Agendados")}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{t("Compareceram")}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{t("Faltaram")}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{t("Cancelados")}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{t("Sem desfecho")}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{t("Comparecimento")}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{t("Conversão")}</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.id} className="border-t">
                    <td className="max-w-72 truncate py-1.5 pr-3 font-medium">{nome(g.id)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{g.agendados}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{g.compareceram}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{g.faltaram}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{g.cancelados}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{g.semDesfecho}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {pct(g.taxaDeComparecimento)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {pct(g.taxaDeConversao)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {periodo ? (
        <p className="text-sm text-muted-foreground">
          {t(
            "Compromissos, comparecimento e conversão. Presença e falta são sempre declaradas por uma pessoa.",
          )}
        </p>
      ) : (
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("Análises da Agenda")}</h1>
            <p className="text-sm text-muted-foreground">
              {t(
                "Compromissos, comparecimento e conversão. Presença e falta são sempre declaradas por uma pessoa.",
              )}
            </p>
          </div>
          <SeletorDePeriodo
            de={janela.de}
            ate={janela.ate}
            rotulo={t("Período")}
            atalhos={atalhos}
            aoMudar={(p) => setJanela({ ...propria, de: p.de, ate: p.ate })}
          />
        </header>
      )}

      {dados.isLoading || !d ? (
        <div className="h-40 animate-pulse rounded-2xl bg-secondary" aria-busy="true" />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4 xl:grid-cols-5">
            {cartao(t("Agendados"), String(d.totais.agendados))}
            {cartao(t("Compareceram"), String(d.totais.compareceram))}
            {cartao(t("Faltaram"), String(d.totais.faltaram))}
            {cartao(
              t("Taxa de comparecimento"),
              pct(d.totais.taxaDeComparecimento),
              t("Compareceram ÷ (compareceram + faltaram)"),
              true,
            )}
            {cartao(
              t("Conversão"),
              pct(d.totais.taxaDeConversao),
              t("Dos que compareceram, quantos já compraram"),
              true,
            )}
            {cartao(t("Cancelados"), String(d.totais.cancelados))}
            {cartao(t("Remarcados"), String(d.remarcados), t("Remarcações feitas no período"))}
            {cartao(
              t("Sem desfecho"),
              String(d.totais.semDesfecho),
              t("Já passaram e ninguém declarou"),
            )}
            {cartao(
              t("Confirmaram"),
              String(d.totais.confirmaram),
              t("Responderam ao lembrete confirmando"),
            )}
            {cartao(t("Próximos"), String(d.totais.proximos))}
            {cartao(t("Com oportunidade"), String(d.totais.comOportunidade))}
          </section>

          {tabela(t("Por atendente"), d.porAtendente, nomeDoAtendente)}
          {tabela(t("Por tipo de agendamento"), d.porTipo, nomeDoTipo)}
          {tabela(t("Por campanha"), d.porCampanha, nomeDaCampanha)}

          <section className="rounded-2xl border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">{t("Dia a dia")}</h2>
            {d.porDia.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("Nenhum compromisso no período.")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1.5 pr-3 text-left font-medium">{t("Dia")}</th>
                      <th className="px-2 py-1.5 text-right font-medium">{t("Agendados")}</th>
                      <th className="px-2 py-1.5 text-right font-medium">{t("Compareceram")}</th>
                      <th className="px-2 py-1.5 text-right font-medium">{t("Faltaram")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.porDia.map((x) => (
                      <tr key={x.dia} className="border-t">
                        <td className="py-1.5 pr-3 tabular-nums">
                          {x.dia.split("-").reverse().join("/")}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{x.agendados}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{x.compareceram}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{x.faltaram}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
