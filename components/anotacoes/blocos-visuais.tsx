"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { useEffect, useRef, type ReactNode } from "react";

import { useT } from "@/hooks/i18n/useT";
import { Plus, Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * Os BLOCOS VISUAIS das Anotações — os mesmos da Estratégia (fluxo, matriz, destaque, cartões,
 * métricas, pirâmide/funil), agora como blocos do editor de estilo Notion.
 *
 * O destaque é texto de verdade (escreve-se direto). Os demais guardam a lista de itens como JSON
 * numa propriedade de texto (`dados`) e se editam com campos dentro do próprio bloco. Os dados
 * são lidos com cuidado (`ler`): JSON ruim ou fora de formato vira o padrão, nunca quebra a tela.
 */

/** O mínimo que cada bloco usa do que o editor entrega (e que o editor satisfaz). */
interface PropsDeRender {
  block: { props: Record<string, string> };
  editor: { isEditable: boolean; updateBlock: (bloco: never, mudanca: never) => unknown };
  /** Só os blocos com texto de verdade (o destaque) recebem. */
  contentRef?: (no: HTMLElement | null) => void;
}

// ── Ferramentas comuns ────────────────────────────────────────────────────────────────────────

interface Item {
  titulo: string;
  texto: string;
}

const MAXIMO_DE_ITENS = 12;
const CURTO = 200;
const LONGO = 1200;

function lerLista<T>(bruto: string, padrao: T[], formato: (x: unknown) => T | null): T[] {
  try {
    const valor: unknown = JSON.parse(bruto);
    if (!Array.isArray(valor)) return padrao;
    const itens = valor.map(formato).filter((x): x is T => x !== null);
    return itens.slice(0, MAXIMO_DE_ITENS);
  } catch {
    return padrao;
  }
}

function texto(x: unknown, teto: number): string {
  return typeof x === "string" ? x.slice(0, teto) : "";
}

const formatoDeItem = (x: unknown): Item | null =>
  typeof x === "object" && x !== null
    ? {
        titulo: texto((x as Record<string, unknown>).titulo, CURTO),
        texto: texto((x as Record<string, unknown>).texto, LONGO),
      }
    : null;

/**
 * Campos dentro de um bloco: o editor de texto não pode "roubar" as teclas de quem escreve num
 * campo (Backspace apagaria o bloco, Enter criaria linha). Os eventos param aqui.
 */
function Isolado({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parar = (e: Event) => e.stopPropagation();
    const eventos = [
      "keydown",
      "keyup",
      "keypress",
      "beforeinput",
      "input",
      "paste",
      "cut",
      "copy",
      "mousedown",
    ];
    for (const ev of eventos) el.addEventListener(ev, parar);
    return () => {
      for (const ev of eventos) el.removeEventListener(ev, parar);
    };
  }, []);
  return (
    <div ref={ref} contentEditable={false} className={className}>
      {children}
    </div>
  );
}

function Campo({
  valor,
  aoMudar,
  placeholder,
  editavel,
  multilinha,
  className,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder: string;
  editavel: boolean;
  multilinha?: boolean;
  className?: string;
}) {
  const classes = cn(
    "w-full min-w-0 resize-none bg-transparent outline-none placeholder:text-muted-foreground/60",
    className,
  );
  if (!editavel)
    return valor ? <p className={cn("whitespace-pre-wrap", className)}>{valor}</p> : null;
  return multilinha ? (
    <textarea
      value={valor}
      rows={2}
      onChange={(e) => aoMudar(e.target.value)}
      placeholder={placeholder}
      className={classes}
    />
  ) : (
    <input
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
      placeholder={placeholder}
      className={classes}
    />
  );
}

function BotaoPequeno({
  aoClicar,
  rotulo,
  children,
}: {
  aoClicar: () => void;
  rotulo: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      onClick={aoClicar}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  );
}

/** Lista editável de itens (título + texto), base do fluxo, dos cartões e das métricas. */
function useItens(
  bloco: { props: Record<string, string> },
  editor: { updateBlock: (b: never, u: never) => unknown },
  padrao: Item[],
) {
  const itens = lerLista(bloco.props.dados ?? "", padrao, formatoDeItem);
  const gravar = (novos: Item[]) =>
    editor.updateBlock(bloco as never, { props: { dados: JSON.stringify(novos) } } as never);
  return {
    itens,
    mudar: (i: number, campo: keyof Item, valor: string) =>
      gravar(itens.map((it, k) => (k === i ? { ...it, [campo]: valor } : it))),
    adicionar: () => gravar([...itens, { titulo: "", texto: "" }].slice(0, MAXIMO_DE_ITENS)),
    remover: (i: number) => gravar(itens.filter((_, k) => k !== i)),
  };
}

