"use client";

import { NumeroQueCabe } from "@/components/ui/NumeroQueCabe";
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
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  COLUNAS_DE_RESULTADO,
  formatarResultado,
  somarAgregados,
  type Agregado,
} from "@/lib/marketing/colunas-de-resultado";
import { ArrowDown, ArrowUp, DotsSixVertical } from "@/lib/ui/icons";
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
  impressoes: number;
  cliques: number;
  visitas: number;
  faturamento: number;
  agendamentos: number;
  reunioes: number;
}

interface CampanhaDoFiltro {
  id: string;
  name: string;
  channel: string;
}

type Metrica = string;
/** As propriedades na ordem de fábrica (a pessoa reordena e a ordem fica salva na visualização). */
const IDS_DO_CATALOGO = COLUNAS_DE_RESULTADO.map((c) => c.id);
const METRICAS: readonly Metrica[] = ["canal", ...IDS_DO_CATALOGO, "ltv_cac"];
/** O que aparece de fábrica; o resto a pessoa liga em "Propriedades". */
const VISIVEIS_DE_FABRICA: ReadonlySet<Metrica> = new Set([
  "canal",
  "investido",
  "leads",
  "cpl",
  "vendas",
  "cac",
  "recebido",
  "a_receber",
  "lucro",
  "roas",
  "ltv_cac",
]);
/** Os que também viram cartão de total no topo (o canal só existe na tabela). */
const COM_TOTAL: ReadonlySet<Metrica> = new Set(METRICAS.filter((m) => m !== "canal"));

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

