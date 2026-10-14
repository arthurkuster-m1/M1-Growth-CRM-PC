"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { rotuloDoCanal } from "@/components/marketing/campanhas/rotulos";
import { SeletorDePeriodo, type AtalhoDePeriodo } from "@/components/motor/CalendarioDePeriodo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { useVisualizacao } from "@/hooks/motor/useVisualizacao";
import { apiClient } from "@/lib/api/client";
import { CANAIS_DA_CAMPANHA, type CanalDaCampanha } from "@/lib/marketing/campanhas";
import { PERIODOS, janelaDoPeriodo, type Periodo } from "@/lib/marketing/periodos";
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

interface CampanhaDoFiltro {
  id: string;
  name: string;
  channel: string;
}

type Metrica = "investido" | "leads" | "cpl" | "vendas" | "cac" | "recebido" | "a_receber" | "roas";
const METRICAS: readonly Metrica[] = [
  "investido",
  "leads",
  "cpl",
  "vendas",
  "cac",
  "recebido",
  "a_receber",
  "roas",
];

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
    case "trimestre":
      return t("Este trimestre");
    case "semestre":
      return t("Este semestre");
    case "ano":
      return t("Este ano");
  }
}

/** Um botão de filtro que abre uma lista de caixinhas de marcar. */
function FiltroDeLista({
  rotulo,
  contagem,
  children,
}: {
  rotulo: string;
  contagem: number;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-10 rounded-xl border px-3 text-sm whitespace-nowrap hover:bg-secondary",
            contagem > 0 ? "border-primary bg-primary/10 font-medium" : "bg-background",
          )}
        >
          {rotulo}
          {contagem > 0 ? ` · ${contagem}` : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,320px)] p-2">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function Caixinha({
  marcada,
  aoMudar,
  children,
}: {
  marcada: boolean;
  aoMudar: () => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary">
      <input
        type="checkbox"
        checked={marcada}
        onChange={aoMudar}
        className="h-4 w-4 accent-primary"
      />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </label>
  );
}

/**
 * OS RESULTADOS das campanhas num período: investido, leads, CPL, vendas, CAC, faturamento
 * recebido, a receber e ROAS — os mesmos números das metas automáticas.
 *
 * Leads são PESSOAS ÚNICAS trabalhadas no período: quem está em mais de uma campanha conta uma
 * vez no total. O período pode ser um atalho ou um intervalo de datas; dá para filtrar por
 * campanha e por canal e escolher quais números aparecem.
 */
