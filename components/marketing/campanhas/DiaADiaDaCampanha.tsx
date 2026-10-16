"use client";

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
import { useEffect, useState } from "react";

import {
  FiltroDePeriodoDaCampanha,
  usePeriodoDaCampanha,
} from "@/components/marketing/campanhas/FiltroDePeriodoDaCampanha";
import { rotuloDaMetrica } from "@/components/marketing/campanhas/rotulos";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import {
  COLUNAS_DE_RESULTADO,
  agregadoDoDia,
  formatarResultado,
  ordemDasColunas,
  somarAgregados,
  type Agregado,
  type FormatoDaColuna,
} from "@/lib/marketing/colunas-de-resultado";
import {
  METRICAS_DO_CANAL,
  hojeIso,
  linhasDoPeriodo,
  type DiaDaCampanha,
} from "@/lib/marketing/campanhas-resumo";
import type { CampanhaDeDemanda, CanalDaCampanha } from "@/lib/marketing/campanhas";
import { periodoPadraoDaCampanha } from "@/lib/marketing/periodo-da-campanha";
import { ArrowDown, ArrowUp, DotsSixVertical } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/** Uma coluna da tabela: o valor de um dia e o do total do período. */
interface Coluna {
  id: string;
  rotulo: string;
  formato: FormatoDaColuna;
  padrao: boolean;
  doDia: (d: DiaDaCampanha) => number | null;
  doTotal: (dias: readonly DiaDaCampanha[]) => number | null;
}

function colunasDisponiveis(
  t: (s: string) => string,
  canal: CanalDaCampanha,
  automatico: { chaves: string[]; investimento: boolean },
): Coluna[] {
  const doCatalogo = COLUNAS_DE_RESULTADO.map((c): Coluna => ({
    id: c.id,
    rotulo: t(c.rotulo),
    formato: c.formato,
    // Fora do tráfego pago, os números de anúncio não existem: de fábrica fica só o que o canal tem.
    padrao: canal === "trafego_pago" ? c.padrao : ["leads", "vendas", "recebido"].includes(c.id) || (c.id === "investido" && automatico.investimento),
    doDia: (d) => c.valor(agregadoDoDia(d)),
    doTotal: (dias) => c.valor(somarAgregados(dias.map(agregadoDoDia))),
  }));
  const extras =
    canal === "trafego_pago"
      ? []
      : METRICAS_DO_CANAL[canal]
          .filter((m) => automatico.chaves.includes(m.chave) && m.chave !== "vendas" && m.chave !== "valor_total")
          .map((m): Coluna => ({
            id: `x:${m.chave}`,
            rotulo: rotuloDaMetrica(t, m.chave),
            formato: m.tipo === "moeda" ? "moeda" : "inteiro",
            padrao: true,
            doDia: (d) => d.extras[m.chave] ?? 0,
            doTotal: (dias) => dias.reduce((s, d) => s + (d.extras[m.chave] ?? 0), 0),
          }));
  // Quem não é anúncio não tem impressões/cliques/visitas: some da lista de escolha.
  const semAnuncio = new Set(["impressoes", "cliques", "visitas", "cpm", "ctr", "cpc", "cpv", "conversao_lp"]);
  return [...doCatalogo.filter((c) => canal === "trafego_pago" || !semAnuncio.has(c.id)), ...extras];
}

function chaveSalva(canal: string) {
  return `m1.diaadia.colunas.v1.${canal}`;
}