const PADRAO_FLUXO: Item[] = [
  { titulo: "Etapa 1", texto: "" },
  { titulo: "Etapa 2", texto: "" },
  { titulo: "Etapa 3", texto: "" },
];
const PADRAO_CARTOES: Item[] = [
  { titulo: "Título", texto: "" },
  { titulo: "Título", texto: "" },
];
const PADRAO_METRICAS: Item[] = [
  { titulo: "0", texto: "Legenda" },
  { titulo: "0", texto: "Legenda" },
];

// ── Destaque (texto de verdade, em três tons) ───────────────────────────────────────────────

const TONS = ["info", "sucesso", "atencao"] as const;
type Tom = (typeof TONS)[number];
const CLASSE_DO_TOM: Record<Tom, string> = {
  info: "border-info/40 bg-info-bg text-info-fg",
  sucesso: "border-success/40 bg-success-bg text-success-fg",
  atencao: "border-warning/40 bg-warning-bg text-warning-fg",
};
const COR_DA_BOLINHA: Record<Tom, string> = {
  info: "bg-info",
  sucesso: "bg-success",
  atencao: "bg-warning",
};

function RenderDoDestaque(props: PropsDeRender) {
  const { contentRef, editor: editorDoBloco } = props;
  const t = useT();
  const tom = (TONS as readonly string[]).includes(props.block.props.tom ?? "")
    ? (props.block.props.tom as Tom)
    : "info";
  return (
    <div
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-4 py-3",
        CLASSE_DO_TOM[tom],
      )}
    >
      <div ref={contentRef} className="min-w-0 flex-1" />
      {editorDoBloco.isEditable ? (
        <Isolado className="flex shrink-0 items-center gap-1 pt-1">
          {TONS.map((o) => (
            <button
              key={o}
              type="button"
              aria-label={
                o === "info" ? t("Informação") : o === "sucesso" ? t("Sucesso") : t("Atenção")
              }
              title={o === "info" ? t("Informação") : o === "sucesso" ? t("Sucesso") : t("Atenção")}
              onClick={() =>
                props.editor.updateBlock(props.block as never, { props: { tom: o } } as never)
              }
              className={cn(
                "h-3.5 w-3.5 rounded-full border border-background",
                COR_DA_BOLINHA[o],
                o === tom && "ring-2 ring-foreground/40",
              )}
            />
          ))}
        </Isolado>
      ) : null}
    </div>
  );
}

const criarDestaque = createReactBlockSpec(
  { type: "destaque", propSchema: { tom: { default: "info" } }, content: "inline" },
  {
    render: RenderDoDestaque,
  },
);

// ── Fluxo (etapas com setas) ───────────────────────────────────────────────────────────────

function RenderDoFluxo(props: PropsDeRender) {
  const t = useT();
  const editavel = props.editor.isEditable;
  const { itens, mudar, adicionar, remover } = useItens(
    props.block,
    props.editor as never,
    PADRAO_FLUXO,
  );
  return (
    <Isolado className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        {itens.map((it, i) => (
          <div
            key={i}
            className="flex min-w-0 flex-1 flex-col items-stretch gap-2 sm:flex-row sm:items-center"
          >
            <div className="group relative flex min-w-0 flex-1 flex-col gap-1 rounded-xl border bg-card p-3 shadow-sm">
              <span className="text-[11px] font-semibold text-primary">{i + 1}</span>
              <Campo
                valor={it.titulo}
                aoMudar={(v) => mudar(i, "titulo", v)}
                placeholder={t("Etapa")}
                editavel={editavel}
                className="text-sm font-semibold"
              />
              <Campo
                valor={it.texto}
                aoMudar={(v) => mudar(i, "texto", v)}
                placeholder={t("Detalhe")}
                editavel={editavel}
                multilinha
                className="text-xs text-muted-foreground"
              />
              {editavel && itens.length > 1 ? (
                <span className="absolute top-1 right-1 opacity-0 group-hover:opacity-100">
                  <BotaoPequeno aoClicar={() => remover(i)} rotulo={t("Remover etapa")}>
                    <Trash size={12} aria-hidden />
                  </BotaoPequeno>
                </span>
              ) : null}
            </div>
            {i < itens.length - 1 ? (
              <span aria-hidden className="self-center text-lg text-muted-foreground sm:rotate-0">
                →
              </span>
            ) : null}
          </div>
        ))}
        {editavel && itens.length < MAXIMO_DE_ITENS ? (
          <div className="grid place-items-center">
            <BotaoPequeno aoClicar={adicionar} rotulo={t("Adicionar etapa")}>
              <Plus size={14} aria-hidden />
            </BotaoPequeno>
          </div>
        ) : null}
      </div>
    </Isolado>
  );
}

