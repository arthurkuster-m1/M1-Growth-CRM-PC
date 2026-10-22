"use client";

import { NumeroQueCabe } from "@/components/ui/NumeroQueCabe";
import type { ReactNode } from "react";

import { Painel } from "@/components/dashboards/base";
import { FunilEmColunas } from "@/components/dashboards/funil";
import { rotuloDaMetrica } from "@/components/marketing/campanhas/rotulos";
import { useT } from "@/hooks/i18n/useT";
import type { CampanhaDeDemanda } from "@/lib/marketing/campanhas";
import {
  METRICAS_DO_CANAL,
  resumoDaCampanha,
  somaDoExtra,
  type Alerta,
  type DiaDaCampanha,
} from "@/lib/marketing/campanhas-resumo";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import { agregadoDoDia, somarAgregados } from "@/lib/marketing/colunas-de-resultado";
import { cn } from "@/lib/utils";

const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");
const decimal = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

type Tom = "blue" | "violet" | "green" | "amber" | "rose" | "slate";

const FAIXA: Record<Tom, string> = {
  blue: "border-l-blue-500",
  violet: "border-l-violet-500",
  green: "border-l-emerald-500",
  amber: "border-l-amber-500",
  rose: "border-l-rose-500",
  slate: "border-l-slate-400",
};
const FUNDO: Record<Tom, string> = {
  blue: "bg-blue-500/8",
  violet: "bg-violet-500/8",
  green: "bg-emerald-500/8",
  amber: "bg-amber-500/10",
  rose: "bg-rose-500/8",
  slate: "bg-secondary/60",
};
const BARRA: Record<Tom, string> = {
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
};

function Numero({
  rotulo,
  valor,
  destaque,
  tom,
  fundo,
}: {
  rotulo: string;
  valor: string | null;
  destaque?: boolean;
  tom?: "bom" | "ruim";
  fundo?: Tom;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl px-3 py-2", FUNDO[fundo ?? "slate"])}>
      <p className="truncate text-xs text-muted-foreground">{rotulo}</p>
      <p
        className={cn(
          "mt-0.5 font-semibold tabular-nums",
          destaque ? "text-2xl" : "text-lg",
          tom === "bom" && "text-success-fg",
          tom === "ruim" && "text-error-fg",
          valor === null && "text-muted-foreground",
        )}
      >
        <NumeroQueCabe>{valor ?? "—"}</NumeroQueCabe>
      </p>
    </div>
  );
}

