"use client";

import {
  Handle,
  MarkerType,
  NodeResizer,
  Position,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import { createContext, useContext, useEffect, useRef, type CSSProperties } from "react";

import type { Bloco, CorDoCanvas, FormaDoCanvas } from "@/lib/marketing/blocos";
import { cn } from "@/lib/utils";

/** O bloco "canvas" (desenho com formas e setas, no motor do React Flow). */
export type BlocoCanvas = Extract<Bloco, { tipo: "canvas" }>;

export interface DadosDoNo extends Record<string, unknown> {
  texto: string;
  forma: FormaDoCanvas;
  cor: CorDoCanvas;
}
export type NoDoCanvas = Node<DadosDoNo, "forma">;

export const LARGURA_PADRAO = 160;
export const ALTURA_PADRAO = 64;

/** O que o editor do canvas oferece aos nós: editar o texto de um nó (e sair da edição). */
export interface ContextoDoCanvas {
  editavel: boolean;
  editandoId: string | null;
  mudarTexto: (id: string, texto: string) => void;
  terminar: (manterTecla?: "tab") => void;
  aoRedimensionar: () => void;
}
export const ContextoDoCanvasReact = createContext<ContextoDoCanvas>({
  editavel: false,
  editandoId: null,
  mudarTexto: () => undefined,
  terminar: () => undefined,
  aoRedimensionar: () => undefined,
});

const COR: Record<CorDoCanvas, { fundo: string; borda: string; traco: string; preenche: string }> =
  {
    neutra: {
      fundo: "bg-card",
      borda: "border-border",
      traco: "stroke-border",
      preenche: "fill-card",
    },
    verde: {
      fundo: "bg-emerald-500/15",
      borda: "border-emerald-500",
      traco: "stroke-emerald-500",
      preenche: "fill-emerald-500/15",
    },
    azul: {
      fundo: "bg-sky-500/15",
      borda: "border-sky-500",
      traco: "stroke-sky-500",
      preenche: "fill-sky-500/15",
    },
    amarela: {
      fundo: "bg-amber-400/25",
      borda: "border-amber-500",
      traco: "stroke-amber-500",
      preenche: "fill-amber-400/25",
    },
    laranja: {
      fundo: "bg-orange-500/15",
      borda: "border-orange-500",
      traco: "stroke-orange-500",
      preenche: "fill-orange-500/15",
    },
    vermelha: {
      fundo: "bg-red-500/15",
      borda: "border-red-500",
      traco: "stroke-red-500",
      preenche: "fill-red-500/15",
    },
    roxa: {
      fundo: "bg-violet-500/15",
      borda: "border-violet-500",
      traco: "stroke-violet-500",
      preenche: "fill-violet-500/15",
    },
  };

/** A bolinha de cada cor no seletor (opaca, para enxergar a diferença). */
export const BOLINHA_DA_COR: Record<CorDoCanvas, string> = {
  neutra: "bg-muted-foreground/40",
  verde: "bg-emerald-500",
  azul: "bg-sky-500",
  amarela: "bg-amber-400",
  laranja: "bg-orange-500",
  vermelha: "bg-red-500",
  roxa: "bg-violet-500",
};

const LADOS = [
  [Position.Top, "t"],
  [Position.Right, "r"],
  [Position.Bottom, "b"],
  [Position.Left, "l"],
] as const;

/** Um nó: a forma, o texto (editável com dois cliques) e quatro pontos para ligar setas. */
function NoDaForma({ id, data, selected, width, height }: NodeProps<NoDoCanvas>) {
  const ctx = useContext(ContextoDoCanvasReact);
  const editando = ctx.editavel && ctx.editandoId === id;
  const campo = useRef<HTMLTextAreaElement | null>(null);
  const cor = COR[data.cor];
  const tamanho: CSSProperties = {
    width: width ?? undefined,
    height: height ?? undefined,
    minWidth: data.forma === "texto" ? 40 : 80,
    minHeight: data.forma === "texto" ? 28 : 44,
  };

  useEffect(() => {
    if (!editando) return;
    const el = campo.current;
    el?.focus();
    el?.select();
  }, [editando]);

  const conteudo = editando ? (
    <textarea
      ref={campo}
      value={data.texto}
      rows={1}
      maxLength={400}
      onChange={(e) => ctx.mudarTexto(id, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          ctx.terminar("tab");
        } else if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
          e.preventDefault();
          ctx.terminar();
        }
      }}
      onBlur={() => ctx.terminar()}
      className="nodrag nopan block w-full resize-none bg-transparent text-center text-sm leading-snug outline-hidden"
      style={{ fieldSizing: "content" } as CSSProperties}
    />
  ) : (
    <span className="block w-full text-center text-sm leading-snug break-words whitespace-pre-wrap">
      {data.texto || (ctx.editavel ? " " : "")}
    </span>
  );

  const pontos = LADOS.map(([posicao, letra]) => (
    <span key={letra}>
      <Handle
        id={`t-${letra}`}
        type="target"
        position={posicao}
        isConnectable={ctx.editavel}
        className="canvas-ponto"
      />
      <Handle
        id={`s-${letra}`}
        type="source"
        position={posicao}
        isConnectable={ctx.editavel}
        className="canvas-ponto"
      />
    </span>
  ));

  return (
    <div className="group relative flex items-center justify-center" style={tamanho}>
      {ctx.editavel ? (
        <NodeResizer
          isVisible={selected}
          minWidth={60}
          minHeight={36}
          onResizeEnd={ctx.aoRedimensionar}
          lineClassName="!border-primary/60"
          handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-primary !bg-background"
        />
      ) : null}
      {data.forma === "losango" ? (
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          <polygon
            points="50,1 99,50 50,99 1,50"
            strokeWidth={selected ? 3 : 2}
            vectorEffect="non-scaling-stroke"
            className={cn(cor.traco, cor.preenche)}
          />
        </svg>
      ) : null}
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center px-3 py-2",
          data.forma === "retangulo" && cn("rounded-md border-2", cor.fundo, cor.borda),
          data.forma === "arredondado" && cn("rounded-2xl border-2", cor.fundo, cor.borda),
          data.forma === "elipse" && cn("rounded-[50%] border-2 px-5", cor.fundo, cor.borda),
          data.forma === "losango" && "px-8",
          data.forma === "nota" && cn("rounded-sm border shadow-md", cor.fundo, cor.borda),
          data.forma === "texto" && "border border-dashed border-transparent",
          selected && data.forma !== "losango" && "ring-2 ring-primary/50",
          selected && data.forma === "texto" && "border-primary/50",
        )}
      >
        {conteudo}
      </div>
      {pontos}
    </div>
  );
}