const criarFluxo = createReactBlockSpec(
  {
    type: "fluxo",
    propSchema: { dados: { default: JSON.stringify(PADRAO_FLUXO) } },
    content: "none",
  },
  {
    render: RenderDoFluxo,
  },
);

// ── Cartões ────────────────────────────────────────────────────────────────────────────────

function RenderDosCartoes(props: PropsDeRender) {
  const t = useT();
  const editavel = props.editor.isEditable;
  const { itens, mudar, adicionar, remover } = useItens(
    props.block,
    props.editor as never,
    PADRAO_CARTOES,
  );
  return (
    <Isolado className="w-full">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {itens.map((it, i) => (
          <div
            key={i}
            className="group relative flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm"
          >
            <Campo
              valor={it.titulo}
              aoMudar={(v) => mudar(i, "titulo", v)}
              placeholder={t("Título")}
              editavel={editavel}
              className="text-sm font-semibold"
            />
            <Campo
              valor={it.texto}
              aoMudar={(v) => mudar(i, "texto", v)}
              placeholder={t("Texto")}
              editavel={editavel}
              multilinha
              className="text-sm text-muted-foreground"
            />
            {editavel && itens.length > 1 ? (
              <span className="absolute top-1 right-1 opacity-0 group-hover:opacity-100">
                <BotaoPequeno aoClicar={() => remover(i)} rotulo={t("Remover cartão")}>
                  <Trash size={12} aria-hidden />
                </BotaoPequeno>
              </span>
            ) : null}
          </div>
        ))}
        {editavel && itens.length < MAXIMO_DE_ITENS ? (
          <button
            type="button"
            onClick={adicionar}
            className="flex min-h-20 items-center justify-center gap-1 rounded-xl border border-dashed text-xs text-muted-foreground hover:bg-secondary"
          >
            <Plus size={12} aria-hidden /> {t("Adicionar cartão")}
          </button>
        ) : null}
      </div>
    </Isolado>
  );
}

const criarCartoes = createReactBlockSpec(
  {
    type: "cartoes",
    propSchema: { dados: { default: JSON.stringify(PADRAO_CARTOES) } },
    content: "none",
  },
  {
    render: RenderDosCartoes,
  },
);

// ── Métricas (números grandes com legenda) ─────────────────────────────────────────────────

function RenderDasMetricas(props: PropsDeRender) {
  const t = useT();
  const editavel = props.editor.isEditable;
  const { itens, mudar, adicionar, remover } = useItens(
    props.block,
    props.editor as never,
    PADRAO_METRICAS,
  );
  return (
    <Isolado className="w-full">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {itens.map((it, i) => (
          <div
            key={i}
            className="group relative flex flex-col gap-0.5 rounded-xl border bg-card p-4 shadow-sm"
          >
            <Campo
              valor={it.titulo}
              aoMudar={(v) => mudar(i, "titulo", v.slice(0, 40))}
              placeholder="0"
              editavel={editavel}
              className="text-3xl font-bold tracking-tight text-primary"
            />
            <Campo
              valor={it.texto}
              aoMudar={(v) => mudar(i, "texto", v)}
              placeholder={t("Legenda")}
              editavel={editavel}
              className="text-xs text-muted-foreground"
            />
            {editavel && itens.length > 1 ? (
              <span className="absolute top-1 right-1 opacity-0 group-hover:opacity-100">
                <BotaoPequeno aoClicar={() => remover(i)} rotulo={t("Remover métrica")}>
                  <Trash size={12} aria-hidden />
                </BotaoPequeno>
              </span>
            ) : null}
          </div>
        ))}
        {editavel && itens.length < MAXIMO_DE_ITENS ? (
          <button
            type="button"
            onClick={adicionar}
            className="flex min-h-20 items-center justify-center gap-1 rounded-xl border border-dashed text-xs text-muted-foreground hover:bg-secondary"
          >
            <Plus size={12} aria-hidden /> {t("Adicionar métrica")}
          </button>
        ) : null}
      </div>
    </Isolado>
  );
}

