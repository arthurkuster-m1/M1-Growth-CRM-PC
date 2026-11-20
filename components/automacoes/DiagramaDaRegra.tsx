"use client";

import "@xyflow/react/dist/style.css";

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import { useMemo } from "react";

import { useT } from "@/hooks/i18n/useT";
import type { Diagrama, TipoDoNo } from "@/lib/automation/regra-para-diagrama";
import { Funnel, Lightning, Play, Sparkle } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const ESTILO: Record<TipoDoNo, { cor: string; icone: React.ReactNode; rotulo: string }> = {
  gatilho: {
    cor: "bg-primary/15 text-primary",
    icone: <Lightning size={14} weight="fill" aria-hidden />,
    rotulo: "Quando",
  },
  condicao: {
    cor: "bg-warning-bg text-warning-fg",
    icone: <Funnel size={14} aria-hidden />,
    rotulo: "Se",
  },
  acao: {
    cor: "bg-success-bg text-success-fg",
    icone: <Play size={14} weight="fill" aria-hidden />,
    rotulo: "Então",
  },
  ia: {
    cor: "bg-accent-soft text-primary",
    icone: <Sparkle size={14} weight="fill" aria-hidden />,
    rotulo: "Então",
  },
};

type DadosDoCartao = { tipo: TipoDoNo; titulo: string; detalhe?: string };

function CartaoDoPasso({ data }: NodeProps<Node<DadosDoCartao>>) {
  const t = useT();
  const e = ESTILO[data.tipo];
  return (
    <div className="w-[260px] rounded-2xl border border-border bg-card p-3 shadow-xs">
      <Handle type="target" position={Position.Top} className="!bg-border" isConnectable={false} />
      <div className="flex items-start gap-2.5">
        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", e.cor)}>
          {e.icone}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t(e.rotulo)}
          </p>
          <p className="text-sm font-medium [overflow-wrap:anywhere]">{t(data.titulo)}</p>
          {data.detalhe ? (
            <p className="mt-0.5 text-xs [overflow-wrap:anywhere] text-muted-foreground">
              {data.detalhe}
            </p>
          ) : null}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-border"
        isConnectable={false}
      />
      <Handle
        id="direita"
        type="source"
        position={Position.Right}
        className="!bg-border"
        isConnectable={false}
      />
    </div>
  );
}

const TIPOS_DE_NO: NodeTypes = { passo: CartaoDoPasso };

/**
 * O diagrama da regra, SÓ LEITURA: não arrasta, não liga, não apaga. Editar continua no editor da
 * regra até a Fase 5 do plano do motor único.
 */
export function DiagramaDaRegra({ diagrama }: { diagrama: Diagrama }) {
  const t = useT();
  const { nos, arestas } = useMemo(() => {
    const nos: Node<DadosDoCartao>[] = diagrama.nos.map((n) => ({
      id: n.id,
      type: "passo",
      position: { x: n.x, y: n.y },
      data: { tipo: n.tipo, titulo: n.titulo, detalhe: n.detalhe },
      draggable: false,
      connectable: false,
    }));
    const arestas: Edge[] = diagrama.arestas.map((a) => ({
      id: a.id,
      source: a.de,
      target: a.para,
      // Opção da IA sai pela direita; o resto desce pela coluna principal.
      sourceHandle: a.rotulo ? "direita" : undefined,
      label: a.rotulo,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed },
    }));
    return { nos, arestas };
  }, [diagrama]);

  return (
    <div
      className="h-[560px] w-full overflow-hidden rounded-[22px] border border-border bg-card"
      role="img"
      aria-label={t("Diagrama da automação")}
      data-testid="diagrama-da-regra"
    >
      <ReactFlow
        nodes={nos}
        edges={arestas}
        nodeTypes={TIPOS_DE_NO}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.3}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