/** Uma barra de progresso com legenda e porcentagem. */
function Barra({
  rotulo,
  detalhe,
  porcentagem,
  tom,
}: {
  rotulo: string;
  detalhe?: string;
  porcentagem: number | null;
  tom: Tom;
}) {
  const p = porcentagem === null ? 0 : Math.max(0, Math.min(100, porcentagem));
  return (
    <div className="col-span-full grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">{rotulo}</span>
        <span className="text-muted-foreground tabular-nums">
          {detalhe ? `${detalhe} · ` : ""}
          <strong className="text-foreground">
            {porcentagem === null ? "—" : pct(porcentagem)}
          </strong>
        </span>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={Math.round(p)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={rotulo}
      >
        <div
          className={cn("h-full rounded-full transition-all", BARRA[tom])}
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}

function Cartao({
  titulo,
  children,
  tom = "slate",
}: {
  titulo: string;
  children: ReactNode;
  tom?: Tom;
}) {
  return (
    <section
      className={cn(
        "grid grid-cols-1 gap-3 rounded-2xl border border-l-4 bg-card p-4 shadow-sm",
        FAIXA[tom],
      )}
    >
      <h3 className="text-sm font-semibold">{titulo}</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>
    </section>
  );
}

function textoDoAlerta(t: (s: string) => string, a: Alerta): string {
  switch (a.codigo) {
    case "sem_periodo":
      return t("Defina início e fim da campanha para ver o pace de gastos e de leads.");
    case "orcamento_estourado":
      return t("O investido passou do orçamento líquido da campanha.");
    case "aumentar_orcamento":
      return `${t("Aumentar o orçamento diário para")} ${moedaDoNumero(a.valor ?? 0)}.`;
    case "testar_criativos":
      return t("Testar novos criativos: o CTR está baixo.");
    case "conexao_da_lp":
      return t("Verificar a conexão da LP: muita gente clica e não carrega a página.");
    case "verificar_lp":
      return t("Verificar a LP: poucas visitas viram lead.");
    case "cpl_acima_da_meta":
      return t("O CPL está acima da meta.");
    case "leads_atrasados":
      return `${t("Leads atrasados em relação à meta de hoje:")} ${inteiro(a.valor ?? 0)}.`;
    case "leads_fora_do_periodo":
      return `${inteiro(a.valor ?? 0)} ${t("leads entraram fora do período da campanha (antes do início ou depois do fim) e já estão somados nos totais.")}`;
    case "no_ritmo":
      return t("Tudo no ritmo: nenhum alerta por enquanto.");
  }
}

/**
 * O RESUMO da campanha: a parte de cima da planilha — período, investimento, metas de leads,
 * pace de gastos, funil completo e o que fazer agora. Recalcula a cada dia digitado.
 */
export function ResumoDaCampanha({
  c,
  dias,
  hoje,
  coorte,
}: {
  c: CampanhaDeDemanda;
  dias: DiaDaCampanha[];
  hoje: string;
  /** O funil dos leads que entraram na campanha (agendaram, fizeram a reunião, compraram). */
  coorte: {
    leads: number;
    agendados: number;
    feitas: number;
    vendas: number;
    faturamento: number;
  } | null;
}) {
  const t = useT();
  const r = resumoDaCampanha(c, dias, hoje);
  // O que o CRM sabe do período inteiro (vendas, total, reuniões): os blocos de Venda e Reunião.
  const totalCrm = somarAgregados(dias.map(agregadoDoDia));
  const funilCrm = coorte ?? {
    leads: r.funil.leads,
    agendados: 0,
    feitas: 0,
    vendas: 0,
    faturamento: 0,
  };
  const comReunioes = funilCrm.agendados > 0 || funilCrm.feitas > 0;
  const dinheiro = (n: number | null) => (n === null ? null : moedaDoNumero(n));
  const trafego = c.channel === "trafego_pago";
  const progresso = r.periodo ? (r.periodo.passados / r.periodo.totais) * 100 : null;
  const adiant = r.metas.adiantamento;
  const progressoLeads =
    r.metas.metaDeLeads && r.metas.metaDeLeads > 0
      ? (r.metas.captados / r.metas.metaDeLeads) * 100
      : null;
  const orcamentoGasto =
    r.investimentoLiquido !== null && r.investimentoLiquido > 0
      ? (r.funil.investido / r.investimentoLiquido) * 100
      : null;
  const ajuste = r.pace.ajusteDiario;
  // Menos de 5% de diferença é "no ritmo"; acima disso, quanto gastar a mais ou a menos por dia.
  const noRitmo =
    ajuste !== null &&
    r.pace.ideal !== null &&
    Math.abs(ajuste) <= Math.max(r.pace.ideal * 0.05, 0.5);

  return (
    <div className="grid grid-cols-1 gap-3">
      {r.alertas.length > 0 ? (
        <section className="grid grid-cols-1 gap-2 rounded-2xl border border-l-4 border-l-amber-500 bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">{t("O que fazer agora")}</h3>
          <ul className="grid grid-cols-1 gap-1.5">
            {r.alertas.map((a) => (
              <li
                key={a.codigo}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm",
                  a.nivel === "atencao" && "bg-warning-bg text-warning-fg",
                  a.nivel === "ok" && "bg-success-bg text-success-fg",
                  a.nivel === "info" && "bg-secondary text-foreground",
                )}
              >
                {textoDoAlerta(t, a)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {trafego ? (
        <Painel titulo={t("Metas de leads")}>
          <div className="grid gap-4">
            <Barra
              rotulo={t("Leads captados da meta")}
              detalhe={
                r.metas.metaDeLeads === null
                  ? undefined
                  : `${inteiro(r.metas.captados)} / ${inteiro(r.metas.metaDeLeads)}`
              }
              porcentagem={progressoLeads}
              tom="blue"
            />
            <FunilEmColunas
              colunas={[
                {
                  rotulo: t("Meta de leads até hoje"),
                  valor: r.metas.metaParaHoje === null ? "—" : inteiro(r.metas.metaParaHoje),
                  itens: [
                    { rotulo: t("Leads captados"), valor: inteiro(r.metas.captados) },
                    {
                      rotulo: t("Quantos faltam"),
                      valor:
                        r.metas.metaParaHoje === null
                          ? "—"
                          : inteiro(Math.max(0, r.metas.metaParaHoje - r.metas.captados)),
                    },
                  ],
                },
                {
                  rotulo: t("Meta de CPL"),
                  valor: dinheiro(r.metas.metaDeCpl) ?? "—",
                  itens: [
                    {
                      rotulo: t("CPL atual"),
                      valor: (
                        <span
                          className={cn(
                            r.funil.cpl !== null &&
                              r.metas.metaDeCpl !== null &&
                              (r.funil.cpl <= r.metas.metaDeCpl
                                ? "text-success-fg"
                                : "text-error-fg"),
                          )}
                        >
                          {dinheiro(r.funil.cpl) ?? "—"}
                        </span>
                      ),
                    },
                    {
                      rotulo: t("CPL necessário"),
                      valor: dinheiro(r.metas.cplNecessario) ?? "—",
                    },
                  ],
                },
                {
                  rotulo: t("Meta de leads por dia"),
                  valor: r.metas.porDia === null ? "—" : decimal(r.metas.porDia),
                  itens: [
                    {
                      rotulo: t("Leads por dia"),
                      valor: (
                        <span
                          className={cn(
                            r.metas.mediaPorDia !== null &&
                              r.metas.porDia !== null &&
                              (r.metas.mediaPorDia >= r.metas.porDia
                                ? "text-success-fg"
                                : "text-error-fg"),
                          )}
                        >
                          {r.metas.mediaPorDia === null ? "—" : decimal(r.metas.mediaPorDia)}
                        </span>
                      ),
                    },
                    {
                      rotulo: t("Nova meta por dia"),
                      valor:
                        r.metas.novaMetaDiaria === null ? "—" : decimal(r.metas.novaMetaDiaria),
                    },
                  ],
                },
                {
                  rotulo:
                    c.continuous || !c.end_date
                      ? t("Meta de leads do mês")
                      : t("Meta de leads da campanha"),
                  valor: r.metas.metaDeLeads === null ? "—" : inteiro(r.metas.metaDeLeads),
                  itens: [
                    {
                      rotulo: t("Previsão de leads"),
                      valor: r.metas.previsaoTotal === null ? "—" : inteiro(r.metas.previsaoTotal),
                    },
                    {
                      rotulo: t("Meta × previsão"),
                      valor:
                        r.metas.diferencaDaPrevisao === null ? (
                          "—"
                        ) : (
                          <span
                            className={
                              r.metas.diferencaDaPrevisao >= 0 ? "text-success-fg" : "text-error-fg"
                            }
                          >
                            {r.metas.diferencaDaPrevisao >= 0 ? "+" : "−"}
                            {inteiro(Math.abs(r.metas.diferencaDaPrevisao))}
                          </span>
                        ),
                    },
                  ],
                },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              {t("Previsão = leads captados + verba restante ÷ CPL médio dos 3 últimos dias.")}
            </p>
          </div>
        </Painel>
      ) : null}

      <Cartao titulo={t("Dias")} tom="violet">
        <Barra
          rotulo={t("Tempo da campanha que já passou")}
          detalhe={
            r.periodo ? `${inteiro(r.periodo.passados)} / ${inteiro(r.periodo.totais)}` : undefined
          }
          porcentagem={progresso}
          tom="violet"
        />
        <Numero
          rotulo={t("Dias totais")}
          valor={r.periodo ? inteiro(r.periodo.totais) : null}
          fundo="violet"
        />
        <Numero
          rotulo={t("Dias passados")}
          valor={r.periodo ? inteiro(r.periodo.passados) : null}
          fundo="violet"
        />
        <Numero
          rotulo={t("Dias restantes")}
          valor={r.periodo ? inteiro(r.periodo.restantes) : null}
          fundo="violet"
        />
      </Cartao>

      <Painel titulo={t("Pace de gastos")}>
        <div className="grid gap-4">
          <Barra
            rotulo={t("Orçamento já gasto")}
            detalhe={
              r.investimentoLiquido === null
                ? undefined
                : `${moedaDoNumero(r.funil.investido)} / ${moedaDoNumero(r.investimentoLiquido)}`
            }
            porcentagem={orcamentoGasto}
            tom={orcamentoGasto !== null && orcamentoGasto > 100 ? "rose" : "green"}
          />
          <FunilEmColunas
            colunas={[
              {
                rotulo: t("Investimento bruto"),
                valor: dinheiro(r.investimentoBruto) ?? "—",
                itens: [
                  {
                    rotulo: t("Investimento líquido"),
                    valor: dinheiro(r.investimentoLiquido) ?? "—",
                  },
                  { rotulo: t("Valor investido"), valor: moedaDoNumero(r.funil.investido) },
                ],
              },
              {
                rotulo: t("Verba restante"),
                valor: dinheiro(r.valorRestante) ?? "—",
                itens: [
                  {
                    rotulo: t("Valor diário atual"),
                    valor: dinheiro(r.pace.atualUltimosDias) ?? "—",
                  },
                  { rotulo: t("Valor diário ideal"), valor: dinheiro(r.pace.ideal) ?? "—" },
                ],
              },
            ]}
          />
          {ajuste !== null ? (
            <p
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium",
                noRitmo
                  ? "bg-success-bg text-success-fg"
                  : ajuste > 0
                    ? "bg-warning-bg text-warning-fg"
                    : "bg-secondary text-foreground",
              )}
            >
              {noRitmo
                ? t("No ritmo: o gasto diário atual está igual ao ideal.")
                : ajuste > 0
                  ? `${t("Gastar")} ${moedaDoNumero(ajuste)} ${t("a mais por dia para fechar o orçamento.")}`
                  : `${t("Gastar")} ${moedaDoNumero(Math.abs(ajuste))} ${t("a menos por dia para não estourar o orçamento.")}`}
            </p>
          ) : null}
        </div>
      </Painel>

      {trafego ? (
        <Painel titulo={t("Funil completo")} nota={t("Na ordem em que acontece")}>
          <FunilEmColunas
            colunas={[
              {
                rotulo: t("Impressões"),
                valor: inteiro(r.funil.impressoes),
                itens: [
                  {
                    rotulo: t("Frequência"),
                    valor:
                      r.funil.alcance > 0
                        ? (r.funil.impressoes / r.funil.alcance).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "—",
                  },
                  { rotulo: t("CPM"), valor: dinheiro(r.funil.cpm) ?? "—" },
                ],
              },
              {
                rotulo: t("Cliques no link"),
                valor: inteiro(r.funil.cliques),
                itens: [
                  { rotulo: t("CPC"), valor: dinheiro(r.funil.cpc) ?? "—" },
                  { rotulo: t("CTR"), valor: r.funil.ctr === null ? "—" : pct(r.funil.ctr) },
                ],
              },
              {
                rotulo: t("Visitas à LP"),
                valor: inteiro(r.funil.visitas),
                itens: [
                  { rotulo: t("Custo por visita"), valor: dinheiro(r.funil.custoPorVisita) ?? "—" },
                  {
                    rotulo: t("Connect rate"),
                    valor: r.funil.connectionRate === null ? "—" : pct(r.funil.connectionRate),
                  },
                ],
              },
              {
                rotulo: t("Leads"),
                valor: inteiro(r.funil.leads),
                itens: [
                  { rotulo: t("CPL"), valor: dinheiro(r.funil.cpl) ?? "—" },
                  {
                    rotulo: t("Conversão da LP"),
                    valor: r.funil.conversaoDaLp === null ? "—" : pct(r.funil.conversaoDaLp),
                  },
                ],
              },
              ...(comReunioes
                ? [
                    {
                      rotulo: t("Reuniões agendadas"),
                      valor: inteiro(funilCrm.agendados),
                      itens: [
                        {
                          rotulo: t("Custo por agendamento"),
                          valor:
                            funilCrm.agendados > 0 && r.funil.investido > 0
                              ? moedaDoNumero(r.funil.investido / funilCrm.agendados)
                              : "—",
                        },
                        {
                          rotulo: t("Taxa de agendamento"),
                          valor:
                            funilCrm.leads > 0
                              ? pct((funilCrm.agendados / funilCrm.leads) * 100)
                              : "—",
                        },
                      ],
                    },
                    {
                      rotulo: t("Reuniões feitas"),
                      valor: inteiro(funilCrm.feitas),
                      itens: [
                        {
                          rotulo: t("Custo por reunião"),
                          valor:
                            funilCrm.feitas > 0 && r.funil.investido > 0
                              ? moedaDoNumero(r.funil.investido / funilCrm.feitas)
                              : "—",
                        },
                        {
                          rotulo: t("Taxa de comparecimento"),
                          valor:
                            funilCrm.agendados > 0
                              ? pct((funilCrm.feitas / funilCrm.agendados) * 100)
                              : "—",
                        },
                      ],
                    },
                  ]
                : []),
              {
                rotulo: t("Vendas"),
                valor: inteiro(funilCrm.vendas),
                itens: [
                  {
                    rotulo: t("Total de vendas"),
                    valor: moedaDoNumero(funilCrm.faturamento),
                  },
                  {
                    rotulo: t("CAC"),
                    valor:
                      funilCrm.vendas > 0 && r.funil.investido > 0
                        ? moedaDoNumero(r.funil.investido / funilCrm.vendas)
                        : "—",
                  },
                  {
                    rotulo: t("Conversão dos leads"),
                    valor: funilCrm.leads > 0 ? pct((funilCrm.vendas / funilCrm.leads) * 100) : "—",
                  },
                ],
              },
            ]}
          />
        </Painel>
      ) : (
        <FunilDoCanal c={c} dias={dias} leads={r.funil.leads} investido={r.funil.investido} />
      )}
    </div>
  );
}

/** Os canais sem API: os totais de cada etapa e a taxa de uma etapa para a seguinte. */
function FunilDoCanal({
  c,
  dias,
  leads,
  investido,
}: {
  c: CampanhaDeDemanda;
  dias: DiaDaCampanha[];
  leads: number;
  investido: number;
}) {
  const t = useT();
  if (c.channel === "trafego_pago") return null;
  const metricas = METRICAS_DO_CANAL[c.channel];
  // Cada etapa com a taxa em relação à anterior (calculada à parte: sem variável mudando no render).
  const totais = metricas
    .filter((m) => m.tipo === "contagem")
    .map((m) => ({ m, total: somaDoExtra(dias, m.chave) }));
  const etapas = totais.map((e, i) => {
    const anterior = i > 0 ? totais[i - 1]!.total : null;
    return { ...e, taxa: anterior !== null && anterior > 0 ? (e.total / anterior) * 100 : null };
  });
  const vendas = somaDoExtra(dias, "vendas");
  const valor = somaDoExtra(dias, "valor_total");
  return (
    <>
      <Cartao titulo={t("Resultado do canal")}>
        <Numero rotulo={t("Valor investido")} valor={moedaDoNumero(investido)} />
        <Numero rotulo={t("Leads")} valor={inteiro(leads)} />
        <Numero
          rotulo={t("Custo por lead")}
          valor={leads > 0 && investido > 0 ? moedaDoNumero(investido / leads) : null}
        />
        <Numero rotulo={t("Vendas")} valor={inteiro(vendas)} />
        <Numero rotulo={t("Valor total")} valor={moedaDoNumero(valor)} />
        <Numero
          rotulo={t("Ticket médio")}
          valor={vendas > 0 ? moedaDoNumero(valor / vendas) : null}
        />
      </Cartao>
      <Cartao titulo={t("Funil do canal")}>
        {etapas.map(({ m, total, taxa }) => {
          return (
            <Numero
              key={m.chave}
              rotulo={
                taxa === null
                  ? rotuloDaMetrica(t, m.chave)
                  : `${rotuloDaMetrica(t, m.chave)} (${pct(taxa)})`
              }
              valor={inteiro(total)}
            />
          );
        })}
      </Cartao>
    </>
  );
}
