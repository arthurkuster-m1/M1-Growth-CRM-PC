"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";

import { brl, inteiro, pct } from "@/components/dashboards/base";
import { CaixaRedonda } from "@/components/ui/CaixaRedonda";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import {
  derivarTrafego,
  somarBrutos,
  type BrutoDeTrafego,
  type DerivadasDeTrafego,
} from "@/lib/dashboards/metricas-de-trafego";
import { ArrowDown, ArrowUp, Rows } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export type FormatoDaMetrica = "inteiro" | "brl" | "pct1" | "pct2" | "vezes" | "decimal2";

const FORMATOS: Record<FormatoDaMetrica, (v: number) => string> = {
  inteiro: (v) => inteiro(v),
  brl: (v) => brl(v),
  pct1: (v) => pct(v, 1),
  pct2: (v) => pct(v, 2),
  vezes: (v) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`,
  decimal2: (v) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
};

/** Uma linha da tabela: o que a identifica (textos) e os números brutos de que tudo se deriva. */
export interface LinhaDeMetricas<B = BrutoDeTrafego> {
  chave: string;
  textos?: Record<string, string>;
  bruto: B;
  /** Sem entrega nem gasto próprios: as contas de mídia aparecem como "—". */
  semMidia?: boolean;
}

export interface ColunaDeTexto {
  tipo: "texto";
  id: string;
  titulo: string;
}
export interface ColunaDeMetrica<D = DerivadasDeTrafego> {
  tipo: "metrica";
  id: string;
  titulo: string;
  formato: FormatoDaMetrica;
  valor: (d: D) => number | null;
}
export type ColunaDaTabela<D = DerivadasDeTrafego> = ColunaDeTexto | ColunaDeMetrica<D>;

/** Como a tabela transforma o bruto em contas e soma o rodapé (o padrão é o do Tráfego Pago). */
export interface RegraDaTabela<B, D> {
  derivar: (b: B, semMidia?: boolean) => D;
  /** O total do rodapé; se faltar, soma os brutos das linhas. */
  total?: (linhas: readonly LinhaDeMetricas<B>[]) => B;
}

const CHAVE = (id: string) => `m1:dashboards:colunas-ocultas:${id}`;

/** As colunas que a pessoa escondeu nesta tabela (neste navegador). Guardar as ocultas faz coluna nova aparecer. */
function useColunasOcultas(id: string) {
  const [ocultas, setOcultas] = useState<string[]>([]);
  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(CHAVE(id));
      if (salvo) setOcultas(JSON.parse(salvo) as string[]);
    } catch {
      // sem armazenamento: mostra tudo
    }
  }, [id]);
  const gravar = (novas: string[]) => {
    setOcultas(novas);
    try {
      window.localStorage.setItem(CHAVE(id), JSON.stringify(novas));
    } catch {
      // só não lembra
    }
  };
  return [ocultas, gravar] as const;
}

/**
 * A TABELA dos dashboards: todas as métricas do funil por linha, com ESCOLHA DE PROPRIEDADES
 * (botão "Propriedades"), rolagem lateral que também se arrasta com o mouse, a primeira coluna
 * fixa, clique no título para ordenar e o total no rodapé (as taxas saem da soma, não da média).
 */
export function TabelaDeMetricas<B = BrutoDeTrafego, D = DerivadasDeTrafego>({
  id,
  colunas,
  linhas,
  rotuloDoRodape,
  regra,
}: {
  /** Identifica a tabela para lembrar as colunas escolhidas. */
  id: string;
  /** A primeira é a que identifica a linha (fica fixa à esquerda). */
  colunas: readonly ColunaDaTabela<D>[];
  linhas: readonly LinhaDeMetricas<B>[];
  rotuloDoRodape?: string;
  regra?: RegraDaTabela<B, D>;
}) {
  const derivar = (regra?.derivar ?? derivarTrafego) as unknown as (b: B, semMidia?: boolean) => D;
  const t = useT();
  const [ocultas, gravarOcultas] = useColunasOcultas(id);
  const [ordem, setOrdem] = useState<{ coluna: string; direcao: "asc" | "desc" } | null>(null);
  const rolagem = useRef<HTMLDivElement | null>(null);
  const arraste = useRef<{ x: number; esquerda: number } | null>(null);
  const [arrastando, setArrastando] = useState(false);

  const [primeira, ...demais] = colunas;
  const visiveis = [primeira!, ...demais.filter((c) => !ocultas.includes(c.id))];

  const calculadas = useMemo(
    () => linhas.map((l) => ({ l, d: derivar(l.bruto, l.semMidia) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linhas],
  );
  const ordenadas = useMemo(() => {
    if (!ordem) return calculadas;
    const col = colunas.find((c) => c.id === ordem.coluna);
    if (!col) return calculadas;
    const chave = (x: (typeof calculadas)[number]): number | string | null =>
      col.tipo === "texto" ? (x.l.textos?.[col.id] ?? "").toLowerCase() : col.valor(x.d);
    const sinal = ordem.direcao === "asc" ? 1 : -1;
    return [...calculadas].sort((a, b) => {
      const va = chave(a);
      const vb = chave(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return va < vb ? -sinal : va > vb ? sinal : 0;
    });
  }, [calculadas, ordem, colunas]);

  const todasSemMidia = linhas.length > 0 && linhas.every((l) => l.semMidia);
  const total = derivar(
    regra?.total
      ? regra.total(linhas)
      : (somarBrutos(linhas.map((l) => l.bruto as unknown as BrutoDeTrafego)) as unknown as B),
    todasSemMidia,
  );

  const alternarOrdem = (coluna: string) =>
    setOrdem((o) =>
      !o || o.coluna !== coluna
        ? { coluna, direcao: "asc" }
        : o.direcao === "asc"
          ? { coluna, direcao: "desc" }
          : null,
    );

  const celula = (c: ColunaDaTabela<D>, x: (typeof calculadas)[number]): ReactNode => {
    if (c.tipo === "texto") return x.l.textos?.[c.id] || "—";
    const v = c.valor(x.d);
    return v === null ? "—" : FORMATOS[c.formato](v);
  };

  // Arrastar o mouse para o lado rola a tabela (no toque, o dedo já rola).
  const aoApertar = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, a, input, label")) return;
    arraste.current = { x: e.clientX, esquerda: rolagem.current?.scrollLeft ?? 0 };
  };
  const aoMover = (e: PointerEvent<HTMLDivElement>) => {
    const a = arraste.current;
    if (!a || !rolagem.current) return;
    const dx = e.clientX - a.x;
    if (!arrastando && Math.abs(dx) < 4) return;
    if (!arrastando) {
      setArrastando(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    rolagem.current.scrollLeft = a.esquerda - dx;
  };
  const aoSoltar = () => {
    arraste.current = null;
    setArrastando(false);
  };

  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {demais.length - ocultas.filter((o) => demais.some((c) => c.id === o)).length}/
          {demais.length} {t("propriedades")} · {t("arraste a tabela para o lado")}
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border bg-card px-3 text-xs font-medium hover:bg-secondary"
            >
              <Rows size={14} aria-hidden />
              {t("Propriedades")}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-2">
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-xs font-semibold tracking-wider text-text-subtle uppercase">
                {t("Mostrar na tabela")}
              </span>
              <span className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => gravarOcultas([])}
                  className="rounded-md px-1.5 py-0.5 text-primary hover:bg-secondary"
                >
                  {t("Todas")}
                </button>
                <button
                  type="button"
                  onClick={() => gravarOcultas(demais.map((c) => c.id))}
                  className="rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-secondary"
                >
                  {t("Nenhuma")}
                </button>
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {demais.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-secondary"
                >
                  <CaixaRedonda
                    checked={!ocultas.includes(c.id)}
                    onChange={(e) =>
                      gravarOcultas(
                        e.target.checked ? ocultas.filter((o) => o !== c.id) : [...ocultas, c.id],
                      )
                    }
                  />
                  {c.titulo}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div
        ref={rolagem}
        onPointerDown={aoApertar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        className={cn(
          "max-w-full overflow-x-auto rounded-xl border",
          arrastando ? "cursor-grabbing select-none" : "cursor-grab",
        )}
      >
        <table className="w-full min-w-max text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              {visiveis.map((c, i) => (
                <th
                  key={c.id}
                  scope="col"
                  aria-sort={
                    ordem?.coluna === c.id
                      ? ordem.direcao === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  className={cn(
                    "px-3 py-2 font-medium whitespace-nowrap",
                    i === 0 && "sticky left-0 z-10 bg-secondary",
                    c.tipo === "texto" ? "text-left" : "text-right",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => alternarOrdem(c.id)}
                    title={t("Clique para ordenar")}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {c.titulo}
                    {ordem?.coluna === c.id ? (
                      ordem.direcao === "asc" ? (
                        <ArrowUp size={11} weight="bold" className="text-primary" aria-hidden />
                      ) : (
                        <ArrowDown size={11} weight="bold" className="text-primary" aria-hidden />
                      )
                    ) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((x) => (
              <tr key={x.l.chave} className="border-t">
                {visiveis.map((c, i) => (
                  <td
                    key={c.id}
                    className={cn(
                      "px-3 py-2 whitespace-nowrap tabular-nums",
                      i === 0 && "sticky left-0 z-[1] max-w-64 truncate bg-card font-medium",
                      c.tipo === "texto" ? "text-left" : "text-right",
                    )}
                  >
                    {celula(c, x)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {linhas.length > 0 ? (
            <tfoot className="border-t bg-secondary/40 font-semibold">
              <tr>
                {visiveis.map((c, i) => (
                  <td
                    key={c.id}
                    className={cn(
                      "px-3 py-2 whitespace-nowrap tabular-nums",
                      i === 0 && "sticky left-0 z-[1] bg-secondary",
                      c.tipo === "texto" ? "text-left" : "text-right",
                    )}
                  >
                    {i === 0
                      ? (rotuloDoRodape ?? t("Total / média"))
                      : c.tipo === "metrica"
                        ? (() => {
                            const v = c.valor(total);
                            return v === null ? "—" : FORMATOS[c.formato](v);
                          })()
                        : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

/** As colunas-padrão do funil, na ordem pedida (com ROAS e Lucro opcionais). */
export function colunasDoFunil(opcoes: {
  incluir?: ReadonlySet<string>;
  roas?: boolean;
  desqualificados?: boolean;
}): ColunaDeMetrica[] {
  const todas: ColunaDeMetrica[] = [
    {
      tipo: "metrica",
      id: "impressoes",
      titulo: "Impressões",
      formato: "inteiro",
      valor: (d) => d.impressoes,
    },
    { tipo: "metrica", id: "cpm", titulo: "CPM", formato: "brl", valor: (d) => d.cpm },
    {
      tipo: "metrica",
      id: "cliques",
      titulo: "Cliques",
      formato: "inteiro",
      valor: (d) => d.cliques,
    },
    { tipo: "metrica", id: "ctr", titulo: "CTR", formato: "pct2", valor: (d) => d.ctr },
    { tipo: "metrica", id: "cpc", titulo: "CPC", formato: "brl", valor: (d) => d.cpc },
    {
      tipo: "metrica",
      id: "viewsLP",
      titulo: "LP Views",
      formato: "inteiro",
      valor: (d) => d.viewsLP,
    },
    {
      tipo: "metrica",
      id: "connect",
      titulo: "Connect Rate",
      formato: "pct1",
      valor: (d) => d.connect,
    },
    {
      tipo: "metrica",
      id: "convLP",
      titulo: "Conversão LP",
      formato: "pct1",
      valor: (d) => d.convLP,
    },
    { tipo: "metrica", id: "leads", titulo: "Leads", formato: "inteiro", valor: (d) => d.leads },
    ...(opcoes.desqualificados
      ? ([
          {
            tipo: "metrica",
            id: "desq",
            titulo: "Desqualif.",
            formato: "inteiro",
            valor: (d) => d.desqualificados ?? 0,
          },
          {
            tipo: "metrica",
            id: "taxaDesq",
            titulo: "Taxa desq.",
            formato: "pct1",
            valor: (d) => d.taxaDesq,
          },
        ] as ColunaDeMetrica[])
      : []),
    { tipo: "metrica", id: "cpl", titulo: "CPL", formato: "brl", valor: (d) => d.cpl },
    {
      tipo: "metrica",
      id: "convVenda",
      titulo: "Taxa de Conversão",
      formato: "pct2",
      valor: (d) => d.convVenda,
    },
    { tipo: "metrica", id: "vendas", titulo: "Vendas", formato: "inteiro", valor: (d) => d.vendas },
    { tipo: "metrica", id: "cac", titulo: "CAC", formato: "brl", valor: (d) => d.cac },
    {
      tipo: "metrica",
      id: "investimento",
      titulo: "Investido",
      formato: "brl",
      valor: (d) => d.investimento,
    },
    {
      tipo: "metrica",
      id: "recebido",
      titulo: "Faturado",
      formato: "brl",
      valor: (d) => d.recebido,
    },
    { tipo: "metrica", id: "lucro", titulo: "Lucro", formato: "brl", valor: (d) => d.lucro },
    ...(opcoes.roas
      ? ([
          { tipo: "metrica", id: "roas", titulo: "ROAS", formato: "vezes", valor: (d) => d.roas },
        ] as ColunaDeMetrica[])
      : []),
  ];
  return opcoes.incluir ? todas.filter((c) => opcoes.incluir!.has(c.id)) : todas;
}
