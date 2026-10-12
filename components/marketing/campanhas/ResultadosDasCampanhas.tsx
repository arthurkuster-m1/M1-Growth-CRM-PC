"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { PERIODOS, type Periodo } from "@/lib/marketing/periodos";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import { cn } from "@/lib/utils";

interface Linha {
  id: string;
  name: string;
  channel: string;
  status: string;
  goal_leads: number | null;
  goal_sales: number | null;
  goal_revenue: number | null;
  goal_cpl: number | null;
  investido: number;
  leads: number;
  vendas: number;
  recebido: number;
  a_receber: number;
}

const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

function rotuloDoPeriodo(t: (s: string) => string, p: Periodo): string {
  switch (p) {
    case "hoje":
      return t("Hoje");
    case "ontem":
      return t("Ontem");
    case "ultimos_5_dias":
      return t("Últimos 5 dias");
    case "ultimos_7_dias":
      return t("Últimos 7 dias");
    case "ultimos_30_dias":
      return t("Últimos 30 dias");
    case "semana":
      return t("Esta semana");
    case "mes":
      return t("Este mês");
    case "mes_passado":
      return t("Mês passado");
  }
}

/**
 * OS RESULTADOS de todas as campanhas num período: investido, leads, CPL, vendas, CAC,
 * faturamento recebido, a receber e ROAS — os mesmos números das metas automáticas. Trocar o
 * período recalcula tudo.
 */
export function ResultadosDasCampanhas() {
  const t = useT();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const consulta = useQuery({
    queryKey: ["demand-campaigns-resultados", periodo],
    staleTime: 30_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { de: string; ate: string; linhas: Linha[] } }>(
          `/api/v1/demand-campaigns/resultados?periodo=${periodo}`,
        )
      ).data,
  });
  const linhas = (consulta.data?.linhas ?? []).filter(
    (l) => l.investido > 0 || l.leads > 0 || l.vendas > 0 || l.recebido > 0 || l.a_receber > 0,
  );
  const total = linhas.reduce(
    (s, l) => ({
      investido: s.investido + l.investido,
      leads: s.leads + l.leads,
      vendas: s.vendas + l.vendas,
      recebido: s.recebido + l.recebido,
      a_receber: s.a_receber + l.a_receber,
    }),
    { investido: 0, leads: 0, vendas: 0, recebido: 0, a_receber: 0 },
  );
  const cpl = (inv: number, leads: number) => (leads > 0 && inv > 0 ? inv / leads : null);
  const cac = (inv: number, vendas: number) => (vendas > 0 && inv > 0 ? inv / vendas : null);
  const roas = (inv: number, rec: number) => (inv > 0 && rec > 0 ? rec / inv : null);
  const reais = (n: number | null) => (n === null ? "—" : moedaDoNumero(n));
  const x = (n: number | null) =>
    n === null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`;

  const cartoes: Array<[string, string]> = [
    [t("Investido"), moedaDoNumero(total.investido)],
    [t("Leads"), inteiro(total.leads)],
    [t("CPL"), reais(cpl(total.investido, total.leads))],
    [t("Vendas fechadas"), inteiro(total.vendas)],
    [t("Faturamento recebido"), moedaDoNumero(total.recebido)],
    [t("ROAS"), x(roas(total.investido, total.recebido))],
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("Resultados das campanhas")}</h2>
          {consulta.data ? (
            <p className="text-xs text-muted-foreground">
              {dataBr(consulta.data.de)} → {dataBr(consulta.data.ate)}
            </p>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t("Período")}
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
            className="h-10 rounded-xl border bg-background px-3 text-sm text-foreground"
          >
            {PERIODOS.map((p) => (
              <option key={p} value={p}>
                {rotuloDoPeriodo(t, p)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3 xl:grid-cols-6">
        {cartoes.map(([rotulo, valor]) => (
          <div key={rotulo} className="bg-card px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {rotulo}
            </p>
            <p className="mt-1 truncate text-xl font-semibold tabular-nums">{valor}</p>
          </div>
        ))}
      </section>

      {consulta.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-secondary" aria-busy="true" />
      ) : linhas.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
          {t("Nenhuma campanha teve movimento neste período.")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-secondary/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t("Campanha")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("Investido")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("Leads")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("CPL")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("Vendas")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("CAC")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("Recebido")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("A receber")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("ROAS")}</th>
              </tr>
            </thead>
            <tbody>
              {linhas
                .sort((a, b) => b.recebido - a.recebido || b.leads - a.leads)
                .map((l) => {
                  const c = cpl(l.investido, l.leads);
                  return (
                    <tr key={l.id} className="border-t">
                      <td className="max-w-72 truncate px-3 py-2 font-medium">{l.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {moedaDoNumero(l.investido)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{inteiro(l.leads)}</td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          c !== null &&
                            l.goal_cpl !== null &&
                            (c <= l.goal_cpl ? "text-success-fg" : "text-error-fg"),
                        )}
                      >
                        {reais(c)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{inteiro(l.vendas)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {reais(cac(l.investido, l.vendas))}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {moedaDoNumero(l.recebido)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {moedaDoNumero(l.a_receber)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {x(roas(l.investido, l.recebido))}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {t(
          "Leads e vendas vêm do CRM; investido, do Meta. O faturamento conta só o que de fato caiu no período (parcelas recebidas); “a receber” é o que está comprometido com vencimento no período.",
        )}
      </p>
    </div>
  );
}
