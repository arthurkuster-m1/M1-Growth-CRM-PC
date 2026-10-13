"use client";

import {
  FiltroDePeriodoDaCampanha,
  usePeriodoDaCampanha,
} from "@/components/marketing/campanhas/FiltroDePeriodoDaCampanha";
import { useT } from "@/hooks/i18n/useT";
import {
  useCriativosDaCampanha,
  useLandingPagesDaCampanha,
  useOrigemDosLeads,
} from "@/hooks/marketing/useCampanhasDeDemanda";
import type { CampanhaDeDemanda } from "@/lib/marketing/campanhas";
import { periodoPadraoDaCampanha } from "@/lib/marketing/periodo-da-campanha";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import { cn } from "@/lib/utils";

const pct = (parte: number, total: number) =>
  total > 0
    ? `${((parte / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`
    : "—";

function Lista({
  titulo,
  linhas,
  total,
  vazio,
  cor = "bg-primary",
}: {
  cor?: string;
  titulo: string;
  linhas: Array<{
    id: string;
    nome: string;
    leads: number;
    custo?: number | null;
    faturamento?: number | null;
  }>;
  total: number;
  vazio: string;
}) {
  const t = useT();
  return (
    <div className="grid grid-cols-1 content-start gap-2">
      <h4 className="text-xs font-semibold tracking-wider text-text-subtle uppercase">{titulo}</h4>
      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5">
          {linhas.map((l) => (
            <li key={l.id} className="grid grid-cols-1 gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{l.nome}</span>
                <span className="shrink-0 tabular-nums">
                  <strong>{l.leads}</strong>{" "}
                  <span className="text-xs text-muted-foreground">
                    ({pct(l.leads, total)})
                    {l.custo != null ? ` · ${t("CPL")} ${moedaDoNumero(l.custo)}` : ""}
                    {l.faturamento ? ` · ${moedaDoNumero(l.faturamento / 100)}` : ""}
                  </span>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full", cor)}
                  style={{ width: `${total > 0 ? Math.max(3, (l.leads / total) * 100) : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * DE ONDE VIERAM OS LEADS: por criativo (com o CPL real), por landing page e por conjunto de
 * anúncios, mais a fatia sem origem identificada. Os leads são os do CRM.
 */
export function OrigemDosLeads({
  campanhaId,
  campanha,
}: {
  campanhaId: string;
  campanha?: CampanhaDeDemanda;
}) {
  const t = useT();
  const hoje = new Intl.DateTimeFormat("en-CA").format(new Date());
  const periodo = usePeriodoDaCampanha(
    periodoPadraoDaCampanha(
      campanha ?? { start_date: null, end_date: null, continuous: true },
      hoje,
    ),
  );
  const janela = periodo.janela;
  const { origem, carregando } = useOrigemDosLeads(campanhaId, janela);
  const { criativos } = useCriativosDaCampanha(campanhaId);
  const { lps } = useLandingPagesDaCampanha(campanhaId);

  if (carregando || !origem) {
    return <div className="h-32 animate-pulse rounded-2xl bg-secondary" aria-busy="true" />;
  }
  const porCriativo = criativos
    .map((c) => {
      const leads = origem.porCriativo[c.id] ?? 0;
      return {
        id: c.id,
        nome: c.name,
        leads,
        custo: leads > 0 && c.spend > 0 ? c.spend / leads : null,
        faturamento: origem.faturamento?.porCriativo[c.id] ?? null,
      };
    })
    .filter((l) => l.leads > 0)
    .sort((a, b) => b.leads - a.leads);
  const porLp = lps
    .map((l) => ({
      id: l.id,
      nome: l.name,
      leads: origem.porLandingPage[l.id] ?? 0,
      faturamento: origem.faturamento?.porLandingPage[l.id] ?? null,
    }))
    .filter((l) => l.leads > 0)
    .sort((a, b) => b.leads - a.leads);
  const porConjunto = origem.porConjunto.map((c) => ({
    id: c.id,
    nome: c.nome ?? `${t("Conjunto")} ${c.id}`,
    leads: c.leads,
  }));
  const semOrigem = origem.semCriativo;

  return (
    <section className="grid grid-cols-1 gap-3 rounded-2xl border border-l-4 border-l-blue-500 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold">{t("De onde vieram os leads")}</h3>
          <FiltroDePeriodoDaCampanha periodo={periodo} />
        </div>
        <p className="text-xs text-muted-foreground">
          {origem.total} {t("leads no CRM")}
          {origem.de
            ? ` · ${origem.de.split("-").reverse().join("/")} → ${(origem.ate ?? "").split("-").reverse().join("/")}`
            : ""}
        </p>
      </div>
      {campanha ? <MetasDoPeriodo campanha={campanha} origem={origem} /> : null}
      {origem.faturamento && (origem.faturamento.vendas > 0 || origem.faturamento.recebido > 0) ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-secondary/40 p-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">{t("Faturamento recebido")}</p>
            <p className="text-base font-semibold tabular-nums">
              {moedaDoNumero(origem.faturamento.recebido / 100)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("A receber (comprometido)")}</p>
            <p className="text-base font-semibold tabular-nums">
              {moedaDoNumero(origem.faturamento.aReceber / 100)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("Vendas fechadas")}</p>
            <p className="text-base font-semibold tabular-nums">{origem.faturamento.vendas}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("Conversão lead → venda")}</p>
            <p className="text-base font-semibold tabular-nums">
              {pct(origem.faturamento.vendas, origem.total)}
            </p>
          </div>
        </div>
      ) : null}
      {origem.total === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("Ainda não há leads com origem nesta campanha.")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Lista
              titulo={t("Por criativo")}
              cor="bg-violet-500"
              linhas={porCriativo}
              total={origem.total}
              vazio={t("Nenhum lead com criativo identificado.")}
            />
            <Lista
              titulo={t("Por landing page")}
              cor="bg-amber-500"
              linhas={porLp}
              total={origem.total}
              vazio={t("Nenhum lead com landing page identificada.")}
            />
            <Lista
              titulo={t("Por conjunto de anúncios")}
              cor="bg-emerald-500"
              linhas={porConjunto}
              total={origem.total}
              vazio={t("Nenhum lead com conjunto identificado.")}
            />
          </div>
          <p
            className={cn(
              "rounded-xl px-3 py-2 text-sm",
              semOrigem / origem.total > 0.4
                ? "bg-warning-bg text-warning-fg"
                : "bg-secondary text-foreground",
            )}
          >
            {semOrigem} {t("leads")} ({pct(semOrigem, origem.total)}){" "}
            {t(
              "chegaram sem o criativo identificado (sem UTM ou sem anúncio). Eles contam na campanha, mas não entram na comparação por criativo.",
            )}
          </p>
        </>
      )}
    </section>
  );
}

/** As metas da campanha lidas dos números reais (CRM, vendas e Meta) no período delas. */
function MetasDoPeriodo({
  campanha,
  origem,
}: {
  campanha: CampanhaDeDemanda;
  origem: NonNullable<ReturnType<typeof useOrigemDosLeads>["origem"]>;
}) {
  const t = useT();
  const leads = origem.total;
  const vendas = origem.faturamento?.vendas ?? 0;
  const faturamento = (origem.faturamento?.recebido ?? 0) / 100;
  const investido = origem.investido ?? 0;
  const cpl = leads > 0 && investido > 0 ? investido / leads : null;
  const linhas: Array<{
    rotulo: string;
    atual: string;
    meta: string;
    progresso: number | null;
    cor: string;
    menorEMelhor?: boolean;
    bom?: boolean;
  }> = [];
  if (campanha.goal_leads !== null) {
    linhas.push({
      rotulo: t("Leads"),
      atual: String(leads),
      meta: String(campanha.goal_leads),
      progresso: campanha.goal_leads > 0 ? leads / campanha.goal_leads : null,
      cor: "bg-blue-500",
    });
  }
  if (campanha.goal_sales !== null) {
    linhas.push({
      rotulo: t("Vendas"),
      atual: String(vendas),
      meta: String(campanha.goal_sales),
      progresso: campanha.goal_sales > 0 ? vendas / campanha.goal_sales : null,
      cor: "bg-violet-500",
    });
  }
  if (campanha.goal_revenue !== null) {
    linhas.push({
      rotulo: t("Faturamento recebido"),
      atual: moedaDoNumero(faturamento),
      meta: moedaDoNumero(campanha.goal_revenue),
      progresso: campanha.goal_revenue > 0 ? faturamento / campanha.goal_revenue : null,
      cor: "bg-teal-500",
    });
  }
  if (campanha.goal_cpl !== null) {
    linhas.push({
      rotulo: t("CPL"),
      atual: cpl === null ? "—" : moedaDoNumero(cpl),
      meta: moedaDoNumero(campanha.goal_cpl),
      progresso: cpl !== null && campanha.goal_cpl > 0 ? campanha.goal_cpl / cpl : null,
      cor: "bg-amber-500",
      menorEMelhor: true,
      bom: cpl !== null && cpl <= campanha.goal_cpl,
    });
  }
  if (linhas.length === 0) return null;
  const periodo =
    origem.de && origem.ate
      ? `${origem.de.split("-").reverse().join("/")} → ${origem.ate.split("-").reverse().join("/")}`
      : "";
  return (
    <div className="grid grid-cols-1 gap-2 rounded-xl border border-l-4 border-l-violet-500 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold tracking-wider text-text-subtle uppercase">
          {origem.mensal ? t("Metas deste mês") : t("Metas da campanha")}
        </h4>
        <span className="text-xs text-muted-foreground">{periodo}</span>
      </div>
      <ul className="grid grid-cols-1 gap-2.5">
        {linhas.map((l) => {
          const p = l.progresso === null ? 0 : Math.min(1, l.progresso);
          const ok = l.menorEMelhor ? l.bom : (l.progresso ?? 0) >= 1;
          return (
            <li key={l.rotulo} className="grid grid-cols-1 gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span>{l.rotulo}</span>
                <span className="tabular-nums">
                  <strong>{l.atual}</strong>{" "}
                  <span className="text-xs text-muted-foreground">
                    / {l.menorEMelhor ? t("teto") : t("meta")} {l.meta}
                  </span>
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full", ok ? "bg-emerald-500" : l.cor)}
                  style={{ width: `${Math.round(p * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
