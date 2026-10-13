"use client";

import { useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import {
  useCriativosDaCampanha,
  useLandingPagesDaCampanha,
  useOrigemDosLeads,
} from "@/hooks/marketing/useCampanhasDeDemanda";
import type { CampanhaDeDemanda } from "@/lib/marketing/campanhas";
import { PERIODOS, janelaDoPeriodo, type Periodo } from "@/lib/marketing/periodos";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import { cn } from "@/lib/utils";

const pct = (parte: number, total: number) =>
  total > 0
    ? `${((parte / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`
    : "—";

function rotuloDoAtalho(t: (s: string) => string, p: Periodo): string {
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

function Lista({
  titulo,
  linhas,
  total,
  vazio,
}: {
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
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
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
  const [periodo, setPeriodo] = useState<Periodo | "padrao" | "personalizado">("padrao");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  // "Hoje" fixado na montagem: a janela dos atalhos não muda a cada render.
  const [hoje] = useState(() => new Date().toISOString().slice(0, 10));
  const janela =
    periodo === "padrao"
      ? null
      : periodo === "personalizado"
        ? de !== "" && ate !== "" && de <= ate
          ? { de, ate }
          : null
        : (({ de: d, ate: a }) => ({ de: d, ate: a }))(janelaDoPeriodo(periodo, hoje));
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
    <section className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{t("De onde vieram os leads")}</h3>
          <select
            value={periodo}
            aria-label={t("Período")}
            onChange={(e) => setPeriodo(e.target.value as Periodo | "padrao" | "personalizado")}
            className="h-8 rounded-lg border bg-background px-2 text-xs"
          >
            <option value="padrao">{t("Período da campanha")}</option>
            {PERIODOS.map((p) => (
              <option key={p} value={p}>
                {rotuloDoAtalho(t, p)}
              </option>
            ))}
            <option value="personalizado">{t("Personalizado")}</option>
          </select>
          {periodo === "personalizado" ? (
            <>
              <input
                type="date"
                value={de}
                max={ate || undefined}
                aria-label={t("Data inicial")}
                onChange={(e) => setDe(e.target.value)}
                className="h-8 rounded-lg border bg-background px-2 text-xs"
              />
              <span className="text-xs text-muted-foreground">{t("até")}</span>
              <input
                type="date"
                value={ate}
                min={de || undefined}
                aria-label={t("Data final")}
                onChange={(e) => setAte(e.target.value)}
                className="h-8 rounded-lg border bg-background px-2 text-xs"
              />
            </>
          ) : null}
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
              linhas={porCriativo}
              total={origem.total}
              vazio={t("Nenhum lead com criativo identificado.")}
            />
            <Lista
              titulo={t("Por landing page")}
              linhas={porLp}
              total={origem.total}
              vazio={t("Nenhum lead com landing page identificada.")}
            />
            <Lista
              titulo={t("Por conjunto de anúncios")}
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
    menorEMelhor?: boolean;
    bom?: boolean;
  }> = [];
  if (campanha.goal_leads !== null) {
    linhas.push({
      rotulo: t("Leads"),
      atual: String(leads),
      meta: String(campanha.goal_leads),
      progresso: campanha.goal_leads > 0 ? leads / campanha.goal_leads : null,
    });
  }
  if (campanha.goal_sales !== null) {
    linhas.push({
      rotulo: t("Vendas"),
      atual: String(vendas),
      meta: String(campanha.goal_sales),
      progresso: campanha.goal_sales > 0 ? vendas / campanha.goal_sales : null,
    });
  }
  if (campanha.goal_revenue !== null) {
    linhas.push({
      rotulo: t("Faturamento recebido"),
      atual: moedaDoNumero(faturamento),
      meta: moedaDoNumero(campanha.goal_revenue),
      progresso: campanha.goal_revenue > 0 ? faturamento / campanha.goal_revenue : null,
    });
  }
  if (campanha.goal_cpl !== null) {
    linhas.push({
      rotulo: t("CPL"),
      atual: cpl === null ? "—" : moedaDoNumero(cpl),
      meta: moedaDoNumero(campanha.goal_cpl),
      progresso: cpl !== null && campanha.goal_cpl > 0 ? campanha.goal_cpl / cpl : null,
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
    <div className="grid grid-cols-1 gap-2 rounded-xl border p-3">
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
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full", ok ? "bg-success-fg" : "bg-primary")}
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
