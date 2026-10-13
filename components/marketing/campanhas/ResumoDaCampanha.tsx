"use client";

import type { ReactNode } from "react";

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
        {valor ?? "—"}
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
}: {
  c: CampanhaDeDemanda;
  dias: DiaDaCampanha[];
  hoje: string;
}) {
  const t = useT();
  const r = resumoDaCampanha(c, dias, hoje);
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
        <Cartao titulo={t("Metas de leads")} tom="blue">
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
          <Numero
            rotulo={t("Meta de leads")}
            valor={r.metas.metaDeLeads === null ? null : inteiro(r.metas.metaDeLeads)}
            fundo="blue"
          />
          <Numero
            rotulo={t("Leads captados")}
            valor={inteiro(r.metas.captados)}
            destaque
            fundo="blue"
          />
          <Numero
            rotulo={t("Faltam")}
            valor={r.metas.faltam === null ? null : inteiro(r.metas.faltam)}
            fundo="blue"
          />
          <Numero rotulo={t("Meta de CPL")} valor={dinheiro(r.metas.metaDeCpl)} />
          <Numero
            rotulo={t("CPL atual")}
            valor={dinheiro(r.funil.cpl)}
            tom={
              r.funil.cpl !== null && r.metas.metaDeCpl !== null
                ? r.funil.cpl <= r.metas.metaDeCpl
                  ? "bom"
                  : "ruim"
                : undefined
            }
          />
          <Numero rotulo={t("CPL necessário")} valor={dinheiro(r.metas.cplNecessario)} />
          <Numero
            rotulo={t("Leads por dia (meta)")}
            valor={r.metas.porDia === null ? null : decimal(r.metas.porDia)}
          />
          <Numero
            rotulo={t("Leads por dia (média)")}
            valor={r.metas.mediaPorDia === null ? null : decimal(r.metas.mediaPorDia)}
            tom={
              r.metas.mediaPorDia !== null && r.metas.porDia !== null
                ? r.metas.mediaPorDia >= r.metas.porDia
                  ? "bom"
                  : "ruim"
                : undefined
            }
          />
          <Numero
            rotulo={t("Meta para hoje")}
            valor={r.metas.metaParaHoje === null ? null : inteiro(r.metas.metaParaHoje)}
          />
          <Numero
            rotulo={adiant !== null && adiant < 0 ? t("Atrasado em") : t("Adiantado em")}
            valor={adiant === null ? null : inteiro(Math.abs(adiant))}
            tom={adiant === null ? undefined : adiant >= 0 ? "bom" : "ruim"}
          />
          <Numero
            rotulo={t("Nova meta diária")}
            valor={r.metas.novaMetaDiaria === null ? null : decimal(r.metas.novaMetaDiaria)}
          />
        </Cartao>
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

      <Cartao titulo={t("Pace de gastos")} tom="green">
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
        <Numero rotulo={t("Investimento bruto")} valor={dinheiro(r.investimentoBruto)} />
        <Numero rotulo={t("Investimento líquido")} valor={dinheiro(r.investimentoLiquido)} />
        <Numero rotulo={t("Valor investido")} valor={moedaDoNumero(r.funil.investido)} destaque />
        <Numero
          rotulo={t("Valor restante")}
          valor={dinheiro(r.valorRestante)}
          tom={r.valorRestante !== null && r.valorRestante < 0 ? "ruim" : undefined}
        />
        <Numero
          rotulo={t("Valor diário programado")}
          valor={dinheiro(r.pace.metaDiaria)}
          fundo="green"
        />
        <Numero
          rotulo={t("Valor diário atual (2 últimos dias)")}
          valor={dinheiro(r.pace.atualUltimosDias)}
          fundo="green"
        />
        <Numero
          rotulo={t("Valor diário ideal")}
          valor={dinheiro(r.pace.ideal)}
          destaque
          fundo="green"
        />
        {ajuste !== null ? (
          <p
            className={cn(
              "col-span-full rounded-xl px-3 py-2 text-sm font-medium",
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
      </Cartao>

      {trafego ? (
        <section className="grid grid-cols-1 gap-3 rounded-2xl border border-l-4 border-l-rose-500 bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">{t("Funil completo")}</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="grid content-start gap-2 rounded-xl bg-blue-500/8 p-3">
              <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-300">
                {t("Anúncio")}
              </p>
              <Numero rotulo={t("Impressões")} valor={inteiro(r.funil.impressoes)} />
              <Numero rotulo={t("Alcance")} valor={inteiro(r.funil.alcance)} />
              <Numero rotulo={t("CPM")} valor={dinheiro(r.funil.cpm)} />
            </div>
            <div className="grid content-start gap-2 rounded-xl bg-violet-500/8 p-3">
              <p className="text-xs font-semibold tracking-wide text-violet-600 uppercase dark:text-violet-300">
                {t("Clique")}
              </p>
              <Numero rotulo={t("Cliques no link")} valor={inteiro(r.funil.cliques)} />
              <Numero rotulo={t("CPC")} valor={dinheiro(r.funil.cpc)} />
              <Numero rotulo={t("CTR")} valor={r.funil.ctr === null ? null : pct(r.funil.ctr)} />
            </div>
            <div className="grid content-start gap-2 rounded-xl bg-amber-500/10 p-3">
              <p className="text-xs font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-300">
                {t("Página")}
              </p>
              <Numero rotulo={t("Visitas à LP")} valor={inteiro(r.funil.visitas)} />
              <Numero rotulo={t("Custo por visita")} valor={dinheiro(r.funil.custoPorVisita)} />
              <Numero
                rotulo={t("Connection rate")}
                valor={r.funil.connectionRate === null ? null : pct(r.funil.connectionRate)}
              />
            </div>
            <div className="grid content-start gap-2 rounded-xl bg-emerald-500/8 p-3">
              <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-300">
                {t("Lead")}
              </p>
              <Numero rotulo={t("Leads")} valor={inteiro(r.funil.leads)} />
              <Numero rotulo={t("CPL")} valor={dinheiro(r.funil.cpl)} />
              <Numero
                rotulo={t("Conversão da LP")}
                valor={r.funil.conversaoDaLp === null ? null : pct(r.funil.conversaoDaLp)}
              />
            </div>
          </div>
        </section>
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
