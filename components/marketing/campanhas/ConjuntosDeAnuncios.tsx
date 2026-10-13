"use client";

import { useT } from "@/hooks/i18n/useT";
import type { MetaPorAnuncio, OrigemDosLeads } from "@/hooks/marketing/useCampanhasDeDemanda";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";

const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pct = (n: number | null) =>
  n === null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/**
 * Os CONJUNTOS DE ANÚNCIOS da campanha no período: gasto e entrega vêm da base diária do Meta;
 * leads, vendas e faturamento, do CRM (pela origem de cada lead). Serve para comparar públicos.
 */
export function ConjuntosDeAnuncios({
  meta,
  origem,
}: {
  meta: MetaPorAnuncio | null;
  origem: OrigemDosLeads | null;
}) {
  const t = useT();
  if (!meta?.base || meta.conjuntos.length === 0) return null;
  const leadsDe = (id: string) => origem?.porConjunto.find((c) => c.id === id)?.leads ?? 0;

  return (
    <section className="grid grid-cols-1 gap-2 rounded-2xl border border-l-4 border-l-emerald-500 bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">{t("Conjuntos de anúncios")}</h3>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t("Conjunto")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("Anúncios")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("Investido")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("Impressões")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("Cliques no link")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("Visitas à LP")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("Connection rate")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("Leads (CRM)")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("CPL real")}</th>
            </tr>
          </thead>
          <tbody>
            {meta.conjuntos.map((c) => {
              const leads = leadsDe(c.adset_id);
              return (
                <tr key={c.adset_id || c.nome} className="border-t">
                  <td className="max-w-72 truncate px-3 py-2 font-medium" title={c.nome}>
                    {c.nome || t("Sem conjunto")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{inteiro(c.anuncios)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{moedaDoNumero(c.spend)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inteiro(c.impressions)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inteiro(c.link_clicks)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inteiro(c.lp_views)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {pct(c.link_clicks > 0 ? (c.lp_views / c.link_clicks) * 100 : null)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{inteiro(leads)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {leads > 0 && c.spend > 0 ? moedaDoNumero(c.spend / leads) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
