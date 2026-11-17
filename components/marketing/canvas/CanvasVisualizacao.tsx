"use client";

import { Background, BackgroundVariant, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";

import {
  arestasComLados,
  ContextoDoCanvasReact,
  ligacoesParaArestas,
  nosParaFluxo,
  TIPOS_DE_NO,
  type BlocoCanvas,
} from "@/components/marketing/canvas/comum";
import { useT } from "@/hooks/i18n/useT";

const CONTEXTO_DE_LEITURA = {
  editavel: false,
  editandoId: null,
  mudarTexto: () => undefined,
  terminar: () => undefined,
  aoRedimensionar: () => undefined,
};

/** O canvas como a página o mostra: só leitura, já enquadrado (o desenho todo cabe no bloco). */
export default function CanvasVisualizacao({
  bloco,
  vazioComConvite = false,
}: {
  bloco: BlocoCanvas;
  vazioComConvite?: boolean;
}) {
  const t = useT();
  const nodes = useMemo(() => nosParaFluxo(bloco.nos), [bloco.nos]);
  const arestas = useMemo(
    () => arestasComLados(ligacoesParaArestas(bloco.ligacoes), nodes),
    [bloco.ligacoes, nodes],
  );

  if (bloco.nos.length === 0) {
    return vazioComConvite ? (
      <p
        style={{ height: Math.min(bloco.altura, 200) }}
        className="grid place-items-center rounded-2xl border border-dashed text-sm text-muted-foreground"
      >
        {t("Canvas vazio — dê dois cliques para desenhar")}
      </p>
    ) : null;
  }

  return (
    <div
      style={{ height: bloco.altura }}
      className="overflow-hidden rounded-2xl border bg-card/40"
      role="img"
      aria-label={t("Canvas")}
    >
      <ReactFlowProvider>
        <ContextoDoCanvasReact.Provider value={CONTEXTO_DE_LEITURA}>
          <ReactFlow
            className="canvas-leitura"
            nodes={nodes}
            edges={arestas}
            nodeTypes={TIPOS_DE_NO}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            elementsSelectable={false}
            panOnDrag={false}
            panOnScroll={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            preventScrolling={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
          </ReactFlow>
        </ContextoDoCanvasReact.Provider>
      </ReactFlowProvider>
    </div>
  );
}