export const TIPOS_DE_NO: NodeTypes = { forma: NoDaForma };

export function nosParaFluxo(nos: BlocoCanvas["nos"]): NoDoCanvas[] {
  return nos.map((n) => ({
    id: n.id,
    type: "forma",
    position: { x: n.x, y: n.y },
    data: { texto: n.texto, forma: n.forma, cor: n.cor },
    ...(n.largura ? { width: n.largura } : {}),
    ...(n.altura ? { height: n.altura } : {}),
  }));
}

export function fluxoParaNos(nodes: readonly NoDoCanvas[]): BlocoCanvas["nos"] {
  return nodes.map((n) => ({
    id: n.id,
    x: Math.round(n.position.x),
    y: Math.round(n.position.y),
    forma: n.data.forma,
    cor: n.data.cor,
    texto: n.data.texto,
    ...(n.width ? { largura: Math.max(40, Math.round(n.width)) } : {}),
    ...(n.height ? { altura: Math.max(30, Math.round(n.height)) } : {}),
  }));
}

export function ligacoesParaArestas(ligacoes: BlocoCanvas["ligacoes"]): Edge[] {
  return ligacoes.map((l) => ({ id: l.id, source: l.de, target: l.para }));
}

export function arestasParaLigacoes(arestas: readonly Edge[]): BlocoCanvas["ligacoes"] {
  return arestas.map((a) => ({ id: a.id, de: a.source, para: a.target }));
}

function centro(n: NoDoCanvas) {
  const w = n.measured?.width ?? n.width ?? LARGURA_PADRAO;
  const h = n.measured?.height ?? n.height ?? ALTURA_PADRAO;
  return { x: n.position.x + w / 2, y: n.position.y + h / 2 };
}

/**
 * Cada seta sai pelo lado do bloco que olha para o outro (direita→esquerda quando um está ao lado
 * do outro, embaixo→em cima quando estão um sobre o outro): a seta nunca atravessa o próprio bloco.
 */
export function arestasComLados(arestas: readonly Edge[], nodes: readonly NoDoCanvas[]): Edge[] {
  const porId = new Map(nodes.map((n) => [n.id, n]));
  return arestas.map((a) => {
    const de = porId.get(a.source);
    const para = porId.get(a.target);
    if (!de || !para) return a;
    const c1 = centro(de);
    const c2 = centro(para);
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const saida = horizontal ? (dx >= 0 ? "r" : "l") : dy >= 0 ? "b" : "t";
    const entrada = horizontal ? (dx >= 0 ? "l" : "r") : dy >= 0 ? "t" : "b";
    return {
      ...a,
      sourceHandle: `s-${saida}`,
      targetHandle: `t-${entrada}`,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { strokeWidth: 2 },
    };
  });
}
