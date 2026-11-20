"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Kpi, Painel, brl, inteiro, pct, vezes, GradeDeKpis } from "@/components/dashboards/base";
import { FunilEmColunas } from "@/components/dashboards/funil";
import { useT } from "@/hooks/i18n/useT";
import {
  derivarTrafego,
  type BrutoDeTrafego,
  type DerivadasDeTrafego,
} from "@/lib/dashboards/metricas-de-trafego";
import { cn } from "@/lib/utils";

/** Um item que se escolhe na visão: uma campanha, um conjunto, um criativo, uma página, um canal. */
export interface ItemSegmentado {
  id: string;
  nome: string;
  /** Uma linha de contexto (a campanha de um conjunto, por exemplo). */
  apoio?: string;
  bruto: BrutoDeTrafego;
  /** Sem entrega nem gasto próprios: as contas de mídia aparecem como "—". */
  semMidia?: boolean;
}

const MAXIMO_NA_COMPARACAO = 4;

const decimal = (v: number | null) =>
  v === null
    ? "—"
    : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const p1 = (v: number | null) => (v === null ? "—" : pct(v, 1));
const p2 = (v: number | null) => (v === null ? "—" : pct(v, 2));
const reais = (v: number | null) => (v === null ? "—" : brl(v));

/** O funil completo de UM item, no mesmo desenho da visão geral. */
function FunilDoItem({ d }: { d: DerivadasDeTrafego }) {
  const t = useT();
  return (
    <FunilEmColunas
      colunas={[
        {
          rotulo: t("Impressões"),
          valor: inteiro(d.impressoes),
          itens: [
            { rotulo: t("Frequência"), valor: decimal(d.frequencia) },
            { rotulo: t("CPM"), valor: reais(d.cpm) },
          ],
        },
        {
          rotulo: t("Cliques no link"),
          valor: inteiro(d.cliques),
          itens: [
            { rotulo: t("CPC"), valor: reais(d.cpc) },
            { rotulo: t("CTR"), valor: p2(d.ctr) },
          ],
        },
        {
          rotulo: t("Visitas à LP"),
          valor: inteiro(d.viewsLP),
          itens: [
            { rotulo: t("CP visita LP"), valor: reais(d.cpVisitaLP) },
            { rotulo: t("Connect rate"), valor: p2(d.connect) },
          ],
        },
        {
          rotulo: t("Leads"),
          valor: inteiro(d.leads),
          itens: [
            { rotulo: t("CPL"), valor: reais(d.cpl) },
            { rotulo: t("Conversão da LP"), valor: p2(d.convLP) },
          ],
        },
        {
          rotulo: t("Vendas"),
          valor: inteiro(d.vendas),
          itens: [
            { rotulo: t("CAC"), valor: reais(d.cac) },
            { rotulo: t("Taxa de conversão"), valor: p2(d.convVenda) },
          ],
        },
      ]}
    />
  );
}

/** Os blocos de número de UM item (faturamento, investido, lucro, ROAS, leads, CPL, vendas, CAC). */
function BlocosDoItem({ d, nome }: { d: DerivadasDeTrafego; nome: string }) {
  const t = useT();
  return (
    <GradeDeKpis className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 lg:grid-cols-4">
      <Kpi rotulo={t("Faturamento recebido")} valor={brl(d.recebido)} destaque apoio={nome} />
      <Kpi rotulo={t("Investido no período")} valor={reais(d.investimento)} apoio={nome} />
      <Kpi rotulo={t("Lucro")} valor={brl(d.lucro)} apoio={t("Recebido − investido")} />
      <Kpi rotulo={t("ROAS")} valor={d.roas === null ? "—" : vezes(d.roas)} destaque />
      <Kpi rotulo={t("Leads")} valor={inteiro(d.leads)} />
      <Kpi rotulo={t("CPL")} valor={reais(d.cpl)} apoio={t("Investido ÷ leads")} />
      <Kpi rotulo={t("Vendas")} valor={inteiro(d.vendas)} />
      <Kpi rotulo={t("CAC")} valor={reais(d.cac)} apoio={t("Investido ÷ vendas")} />
    </GradeDeKpis>
  );
}

interface LinhaDaComparacao {
  id: string;
  rotulo: string;
  valor: (d: DerivadasDeTrafego) => number | null;
  formato: (v: number | null) => string;
  /** Qual é o melhor: o maior, o menor, ou nenhum (só informa). */
  melhor?: "maior" | "menor";
}