const criarMetricas = createReactBlockSpec(
  {
    type: "metricas",
    propSchema: { dados: { default: JSON.stringify(PADRAO_METRICAS) } },
    content: "none",
  },
  {
    render: RenderDasMetricas,
  },
);

// ── Matriz 2x2 / SWOT ──────────────────────────────────────────────────────────────────────

const ESTILOS_DA_MATRIZ = ["swot", "neutro"] as const;
const SWOT: Item[] = [
  { titulo: "Forças", texto: "" },
  { titulo: "Fraquezas", texto: "" },
  { titulo: "Oportunidades", texto: "" },
  { titulo: "Ameaças", texto: "" },
];
const CORES_DO_SWOT = [
  "border-success/40 bg-success-bg",
  "border-error/40 bg-error-bg",
  "border-info/40 bg-info-bg",
  "border-warning/40 bg-warning-bg",
];

function lerMatriz(bruto: string): Item[] {
  const itens = lerLista(bruto, SWOT, formatoDeItem);
  return Array.from({ length: 4 }, (_, i) => itens[i] ?? SWOT[i]!);
}

function RenderDaMatriz(props: PropsDeRender) {
  const t = useT();
  const editavel = props.editor.isEditable;
  const itens = lerMatriz(props.block.props.dados ?? "");
  const swot = props.block.props.estilo !== "neutro";
  const gravar = (novos: Item[]) =>
    props.editor.updateBlock(
      props.block as never,
      {
        props: { dados: JSON.stringify(novos) },
      } as never,
    );
  return (
    <Isolado className="w-full">
      {editavel ? (
        <div className="mb-1 flex justify-end">
          <button
            type="button"
            onClick={() =>
              props.editor.updateBlock(
                props.block as never,
                {
                  props: { estilo: swot ? "neutro" : "swot" },
                } as never,
              )
            }
            className="rounded-md px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {swot ? t("Estilo: SWOT colorido") : t("Estilo: neutro")}
          </button>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {itens.map((it, i) => (
          <div
            key={i}
            className={cn(
              "flex min-h-28 flex-col gap-1 rounded-xl border p-4",
              swot ? CORES_DO_SWOT[i] : "bg-card shadow-sm",
            )}
          >
            <Campo
              valor={it.titulo}
              aoMudar={(v) => gravar(itens.map((x, k) => (k === i ? { ...x, titulo: v } : x)))}
              placeholder={t("Título")}
              editavel={editavel}
              className="text-sm font-semibold"
            />
            <Campo
              valor={it.texto}
              aoMudar={(v) => gravar(itens.map((x, k) => (k === i ? { ...x, texto: v } : x)))}
              placeholder={t("Texto")}
              editavel={editavel}
              multilinha
              className="text-sm"
            />
          </div>
        ))}
      </div>
    </Isolado>
  );
}

const criarMatriz = createReactBlockSpec(
  {
    type: "matriz",
    propSchema: { dados: { default: JSON.stringify(SWOT) }, estilo: { default: "swot" } },
    content: "none",
  },
  {
    render: RenderDaMatriz,
  },
);
void ESTILOS_DA_MATRIZ;

// ── Pirâmide / Funil ───────────────────────────────────────────────────────────────────────

const PADRAO_NIVEIS = ["Topo", "Meio", "Base"];

function lerNiveis(bruto: string): string[] {
  const itens = lerLista(bruto, PADRAO_NIVEIS, (x) =>
    typeof x === "string" ? x.slice(0, CURTO) : null,
  );
  return itens.length ? itens : PADRAO_NIVEIS;
}

function RenderDaPiramide(props: PropsDeRender) {
  const t = useT();
  const editavel = props.editor.isEditable;
  const niveis = lerNiveis(props.block.props.dados ?? "");
  const funil = props.block.props.forma === "funil";
  const gravar = (novos: string[]) =>
    props.editor.updateBlock(
      props.block as never,
      {
        props: { dados: JSON.stringify(novos) },
      } as never,
    );
  // Pirâmide: o topo é estreito e a base larga; funil: o contrário. O primeiro nível fica em cima.
  const largura = (i: number) => {
    const n = niveis.length;
    const passo = n > 1 ? i / (n - 1) : 0;
    const fracao = funil ? 1 - passo * 0.6 : 0.4 + passo * 0.6;
    return `${Math.round(fracao * 100)}%`;
  };
  return (
    <Isolado className="w-full">
      {editavel ? (
        <div className="mb-1 flex justify-end gap-1">
          <button
            type="button"
            onClick={() =>
              props.editor.updateBlock(
                props.block as never,
                {
                  props: { forma: funil ? "piramide" : "funil" },
                } as never,
              )
            }
            className="rounded-md px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {funil ? t("Forma: funil") : t("Forma: pirâmide")}
          </button>
          {niveis.length < MAXIMO_DE_ITENS ? (
            <BotaoPequeno aoClicar={() => gravar([...niveis, ""])} rotulo={t("Adicionar nível")}>
              <Plus size={12} aria-hidden />
            </BotaoPequeno>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col items-center gap-1">
        {niveis.map((nivel, i) => (
          <div
            key={i}
            style={{ width: largura(i), opacity: 1 - i * (0.5 / Math.max(niveis.length, 1)) }}
            className="group relative flex items-center rounded-lg bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
          >
            <Campo
              valor={nivel}
              aoMudar={(v) => gravar(niveis.map((x, k) => (k === i ? v : x)))}
              placeholder={t("Nível")}
              editavel={editavel}
              className="text-center"
            />
            {editavel && niveis.length > 1 ? (
              <span className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 group-hover:opacity-100">
                <BotaoPequeno
                  aoClicar={() => gravar(niveis.filter((_, k) => k !== i))}
                  rotulo={t("Remover nível")}
                >
                  <Trash size={12} aria-hidden />
                </BotaoPequeno>
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </Isolado>
  );
}

const criarPiramide = createReactBlockSpec(
  {
    type: "piramide",
    propSchema: {
      dados: { default: JSON.stringify(PADRAO_NIVEIS) },
      forma: { default: "piramide" },
    },
    content: "none",
  },
  {
    render: RenderDaPiramide,
  },
);

/** Os blocos a juntar no esquema do editor. */
export const blocosVisuais = {
  destaque: criarDestaque(),
  fluxo: criarFluxo(),
  matriz: criarMatriz(),
  cartoes: criarCartoes(),
  metricas: criarMetricas(),
  piramide: criarPiramide(),
};

/** Os itens do menu "/" para criar cada um, já com o texto do produto. */
export const ITENS_DOS_BLOCOS_VISUAIS: Array<{
  tipo: keyof typeof blocosVisuais;
  titulo: string;
  descricao: string;
  aliases: string[];
}> = [
  {
    tipo: "destaque",
    titulo: "Destaque",
    descricao: "Caixa colorida de aviso, sucesso ou informação.",
    aliases: ["destaque", "aviso", "callout", "alerta"],
  },
  {
    tipo: "fluxo",
    titulo: "Fluxo",
    descricao: "Etapas ligadas por setas.",
    aliases: ["fluxo", "etapas", "processo", "passos"],
  },
  {
    tipo: "matriz",
    titulo: "Matriz 2x2 / SWOT",
    descricao: "Quatro quadrantes com título e texto.",
    aliases: ["matriz", "swot", "quadrantes", "2x2"],
  },
  {
    tipo: "cartoes",
    titulo: "Cartões",
    descricao: "Cartões lado a lado com título e texto.",
    aliases: ["cartoes", "cards", "colunas"],
  },
  {
    tipo: "metricas",
    titulo: "Métricas",
    descricao: "Números grandes com legenda.",
    aliases: ["metricas", "numeros", "kpi", "indicadores"],
  },
  {
    tipo: "piramide",
    titulo: "Pirâmide / Funil",
    descricao: "Níveis empilhados, em pirâmide ou funil.",
    aliases: ["piramide", "funil", "niveis"],
  },
];