export function ResultadosDasCampanhas() {
  const t = useT();
  const [periodo, setPeriodo] = useState<Periodo | "personalizado">("mes");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [canais, setCanais] = useState<CanalDaCampanha[]>([]);
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [buscaCampanha, setBuscaCampanha] = useState("");
  const propriedades = useVisualizacao("campanhas-resultados");
  const visiveis = propriedades.preferencias.visiveis ?? {};
  const mostra = (m: Metrica) => visiveis[m] !== false;

  const hojeLocal = new Intl.DateTimeFormat("en-CA").format(new Date());
  const atalhosDePeriodo: AtalhoDePeriodo[] = PERIODOS.map((p) => ({
    id: p,
    rotulo: rotuloDoPeriodo(t, p),
    ...janelaDoPeriodo(p, hojeLocal),
  }));
  const intervaloValido = de !== "" && ate !== "" && de <= ate;
  const pronto = periodo !== "personalizado" || intervaloValido;
  const filtros = new URLSearchParams();
  if (periodo === "personalizado") {
    filtros.set("de", de);
    filtros.set("ate", ate);
  } else {
    filtros.set("periodo", periodo);
  }
  if (canais.length > 0) filtros.set("canais", canais.join(","));
  if (escolhidas.length > 0) filtros.set("campanhas", escolhidas.join(","));

  const consulta = useQuery({
    queryKey: ["demand-campaigns-resultados", filtros.toString()],
    staleTime: 30_000,
    enabled: pronto,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: {
            de: string;
            ate: string;
            linhas: Linha[];
            catalogo: CampanhaDoFiltro[];
            leads_unicos: number;
          };
        }>(`/api/v1/demand-campaigns/resultados?${filtros.toString()}`)
      ).data,
  });
  const linhas = (consulta.data?.linhas ?? []).filter(
    (l) => l.investido > 0 || l.leads > 0 || l.vendas > 0 || l.recebido > 0 || l.a_receber > 0,
  );
  const total = linhas.reduce(
    (s, l) => ({
      investido: s.investido + l.investido,
      vendas: s.vendas + l.vendas,
      recebido: s.recebido + l.recebido,
      a_receber: s.a_receber + l.a_receber,
    }),
    { investido: 0, vendas: 0, recebido: 0, a_receber: 0 },
  );
  // Leads do total: pessoas únicas (não a soma das linhas).
  const leadsUnicos = consulta.data?.leads_unicos ?? 0;
  const cpl = (inv: number, leads: number) => (leads > 0 && inv > 0 ? inv / leads : null);
  const cac = (inv: number, vendas: number) => (vendas > 0 && inv > 0 ? inv / vendas : null);
  const roas = (inv: number, rec: number) => (inv > 0 && rec > 0 ? rec / inv : null);
  const reais = (n: number | null) => (n === null ? "—" : moedaDoNumero(n));
  const x = (n: number | null) =>
    n === null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`;

  const nomeDaMetrica: Record<Metrica, string> = {
    investido: t("Investido"),
    leads: t("Leads"),
    cpl: t("CPL"),
    vendas: t("Vendas"),
    cac: t("CAC"),
    recebido: t("Recebido"),
    a_receber: t("A receber"),
    roas: t("ROAS"),
  };
  const valorTotal: Record<Metrica, string> = {
    investido: moedaDoNumero(total.investido),
    leads: inteiro(leadsUnicos),
    cpl: reais(cpl(total.investido, leadsUnicos)),
    vendas: inteiro(total.vendas),
    cac: reais(cac(total.investido, total.vendas)),
    recebido: moedaDoNumero(total.recebido),
    a_receber: moedaDoNumero(total.a_receber),
    roas: x(roas(total.investido, total.recebido)),
  };
  const metricasVisiveis = METRICAS.filter(mostra);

  const catalogo = consulta.data?.catalogo ?? [];
  const termo = buscaCampanha.trim().toLowerCase();
  const doCatalogo = catalogo.filter(
    (c) =>
      (termo === "" || c.name.toLowerCase().includes(termo)) &&
      (canais.length === 0 || canais.includes(c.channel as CanalDaCampanha)),
  );
  const alternar = <T,>(lista: T[], item: T) =>
    lista.includes(item) ? lista.filter((v) => v !== item) : [...lista, item];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("Resultados das campanhas")}</h2>
          {consulta.data ? (
            <p className="text-xs text-muted-foreground">
              {dataBr(consulta.data.de)} → {dataBr(consulta.data.ate)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {t("Período")}
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as Periodo | "personalizado")}
              className="h-10 rounded-xl border bg-background px-3 text-sm text-foreground"
            >
              {PERIODOS.map((p) => (
                <option key={p} value={p}>
                  {rotuloDoPeriodo(t, p)}
                </option>
              ))}
              <option value="personalizado">{t("Personalizado")}</option>
            </select>
          </label>
          {periodo === "personalizado" ? (
            <SeletorDePeriodo
              de={de}
              ate={ate}
              rotulo={t("Período personalizado")}
              atalhos={atalhosDePeriodo}
              aoMudar={(p) => {
                setDe(p.de);
                setAte(p.ate);
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FiltroDeLista rotulo={t("Campanhas")} contagem={escolhidas.length}>
          <input
            value={buscaCampanha}
            onChange={(e) => setBuscaCampanha(e.target.value)}
            placeholder={t("Buscar campanha")}
            className="mb-2 h-9 w-full rounded-lg border bg-background px-2.5 text-sm outline-hidden focus:border-primary/50"
          />
          <div className="max-h-64 overflow-y-auto">
            {doCatalogo.map((c) => (
              <Caixinha
                key={c.id}
                marcada={escolhidas.includes(c.id)}
                aoMudar={() => setEscolhidas((l) => alternar(l, c.id))}
              >
                {c.name}
              </Caixinha>
            ))}
            {doCatalogo.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                {t("Nenhuma campanha encontrada.")}
              </p>
            ) : null}
          </div>
          {escolhidas.length > 0 ? (
            <button
              type="button"
              onClick={() => setEscolhidas([])}
              className="mt-2 w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary"
            >
              {t("Limpar seleção")}
            </button>
          ) : null}
        </FiltroDeLista>

        <FiltroDeLista rotulo={t("Canal")} contagem={canais.length}>
          {CANAIS_DA_CAMPANHA.map((c) => (
            <Caixinha
              key={c}
              marcada={canais.includes(c)}
              aoMudar={() => setCanais((l) => alternar(l, c))}
            >
              {rotuloDoCanal(t, c)}
            </Caixinha>
          ))}
        </FiltroDeLista>

        <FiltroDeLista rotulo={t("Propriedades")} contagem={0}>
          {METRICAS.map((m) => (
            <Caixinha
              key={m}
              marcada={mostra(m)}
              aoMudar={() =>
                propriedades.atualizar((p) => ({
                  ...p,
                  visiveis: { ...p.visiveis, [m]: !mostra(m) },
                }))
              }
            >
              {nomeDaMetrica[m]}
            </Caixinha>
          ))}
        </FiltroDeLista>

        {escolhidas.length > 0 || canais.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setEscolhidas([]);
              setCanais([]);
            }}
            className="h-10 rounded-xl px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            {t("Limpar filtros")}
          </button>
        ) : null}
      </div>

      {periodo === "personalizado" && !intervaloValido ? (
        <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
          {t("Escolha a data inicial e a final do período.")}
        </p>
      ) : (
        <>
          {metricasVisiveis.length > 0 ? (
            <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3 xl:grid-cols-4">
              {metricasVisiveis.map((m) => (
                <div key={m} className="bg-card px-4 py-3">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {m === "leads" ? t("Leads únicos") : nomeDaMetrica[m]}
                  </p>
                  <p className="mt-1 truncate text-xl font-semibold tabular-nums">
                    {valorTotal[m]}
                  </p>
                </div>
              ))}
            </section>
          ) : null}

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
                    {metricasVisiveis.map((m) => (
                      <th key={m} className="px-3 py-2 text-right font-medium">
                        {nomeDaMetrica[m]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...linhas]
                    .sort((a, b) => b.recebido - a.recebido || b.leads - a.leads)
                    .map((l) => {
                      const c = cpl(l.investido, l.leads);
                      const celulas: Record<Metrica, ReactNode> = {
                        investido: moedaDoNumero(l.investido),
                        leads: inteiro(l.leads),
                        cpl: (
                          <span
                            className={cn(
                              c !== null &&
                                l.goal_cpl !== null &&
                                (c <= l.goal_cpl ? "text-success-fg" : "text-error-fg"),
                            )}
                          >
                            {reais(c)}
                          </span>
                        ),
                        vendas: inteiro(l.vendas),
                        cac: reais(cac(l.investido, l.vendas)),
                        recebido: <span className="font-medium">{moedaDoNumero(l.recebido)}</span>,
                        a_receber: moedaDoNumero(l.a_receber),
                        roas: x(roas(l.investido, l.recebido)),
                      };
                      return (
                        <tr key={l.id} className="border-t">
                          <td className="max-w-72 truncate px-3 py-2 font-medium">{l.name}</td>
                          {metricasVisiveis.map((m) => (
                            <td key={m} className="px-3 py-2 text-right tabular-nums">
                              {celulas[m]}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">
        {t(
          "Leads são pessoas únicas trabalhadas no período (entraram em um funil da campanha ou foram atendidas nele); quem está em mais de uma campanha conta uma vez no total. Vendas vêm do CRM; investido, do Meta. O faturamento conta só o que de fato caiu no período (parcelas recebidas); “a receber” é o que está comprometido com vencimento no período.",
        )}
      </p>
    </div>
  );
}