/** O cabeçalho de uma coluna: clicar ordena, arrastar pela alça troca de lugar. */
function CabecalhoDeMetrica({
  id,
  rotulo,
  alinhaEsquerda,
  ordenacao,
  aoOrdenar,
}: {
  id: string;
  rotulo: string;
  alinhaEsquerda: boolean;
  ordenacao: { id: string; dir: "asc" | "desc" } | null;
  aoOrdenar: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const ativa = ordenacao?.id === id;
  return (
    <th
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "px-3 py-2 font-medium whitespace-nowrap",
        alinhaEsquerda ? "text-left" : "text-right",
        isDragging && "relative z-20 bg-card shadow-md",
      )}
      aria-sort={ativa ? (ordenacao!.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          aria-label={rotulo}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <DotsSixVertical size={12} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => aoOrdenar(id)}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          {rotulo}
          {ativa ? (
            ordenacao!.dir === "asc" ? (
              <ArrowUp size={12} aria-hidden />
            ) : (
              <ArrowDown size={12} aria-hidden />
            )
          ) : null}
        </button>
      </span>
    </th>
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
  const mostra = (m: Metrica) => visiveis[m] ?? VISIVEIS_DE_FABRICA.has(m);
  const [ordenacao, setOrdenacao] = useState<{ id: string; dir: "asc" | "desc" } | null>(null);
  // A ordem das propriedades (setas no menu "Propriedades"): o que não foi ordenado vai ao fim.
  const ordemSalva = (propriedades.preferencias.ordem ?? []).filter((id): id is Metrica =>
    (METRICAS as readonly string[]).includes(id),
  );
  const metricasNaOrdem: Metrica[] = [
    ...ordemSalva,
    ...METRICAS.filter((m) => !ordemSalva.includes(m)),
  ];
  function moverPropriedade(m: Metrica, direcao: -1 | 1) {
    const lista = [...metricasNaOrdem];
    const i = lista.indexOf(m);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j]!, lista[i]!];
    propriedades.atualizar((p) => ({ ...p, ordem: lista }));
  }

  const hojeLocal = new Intl.DateTimeFormat("en-CA").format(new Date());
  const atalhosDePeriodo: AtalhoDePeriodo[] = PERIODOS.map((p) => ({
    id: p,
    rotulo: rotuloDoPeriodo(t, p),
    ...janelaDoPeriodo(p, hojeLocal),
  }));
  const janelaAtual =
    periodo === "personalizado" && de !== "" && ate !== ""
      ? { de, ate }
      : janelaDoPeriodo(periodo === "personalizado" ? "mes" : periodo, hojeLocal);
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
  // Leads do total: pessoas únicas (não a soma das linhas).
  const leadsUnicos = consulta.data?.leads_unicos ?? 0;
  const cpl = (inv: number, leads: number) => (leads > 0 && inv > 0 ? inv / leads : null);
  const cac = (inv: number, vendas: number) => (vendas > 0 && inv > 0 ? inv / vendas : null);
  const roas = (inv: number, rec: number) => (inv > 0 && rec > 0 ? rec / inv : null);
  const reais = (n: number | null) => (n === null ? "—" : moedaDoNumero(n));
  const x = (n: number | null) =>
    n === null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`;

  const nomeDaMetrica: Record<Metrica, string> = {
    canal: t("Canal"),
    ltv_cac: t("LTV/CAC"),
    ...Object.fromEntries(COLUNAS_DE_RESULTADO.map((c) => [c.id, t(c.rotulo)])),
  };
  const agregadoDaLinha = (l: Linha): Agregado => ({
    impressoes: l.impressoes,
    cliques: l.cliques,
    visitas: l.visitas,
    leads: l.leads,
    investido: l.investido,
    agendamentos: l.agendamentos,
    reunioes: l.reunioes,
    vendas: l.vendas,
    faturamento: l.faturamento,
    recebido: l.recebido,
    aReceber: l.a_receber,
  });
  // LTV/CAC da campanha: o que cada cliente gera (recebido + a receber) ÷ o que custou trazê-lo.
  const ltvCac = (rec: number, aRec: number, inv: number) =>
    inv > 0 && rec + aRec > 0 ? (rec + aRec) / inv : null;
  const formatoDe = (m: Metrica) => COLUNAS_DE_RESULTADO.find((c) => c.id === m)?.formato ?? "x";
  /** O número cru de uma métrica numa linha (para ordenar) ou no total. */
  const numeroDe = (m: Metrica, ag: Agregado): number | null => {
    if (m === "canal") return null;
    if (m === "ltv_cac") return ltvCac(ag.recebido, ag.aReceber, ag.investido);
    return COLUNAS_DE_RESULTADO.find((c) => c.id === m)?.valor(ag) ?? null;
  };
  const agregadoTotal: Agregado = {
    ...somarAgregados(linhas.map(agregadoDaLinha)),
    // Leads do total: pessoas únicas (não a soma das linhas).
    leads: leadsUnicos,
  };
  const valorTotal: Record<Metrica, string> = Object.fromEntries(
    METRICAS.map((m) => [
      m,
      m === "canal" ? "" : formatarResultado(formatoDe(m), numeroDe(m, agregadoTotal)),
    ]),
  );
  const metricasVisiveis = metricasNaOrdem.filter(mostra);
  const metricasDeTotal = metricasVisiveis.filter((m) => COM_TOTAL.has(m));

  const catalogo = consulta.data?.catalogo ?? [];
  const termo = buscaCampanha.trim().toLowerCase();
  const doCatalogo = catalogo.filter(
    (c) =>
      (termo === "" || c.name.toLowerCase().includes(termo)) &&
      (canais.length === 0 || canais.includes(c.channel as CanalDaCampanha)),
  );
  const alternar = <T,>(lista: T[], item: T) =>
    lista.includes(item) ? lista.filter((v) => v !== item) : [...lista, item];

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  function aoSoltarColuna(e: DragEndEvent) {
    const de = e.active.id as Metrica;
    const para = e.over?.id as Metrica | undefined;
    if (!para || de === para) return;
    const visiveisIds = metricasVisiveis;
    const nova = arrayMove(visiveisIds, visiveisIds.indexOf(de), visiveisIds.indexOf(para));
    // As escondidas ficam no fim, na ordem que tinham.
    const resto = metricasNaOrdem.filter((m) => !nova.includes(m));
    propriedades.atualizar((p) => ({ ...p, ordem: [...nova, ...resto] }));
  }
  function ordenarPor(id: string) {
    setOrdenacao((o) =>
      o?.id !== id ? { id, dir: "desc" } : o.dir === "desc" ? { id, dir: "asc" } : null,
    );
  }
  const linhasOrdenadas = [...linhas].sort((a, b) => {
    if (ordenacao) {
      const f = ordenacao.dir === "asc" ? 1 : -1;
      if (ordenacao.id === "canal") return a.channel.localeCompare(b.channel) * f;
      const va = numeroDe(ordenacao.id, agregadoDaLinha(a));
      const vb = numeroDe(ordenacao.id, agregadoDaLinha(b));
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return (va - vb) * f;
    }
    return b.recebido - a.recebido || b.leads - a.leads;
  });

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
          <SeletorDePeriodo
            de={janelaAtual.de}
            ate={janelaAtual.ate}
            rotulo={t("Período")}
            atalhos={atalhosDePeriodo}
            aoMudar={(p) => {
              const atalho = atalhosDePeriodo.find((a2) => a2.de === p.de && a2.ate === p.ate);
              if (atalho) {
                setPeriodo(atalho.id as Periodo);
              } else {
                setPeriodo("personalizado");
                setDe(p.de);
                setAte(p.ate);
              }
            }}
          />
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
          {metricasNaOrdem.map((m, i) => (
            <div key={m} className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <Caixinha
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
              </div>
              <button
                type="button"
                aria-label={t("Subir propriedade")}
                disabled={i === 0}
                onClick={() => moverPropriedade(m, -1)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-30"
              >
                <ArrowUp size={14} aria-hidden />
              </button>
              <button
                type="button"
                aria-label={t("Descer propriedade")}
                disabled={i === metricasNaOrdem.length - 1}
                onClick={() => moverPropriedade(m, 1)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-30"
              >
                <ArrowDown size={14} aria-hidden />
              </button>
            </div>
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
          {metricasDeTotal.length > 0 ? (
            <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3 xl:grid-cols-4">
              {metricasDeTotal.map((m) => (
                <div key={m} className="bg-card px-4 py-3">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {m === "leads" ? t("Leads únicos") : nomeDaMetrica[m]}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    <NumeroQueCabe>{String(valorTotal[m])}</NumeroQueCabe>
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
              <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltarColuna}>
                <table className="w-full min-w-max text-sm">
                  <thead className="bg-secondary/60 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">{t("Campanha")}</th>
                      <SortableContext items={metricasVisiveis} strategy={horizontalListSortingStrategy}>
                        {metricasVisiveis.map((m) => (
                          <CabecalhoDeMetrica
                            key={m}
                            id={m}
                            rotulo={nomeDaMetrica[m] ?? m}
                            alinhaEsquerda={m === "canal"}
                            ordenacao={ordenacao}
                            aoOrdenar={ordenarPor}
                          />
                        ))}
                      </SortableContext>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasOrdenadas.map((l) => {
                      const ag = agregadoDaLinha(l);
                      const celula = (m: Metrica): ReactNode => {
                        if (m === "canal") {
                          return (
                            <span className="inline-block rounded-full border px-2 py-0.5 text-xs font-medium">
                              {rotuloDoCanal(t, l.channel as CanalDaCampanha)}
                            </span>
                          );
                        }
                        const n = numeroDe(m, ag);
                        const texto = formatarResultado(formatoDe(m), n);
                        if (m === "lucro" && n !== null) {
                          return (
                            <span
                              className={cn(
                                "font-medium",
                                n > 0 && "text-success-fg",
                                n < 0 && "text-error-fg",
                              )}
                            >
                              {texto}
                            </span>
                          );
                        }
                        if (m === "cpl" && n !== null && l.goal_cpl !== null) {
                          return (
                            <span className={n <= l.goal_cpl ? "text-success-fg" : "text-error-fg"}>
                              {texto}
                            </span>
                          );
                        }
                        return texto;
                      };
                      return (
                        <tr key={l.id} className="border-t">
                          <td className="max-w-72 truncate px-3 py-2 font-medium">{l.name}</td>
                          {metricasVisiveis.map((m) => (
                            <td
                              key={m}
                              className={cn(
                                "px-3 py-2 tabular-nums",
                                m === "canal" ? "text-left" : "text-right",
                              )}
                            >
                              {celula(m)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 bg-secondary/40 font-semibold">
                    <tr>
                      <td className="px-3 py-2 text-left">{t("Total do período")}</td>
                      {metricasVisiveis.map((m) => (
                        <td
                          key={m}
                          className={cn(
                            "px-3 py-2 tabular-nums",
                            m === "canal" ? "text-left" : "text-right",
                          )}
                        >
                          {valorTotal[m]}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </DndContext>
            </div>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">
        {t(
          "Leads são pessoas únicas trabalhadas no período (entraram em um funil da campanha ou foram atendidas nele); quem está em mais de uma campanha conta uma vez no total. Vendas vêm do CRM; investido, do Meta. O faturamento conta só o que de fato caiu no período (parcelas recebidas); “a receber” é o que está comprometido com vencimento no período. Lucro = recebido − investido. LTV/CAC = (recebido + a receber) ÷ investido: quanto cada real investido devolve em receita (a receber inclui as parcelas previstas das assinaturas).",
        )}
      </p>
    </div>
  );
}
