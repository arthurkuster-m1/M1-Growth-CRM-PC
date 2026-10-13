"use client";

import { useState } from "react";

import {
  FiltroDePeriodoDaCampanha,
  usePeriodoDaCampanha,
} from "@/components/marketing/campanhas/FiltroDePeriodoDaCampanha";
import { rotuloDaMetrica } from "@/components/marketing/campanhas/rotulos";
import { useT } from "@/hooks/i18n/useT";
import {
  METRICAS_DO_CANAL,
  hojeIso,
  linhasDoPeriodo,
  type DiaDaCampanha,
} from "@/lib/marketing/campanhas-resumo";
import type { CampanhaDeDemanda, CanalDaCampanha } from "@/lib/marketing/campanhas";
import { periodoPadraoDaCampanha } from "@/lib/marketing/periodo-da-campanha";
import { cn } from "@/lib/utils";

/** Uma coluna da tabela: o nome, onde o valor mora e se é dinheiro. */
interface Coluna {
  chave: string;
  rotulo: string;
  dinheiro: boolean;
  ler: (d: DiaDaCampanha) => number;
}

function colunasDoCanal(
  t: (s: string) => string,
  canal: CanalDaCampanha,
  automatico: { chaves: string[]; investimento: boolean },
): Coluna[] {
  const fixa = (
    chave: string,
    rotulo: string,
    campo: "impressions" | "reach" | "link_clicks" | "lp_views" | "leads" | "spend",
  ): Coluna => ({
    chave,
    rotulo,
    dinheiro: campo === "spend",
    ler: (d) => d[campo],
  });
  if (canal === "trafego_pago") {
    return [
      fixa("impressions", t("Impressões"), "impressions"),
      fixa("reach", t("Alcance"), "reach"),
      fixa("link_clicks", t("Cliques no link"), "link_clicks"),
      fixa("lp_views", t("Visitas à LP"), "lp_views"),
      fixa("leads", t("Leads (CRM)"), "leads"),
      fixa("spend", t("Investido"), "spend"),
    ];
  }
  // Só as colunas que o sistema calcula sozinho.
  return [
    fixa("leads", t("Leads (CRM)"), "leads"),
    ...(automatico.investimento ? [fixa("spend", t("Investido"), "spend")] : []),
    ...METRICAS_DO_CANAL[canal]
      .filter((m) => automatico.chaves.includes(m.chave))
      .map((m): Coluna => ({
        chave: m.chave,
        rotulo: rotuloDaMetrica(t, m.chave),
        dinheiro: m.tipo === "moeda",
        ler: (d) => d.extras[m.chave] ?? 0,
      })),
  ];
}

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/**
 * O DIA A DIA da campanha (a "aba diária" da planilha): uma linha por dia, editável na própria
 * tabela. Os canais com API (Meta) preenchem sozinhos na próxima sessão; os outros — e quem
 * prefere — digitam ou colam a planilha.
 */
export function DiaADiaDaCampanha({
  canal,
  campanha,
  dias,
  funilDefinido,
  automatico,
}: {
  canal: CanalDaCampanha;
  campanha: Pick<CampanhaDeDemanda, "start_date" | "end_date" | "continuous">;
  funilDefinido: boolean;
  dias: DiaDaCampanha[];
  /** Fora do tráfego pago: o que o sistema calcula sozinho (nada se digita). */
  automatico: { chaves: string[]; investimento: boolean };
}) {
  const t = useT();
  const colunas = colunasDoCanal(t, canal, automatico);
  const [soComDados, setSoComDados] = useState(false);
  const hoje = hojeIso();
  const periodo = usePeriodoDaCampanha(periodoPadraoDaCampanha(campanha, hoje));
  const ordenados = linhasDoPeriodo(dias, periodo.janela.de, periodo.janela.ate, soComDados);

  return (
    <section className="grid grid-cols-1 gap-3 rounded-2xl border border-l-4 border-l-blue-500 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("Dia a dia")}</h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FiltroDePeriodoDaCampanha periodo={periodo} />
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <input
            type="checkbox"
            checked={soComDados}
            onChange={(e) => setSoComDados(e.target.checked)}
          />
          {t("Só os dias com dados")}
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        {funilDefinido
          ? t(
              "Os leads vêm do CRM: cada contato que entra no funil da campanha conta no dia em que entrou.",
            )
          : t("Escolha o funil da campanha (em Cadastro) para contar os leads do CRM.")}
      </p>
      <p className="text-xs text-muted-foreground">
        {canal === "trafego_pago"
          ? t(
              "Tudo é calculado automaticamente: os números de anúncio vêm do Meta e os leads, do CRM.",
            )
          : t(
              "Tudo é calculado automaticamente a partir do que o sistema já sabe: vendas pagas, ações registradas na ficha dos leads, leads do CRM e o orçamento da campanha.",
            )}
      </p>

      {ordenados.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {t("Nenhum dia com dados neste período.")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-secondary/60 text-xs text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-secondary px-3 py-2 text-left font-medium">
                  {t("Dia")}
                </th>
                {colunas.map((c) => (
                  <th key={c.chave} className="px-2 py-2 text-right font-medium whitespace-nowrap">
                    {c.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenados.map((d) => (
                <tr
                  key={d.day}
                  className={cn("border-t", d.day === hoje && "bg-primary/5")}
                  aria-current={d.day === hoje ? "date" : undefined}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-10 bg-card px-3 py-1 text-left whitespace-nowrap tabular-nums",
                    )}
                  >
                    {dataBr(d.day)}
                  </td>
                  {colunas.map((c) => (
                    <td key={c.chave} className="px-2 py-1.5 text-right tabular-nums">
                      {c.dinheiro
                        ? c.ler(d).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : c.ler(d)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
