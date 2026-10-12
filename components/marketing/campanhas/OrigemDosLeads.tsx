"use client";

import { useT } from "@/hooks/i18n/useT";
import {
  useCriativosDaCampanha,
  useLandingPagesDaCampanha,
  useOrigemDosLeads,
} from "@/hooks/marketing/useCampanhasDeDemanda";
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
}: {
  titulo: string;
  linhas: Array<{ id: string; nome: string; leads: number; custo?: number | null }>;
  total: number;
  vazio: string;
}) {
  const t = useT();
  return (
    <div className="grid content-start gap-2">
      <h4 className="text-xs font-semibold tracking-wider text-text-subtle uppercase">{titulo}</h4>
      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="grid gap-1.5">
          {linhas.map((l) => (
            <li key={l.id} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{l.nome}</span>
                <span className="shrink-0 tabular-nums">
                  <strong>{l.leads}</strong>{" "}
                  <span className="text-xs text-muted-foreground">
                    ({pct(l.leads, total)})
                    {l.custo != null ? ` · ${t("CPL")} ${moedaDoNumero(l.custo)}` : ""}
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
export function OrigemDosLeads({ campanhaId }: { campanhaId: string }) {
  const t = useT();
  const { origem, carregando } = useOrigemDosLeads(campanhaId);
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
      };
    })
    .filter((l) => l.leads > 0)
    .sort((a, b) => b.leads - a.leads);
  const porLp = lps
    .map((l) => ({ id: l.id, nome: l.name, leads: origem.porLandingPage[l.id] ?? 0 }))
    .filter((l) => l.leads > 0)
    .sort((a, b) => b.leads - a.leads);
  const porConjunto = origem.porConjunto.map((c) => ({
    id: c.id,
    nome: c.nome ?? `${t("Conjunto")} ${c.id}`,
    leads: c.leads,
  }));
  const semOrigem = origem.semCriativo;

  return (
    <section className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("De onde vieram os leads")}</h3>
        <p className="text-xs text-muted-foreground">
          {origem.total} {t("leads no CRM")}
          {origem.de
            ? ` · ${origem.de.split("-").reverse().join("/")} → ${(origem.ate ?? "").split("-").reverse().join("/")}`
            : ""}
        </p>
      </div>
      {origem.total === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("Ainda não há leads com origem nesta campanha.")}
        </p>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-3">
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