function CabecalhoOrdenavel({
  coluna,
  ordenacao,
  aoOrdenar,
}: {
  coluna: Coluna;
  ordenacao: { id: string; dir: "asc" | "desc" } | null;
  aoOrdenar: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: coluna.id,
  });
  const ativa = ordenacao?.id === coluna.id;
  return (
    <th
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "px-2 py-2 text-right font-medium whitespace-nowrap",
        isDragging && "relative z-20 bg-card shadow-md",
      )}
      aria-sort={ativa ? (ordenacao!.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          aria-label={coluna.rotulo}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <DotsSixVertical size={12} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => aoOrdenar(coluna.id)}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          {coluna.rotulo}
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
  const disponiveis = colunasDisponiveis(t, canal, automatico);
  const [soComDados, setSoComDados] = useState(false);
  const hoje = hojeIso();
  const periodo = usePeriodoDaCampanha(periodoPadraoDaCampanha(campanha, hoje));
  const [ordenacao, setOrdenacao] = useState<{ id: string; dir: "asc" | "desc" } | null>(null);
  // Colunas escolhidas e a ordem delas: guardadas neste navegador, por canal.
  const [escolha, setEscolha] = useState<{ visiveis: string[] | null; ordem: string[] }>({
    visiveis: null,
    ordem: [],
  });
  useEffect(() => {
    try {
      const bruto = window.localStorage.getItem(chaveSalva(canal));
      if (bruto) setEscolha(JSON.parse(bruto) as typeof escolha);
    } catch {
      /* sem armazenamento: segue com o padrão */
    }
  }, [canal]);
  function mudarEscolha(nova: typeof escolha) {
    setEscolha(nova);
    try {
      window.localStorage.setItem(chaveSalva(canal), JSON.stringify(nova));
    } catch {
      /* o navegador pode bloquear: vale só nesta sessão */
    }
  }
  const ids = disponiveis.map((c) => c.id);
  const ordemIds = ordemDasColunas(escolha.ordem, ids);
  const visiveisIds = escolha.visiveis ?? disponiveis.filter((c) => c.padrao).map((c) => c.id);
  const colunas = ordemIds
    .filter((id) => visiveisIds.includes(id))
    .map((id) => disponiveis.find((c) => c.id === id)!)
    .filter(Boolean);

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  function aoSoltar(e: DragEndEvent) {
    const de = e.active.id as string;
    const para = e.over?.id as string | undefined;
    if (!para || de === para) return;
    const visiveis = colunas.map((c) => c.id);
    const nova = arrayMove(visiveis, visiveis.indexOf(de), visiveis.indexOf(para));
    // As escondidas ficam no fim, na ordem que tinham.
    mudarEscolha({
      visiveis: escolha.visiveis,
      ordem: [...nova, ...ordemIds.filter((id) => !nova.includes(id))],
    });
  }
  function ordenarPor(id: string) {
    setOrdenacao((o) =>
      o?.id !== id ? { id, dir: "desc" } : o.dir === "desc" ? { id, dir: "asc" } : null,
    );
  }

  const doPeriodo = linhasDoPeriodo(dias, periodo.janela.de, periodo.janela.ate, soComDados);
  const ordenados = (() => {
    if (!ordenacao) return doPeriodo;
    const c = disponiveis.find((x) => x.id === ordenacao.id);
    if (!c) return doPeriodo;
    const f = ordenacao.dir === "asc" ? 1 : -1;
    return [...doPeriodo].sort((x, y) => {
      const vx = c.doDia(x);
      const vy = c.doDia(y);
      if (vx === null && vy === null) return 0;
      if (vx === null) return 1;
      if (vy === null) return -1;
      return (vx - vy) * f;
    });
  })();

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
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="h-9 rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary"
            >
              {t("Colunas")} · {colunas.length}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-2">
            <div className="max-h-72 overflow-y-auto">
              {ordemIds.map((id) => {
                const c = disponiveis.find((x) => x.id === id);
                if (!c) return null;
                const marcada = visiveisIds.includes(id);
                return (
                  <label
                    key={id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={marcada}
                      onChange={() =>
                        mudarEscolha({
                          visiveis: marcada
                            ? visiveisIds.filter((v) => v !== id)
                            : [...visiveisIds, id],
                          ordem: ordemIds,
                        })
                      }
                    />
                    {c.rotulo}
                  </label>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => mudarEscolha({ visiveis: null, ordem: [] })}
              className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary"
            >
              {t("Voltar ao padrão")}
            </button>
          </PopoverContent>
        </Popover>
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
          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
            <table className="w-full min-w-max text-sm">
              <thead className="bg-secondary/60 text-xs text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-10 bg-secondary px-3 py-2 text-left font-medium">
                    {t("Dia")}
                  </th>
                  <SortableContext
                    items={colunas.map((c) => c.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {colunas.map((c) => (
                      <CabecalhoOrdenavel
                        key={c.id}
                        coluna={c}
                        ordenacao={ordenacao}
                        aoOrdenar={ordenarPor}
                      />
                    ))}
                  </SortableContext>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((d) => (
                  <tr
                    key={d.day}
                    className={cn("border-t", d.day === hoje && "bg-primary/5")}
                    aria-current={d.day === hoje ? "date" : undefined}
                  >
                    <td className="sticky left-0 z-10 bg-card px-3 py-1 text-left whitespace-nowrap tabular-nums">
                      {dataBr(d.day)}
                    </td>
                    {colunas.map((c) => (
                      <td key={c.id} className="px-2 py-1.5 text-right tabular-nums">
                        {formatarResultado(c.formato, c.doDia(d))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-secondary/40 font-semibold">
                <tr>
                  <td className="sticky left-0 z-10 bg-secondary px-3 py-2 text-left whitespace-nowrap">
                    {t("Total do período")}
                  </td>
                  {colunas.map((c) => (
                    <td key={c.id} className="px-2 py-2 text-right tabular-nums">
                      {formatarResultado(c.formato, c.doTotal(doPeriodo))}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </DndContext>
        </div>
      )}
    </section>
  );
}