/** Os itens escolhidos lado a lado, métrica por métrica, com o melhor de cada linha em destaque. */
function Comparacao({
  itens,
}: {
  itens: ReadonlyArray<{ item: ItemSegmentado; d: DerivadasDeTrafego }>;
}) {
  const t = useT();
  const linhas: LinhaDaComparacao[] = [
    {
      id: "recebido",
      rotulo: t("Faturamento recebido"),
      valor: (d) => d.recebido,
      formato: reais,
      melhor: "maior",
    },
    { id: "investimento", rotulo: t("Investido"), valor: (d) => d.investimento, formato: reais },
    { id: "lucro", rotulo: t("Lucro"), valor: (d) => d.lucro, formato: reais, melhor: "maior" },
    {
      id: "roas",
      rotulo: t("ROAS"),
      valor: (d) => d.roas,
      formato: (v) => (v === null ? "—" : vezes(v)),
      melhor: "maior",
    },
    {
      id: "impressoes",
      rotulo: t("Impressões"),
      valor: (d) => d.impressoes,
      formato: (v) => inteiro(v),
    },
    { id: "cpm", rotulo: t("CPM"), valor: (d) => d.cpm, formato: reais, melhor: "menor" },
    {
      id: "cliques",
      rotulo: t("Cliques no link"),
      valor: (d) => d.cliques,
      formato: (v) => inteiro(v),
    },
    { id: "ctr", rotulo: t("CTR"), valor: (d) => d.ctr, formato: p2, melhor: "maior" },
    { id: "cpc", rotulo: t("CPC"), valor: (d) => d.cpc, formato: reais, melhor: "menor" },
    {
      id: "viewsLP",
      rotulo: t("Visitas à LP"),
      valor: (d) => d.viewsLP,
      formato: (v) => inteiro(v),
    },
    {
      id: "connect",
      rotulo: t("Connect rate"),
      valor: (d) => d.connect,
      formato: p1,
      melhor: "maior",
    },
    {
      id: "leads",
      rotulo: t("Leads"),
      valor: (d) => d.leads,
      formato: (v) => inteiro(v),
      melhor: "maior",
    },
    { id: "cpl", rotulo: t("CPL"), valor: (d) => d.cpl, formato: reais, melhor: "menor" },
    {
      id: "convLP",
      rotulo: t("Conversão da LP"),
      valor: (d) => d.convLP,
      formato: p1,
      melhor: "maior",
    },
    {
      id: "vendas",
      rotulo: t("Vendas"),
      valor: (d) => d.vendas,
      formato: (v) => inteiro(v),
      melhor: "maior",
    },
    {
      id: "convVenda",
      rotulo: t("Taxa de conversão"),
      valor: (d) => d.convVenda,
      formato: p2,
      melhor: "maior",
    },
    { id: "cac", rotulo: t("CAC"), valor: (d) => d.cac, formato: reais, melhor: "menor" },
  ];

  const indiceDoMelhor = (l: LinhaDaComparacao): number => {
    if (!l.melhor) return -1;
    const valores = itens.map((x) => l.valor(x.d));
    const validos = valores.filter((v): v is number => v !== null);
    if (validos.length < 2) return -1;
    const alvo = l.melhor === "maior" ? Math.max(...validos) : Math.min(...validos);
    // empate geral: ninguém é "o melhor"
    if (validos.every((v) => v === alvo)) return -1;
    return valores.indexOf(alvo);
  };

  return (
    <div className="max-w-full overflow-x-auto rounded-xl border">
      <table className="w-full min-w-max text-sm">
        <thead className="bg-secondary/60 text-xs text-muted-foreground">
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 bg-secondary px-3 py-2 text-left font-medium"
            >
              {t("Métrica")}
            </th>
            {itens.map((x) => (
              <th key={x.item.id} scope="col" className="max-w-56 px-3 py-2 text-right font-medium">
                <span className="block truncate text-foreground" title={x.item.nome}>
                  {x.item.nome}
                </span>
                {x.item.apoio ? (
                  <span className="block truncate text-[10px] font-normal">{x.item.apoio}</span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const melhor = indiceDoMelhor(l);
            return (
              <tr key={l.id} className="border-t">
                <th
                  scope="row"
                  className="sticky left-0 z-[1] bg-card px-3 py-2 text-left font-medium whitespace-nowrap"
                >
                  {l.rotulo}
                </th>
                {itens.map((x, i) => (
                  <td
                    key={x.item.id}
                    className={cn(
                      "px-3 py-2 text-right whitespace-nowrap tabular-nums",
                      i === melhor && "bg-primary/10 font-bold text-primary",
                    )}
                  >
                    {l.formato(l.valor(x.d))}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A visão de UM TIPO de item (campanha, conjunto, criativo, página, canal): escolhe-se o item em
 * cima, os blocos e o funil completo mostram SÓ ele, e dá para ligar "Comparar" e escolher até
 * quatro lado a lado. A tabela com todos continua disponível no alternador "Tabela".
 */
export function VisaoSegmentada({
  itens,
  tabela,
  tituloDoSeletor,
  nota,
}: {
  itens: readonly ItemSegmentado[];
  /** A tabela de sempre, mostrada no modo "Tabela". */
  tabela: ReactNode;
  /** Ex.: "Campanhas". */
  tituloDoSeletor: string;
  nota?: string;
}) {
  const t = useT();
  const [modo, setModo] = useState<"blocos" | "tabela">("blocos");
  const [comparar, setComparar] = useState(false);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);

  // Quem mais investiu (ou faturou) vem primeiro.
  const ordenados = useMemo(
    () =>
      [...itens].sort(
        (a, b) =>
          b.bruto.investimento - a.bruto.investimento || b.bruto.recebido - a.bruto.recebido,
      ),
    [itens],
  );

  // Escolha válida: o que sumiu da lista (outro período) cai fora; sem nada, vale o primeiro.
  const validos = escolhidos.filter((id) => ordenados.some((i) => i.id === id));
  const ativos = validos.length > 0 ? validos : ordenados[0] ? [ordenados[0].id] : [];

  const escolher = (id: string) => {
    if (!comparar) return setEscolhidos([id]);
    if (ativos.includes(id)) {
      if (ativos.length > 1) setEscolhidos(ativos.filter((x) => x !== id));
      return;
    }
    if (ativos.length >= MAXIMO_NA_COMPARACAO) return;
    setEscolhidos([...ativos, id]);
  };

  const calculados = ativos.flatMap((id) => {
    const item = ordenados.find((i) => i.id === id);
    return item ? [{ item, d: derivarTrafego(item.bruto, item.semMidia) }] : [];
  });

  const botao = (ativo: boolean) =>
    cn(
      "h-8 rounded-full px-3 text-xs font-semibold transition-colors",
      ativo ? "bg-deep text-deep-foreground" : "text-foreground hover:bg-secondary",
    );

  return (
    <div className="grid min-w-0 gap-4">
      <Painel
        titulo={tituloDoSeletor}
        nota={nota ?? `${ordenados.length}`}
        acao={
          <div className="flex items-center gap-1 rounded-full border bg-card p-0.5">
            <button
              type="button"
              className={botao(modo === "blocos")}
              onClick={() => setModo("blocos")}
            >
              {t("Blocos")}
            </button>
            <button
              type="button"
              className={botao(modo === "tabela")}
              onClick={() => setModo("tabela")}
            >
              {t("Tabela")}
            </button>
          </div>
        }
      >
        {modo === "blocos" ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {comparar
                  ? `${t("Escolha até")} ${MAXIMO_NA_COMPARACAO} ${t("para comparar")} (${ativos.length}/${MAXIMO_NA_COMPARACAO})`
                  : t("Escolha um para ver o relatório completo dele")}
              </span>
              <button
                type="button"
                aria-pressed={comparar}
                onClick={() => {
                  setComparar((c) => !c);
                  setEscolhidos(ativos.slice(0, 1));
                }}
                className={cn(
                  "h-8 rounded-full border px-3 text-xs font-semibold transition-colors",
                  comparar
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-card hover:bg-secondary",
                )}
              >
                {t("Comparar")}
              </button>
            </div>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {ordenados.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("Nada neste período.")}</p>
              ) : null}
              {ordenados.map((i) => {
                const marcado = ativos.includes(i.id);
                return (
                  <button
                    key={i.id}
                    type="button"
                    aria-pressed={marcado}
                    onClick={() => escolher(i.id)}
                    title={i.apoio ? `${i.nome} — ${i.apoio}` : i.nome}
                    className={cn(
                      "max-w-64 rounded-full border px-3.5 py-1.5 text-left text-sm font-medium transition-colors",
                      marcado
                        ? "border-deep bg-deep font-bold text-deep-foreground"
                        : "bg-card hover:bg-secondary",
                    )}
                  >
                    <span className="block truncate">{i.nome}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          tabela
        )}
      </Painel>

      {modo === "blocos" && calculados.length === 1 && calculados[0] ? (
        <>
          <BlocosDoItem d={calculados[0].d} nome={calculados[0].item.nome} />
          <Painel
            titulo={t("Funil completo")}
            nota={calculados[0].item.apoio ?? calculados[0].item.nome}
          >
            <FunilDoItem d={calculados[0].d} />
          </Painel>
        </>
      ) : null}

      {modo === "blocos" && calculados.length > 1 ? (
        <Painel titulo={t("Comparação")} nota={t("O melhor de cada linha fica em destaque")}>
          <Comparacao itens={calculados} />
        </Painel>
      ) : null}
    </div>
  );
}
