"use client";

import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type FinalConnectionState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

import {
  ALTURA_PADRAO,
  arestasComLados,
  arestasParaLigacoes,
  BOLINHA_DA_COR,
  ContextoDoCanvasReact,
  fluxoParaNos,
  LARGURA_PADRAO,
  ligacoesParaArestas,
  nosParaFluxo,
  TIPOS_DE_NO,
  type BlocoCanvas,
  type ContextoDoCanvas,
  type NoDoCanvas,
} from "@/components/marketing/canvas/comum";
import { useT } from "@/hooks/i18n/useT";
import {
  CORES_DO_CANVAS,
  FORMAS_DO_CANVAS,
  MAXIMO_DE_LIGACOES_DO_CANVAS,
  MAXIMO_DE_NOS_DO_CANVAS,
  type CorDoCanvas,
  type FormaDoCanvas,
} from "@/lib/marketing/blocos";
import { cn } from "@/lib/utils";

const GLIFO_DA_FORMA: Record<FormaDoCanvas, string> = {
  retangulo: "▭",
  arredondado: "▢",
  elipse: "◯",
  losango: "◇",
  nota: "🗒",
  texto: "T",
};

interface Foto {
  nodes: NoDoCanvas[];
  edges: Edge[];
}

const novoId = () => `c${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
const semSelecao = <T extends { selected?: boolean }>(xs: T[]): T[] =>
  xs.map((x) => (x.selected ? { ...x, selected: false } : x));

interface Props {
  bloco: BlocoCanvas;
  /** Grava o desenho no bloco (a página guarda e o Ctrl+Z da página também vale). */
  aoMudar: (bloco: BlocoCanvas, chave?: string) => void;
  aoFechar: () => void;
}

/**
 * O CANVAS em tela cheia: formas, texto e setas no motor do React Flow. Pensado para o teclado —
 * Tab cria um bloco novo já ligado ao selecionado, Enter edita o texto, Delete apaga, Ctrl+D
 * duplica, Ctrl+Z desfaz; soltar uma seta no vazio cria o bloco ali. Esc ou "Concluir" volta à
 * página (cada mudança já foi gravada no bloco).
 */
export default function EditorDeCanvas(props: Props) {
  return createPortal(
    <ReactFlowProvider>
      <Interno {...props} />
    </ReactFlowProvider>,
    document.body,
  );
}

function Interno({ bloco, aoMudar, aoFechar }: Props) {
  const t = useT();
  const { screenToFlowPosition, fitView } = useReactFlow<NoDoCanvas, Edge>();
  const [nodes, setNodes, onNodesChange] = useNodesState<NoDoCanvas>(nosParaFluxo(bloco.nos));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(ligacoesParaArestas(bloco.ligacoes));
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [corAtual, setCorAtual] = useState<CorDoCanvas>("neutra");
  const raiz = useRef<HTMLDivElement | null>(null);

  // Sempre o estado mais novo, para as operações encadeadas (criar e já editar) não lerem o antigo.
  const atual = useRef<Foto>({ nodes, edges });
  const blocoRef = useRef(bloco);
  useLayoutEffect(() => {
    atual.current = { nodes, edges };
    blocoRef.current = bloco;
  });
  const passado = useRef<Foto[]>([]);
  const futuro = useRef<Foto[]>([]);

  const gravar = useCallback(
    (f: Foto, chave?: string) => {
      aoMudar(
        {
          ...blocoRef.current,
          nos: fluxoParaNos(f.nodes),
          ligacoes: arestasParaLigacoes(f.edges),
        },
        chave,
      );
    },
    [aoMudar],
  );

  /** Troca o desenho de uma vez: guarda o anterior para o Ctrl+Z e grava no bloco. */
  const aplicar = useCallback(
    (nodesNovos: NoDoCanvas[], edgesNovas: Edge[], opcoes?: { semHistorico?: boolean }) => {
      if (!opcoes?.semHistorico) {
        passado.current.push({ nodes: atual.current.nodes, edges: atual.current.edges });
        if (passado.current.length > 100) passado.current.shift();
        futuro.current = [];
      }
      atual.current = { nodes: nodesNovos, edges: edgesNovas };
      setNodes(nodesNovos);
      setEdges(edgesNovas);
      gravar(atual.current);
    },
    [gravar, setEdges, setNodes],
  );

  const voltar = (direcao: "desfazer" | "refazer") => {
    const de = direcao === "desfazer" ? passado.current : futuro.current;
    const para = direcao === "desfazer" ? futuro.current : passado.current;
    const alvo = de.pop();
    if (!alvo) return;
    para.push({ nodes: atual.current.nodes, edges: atual.current.edges });
    setEditandoId(null);
    aplicar(alvo.nodes, alvo.edges, { semHistorico: true });
  };

  const novoNo = (
    forma: FormaDoCanvas,
    posicao: { x: number; y: number },
    cor: CorDoCanvas = corAtual,
  ): NoDoCanvas => ({
    id: novoId(),
    type: "forma",
    position: posicao,
    data: { texto: "", forma, cor },
    selected: true,
    ...(forma === "nota" ? { width: 180, height: 120 } : {}),
  });

  const centroDaTela = () => {
    const r = raiz.current?.getBoundingClientRect();
    const p = screenToFlowPosition({
      x: (r?.left ?? 0) + (r?.width ?? window.innerWidth) / 2,
      y: (r?.top ?? 0) + (r?.height ?? window.innerHeight) / 2,
    });
    // Blocos novos em sequência não nascem um em cima do outro.
    const n = atual.current.nodes.length % 6;
    return { x: p.x - LARGURA_PADRAO / 2 + n * 24, y: p.y - ALTURA_PADRAO / 2 + n * 24 };
  };

  const adicionar = (forma: FormaDoCanvas, posicao?: { x: number; y: number }) => {
    if (atual.current.nodes.length >= MAXIMO_DE_NOS_DO_CANVAS) return;
    const no = novoNo(forma, posicao ?? centroDaTela());
    aplicar([...semSelecao(atual.current.nodes), no], semSelecao(atual.current.edges));
    setEditandoId(no.id);
  };

  const selecionados = nodes.filter((n) => n.selected);
  const arestasSelecionadas = edges.filter((e) => e.selected);

  const apagarSelecao = () => {
    const ids = new Set(atual.current.nodes.filter((n) => n.selected).map((n) => n.id));
    const restantesNos = atual.current.nodes.filter((n) => !ids.has(n.id));
    const restantesArestas = atual.current.edges.filter(
      (e) => !e.selected && !ids.has(e.source) && !ids.has(e.target),
    );
    if (
      restantesNos.length === atual.current.nodes.length &&
      restantesArestas.length === atual.current.edges.length
    )
      return;
    aplicar(restantesNos, restantesArestas);
  };

  const duplicarSelecao = () => {
    const origem = atual.current.nodes.filter((n) => n.selected);
    if (!origem.length || atual.current.nodes.length + origem.length > MAXIMO_DE_NOS_DO_CANVAS)
      return;
    const mapa = new Map(origem.map((n) => [n.id, novoId()]));
    const copias: NoDoCanvas[] = origem.map((n) => ({
      ...n,
      id: mapa.get(n.id)!,
      position: { x: n.position.x + 32, y: n.position.y + 32 },
      selected: true,
    }));
    const ligadas = atual.current.edges
      .filter((e) => mapa.has(e.source) && mapa.has(e.target))
      .map((e) => ({ id: novoId(), source: mapa.get(e.source)!, target: mapa.get(e.target)! }));
    aplicar(
      [...semSelecao(atual.current.nodes), ...copias],
      [...semSelecao(atual.current.edges), ...ligadas],
    );
  };

  /** Tab: um bloco novo à direita do selecionado, já ligado por uma seta, e já para digitar. */
  const filhoDoSelecionado = () => {
    const origem = atual.current.nodes.find((n) => n.selected);
    if (!origem || atual.current.nodes.length >= MAXIMO_DE_NOS_DO_CANVAS) return;
    if (atual.current.edges.length >= MAXIMO_DE_LIGACOES_DO_CANVAS) return;
    const largura = origem.measured?.width ?? origem.width ?? LARGURA_PADRAO;
    const irmaos = atual.current.edges.filter((e) => e.source === origem.id).length;
    const filho = novoNo(
      origem.data.forma === "texto" || origem.data.forma === "nota"
        ? "arredondado"
        : origem.data.forma,
      { x: origem.position.x + largura + 80, y: origem.position.y + irmaos * (ALTURA_PADRAO + 28) },
      origem.data.cor,
    );
    aplicar(
      [...semSelecao(atual.current.nodes), filho],
      [...semSelecao(atual.current.edges), { id: novoId(), source: origem.id, target: filho.id }],
    );
    setEditandoId(filho.id);
  };

  const aoConectar = (c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    if (atual.current.edges.some((e) => e.source === c.source && e.target === c.target)) return;
    if (atual.current.edges.length >= MAXIMO_DE_LIGACOES_DO_CANVAS) return;
    aplicar(
      atual.current.nodes,
      addEdge({ source: c.source, target: c.target, id: novoId() }, atual.current.edges),
    );
  };

  /** Soltar a seta no vazio cria o bloco ali, já ligado (como num quadro de ideias). */
  const aoSoltarSeta = (evento: MouseEvent | TouchEvent, estado: FinalConnectionState) => {
    if (estado.isValid || !estado.fromNode) return;
    if (atual.current.nodes.length >= MAXIMO_DE_NOS_DO_CANVAS) return;
    if (atual.current.edges.length >= MAXIMO_DE_LIGACOES_DO_CANVAS) return;
    const ponto = "changedTouches" in evento ? evento.changedTouches[0]! : evento;
    const pos = screenToFlowPosition({ x: ponto.clientX, y: ponto.clientY });
    const origem = atual.current.nodes.find((n) => n.id === estado.fromNode!.id);
    const no = novoNo("arredondado", { x: pos.x - 70, y: pos.y - 24 }, origem?.data.cor);
    aplicar(
      [...semSelecao(atual.current.nodes), no],
      [
        ...semSelecao(atual.current.edges),
        { id: novoId(), source: estado.fromNode.id, target: no.id },
      ],
    );
    setEditandoId(no.id);
  };

  const pintar = (cor: CorDoCanvas) => {
    setCorAtual(cor);
    if (!selecionados.length) return;
    aplicar(
      atual.current.nodes.map((n) => (n.selected ? { ...n, data: { ...n.data, cor } } : n)),
      atual.current.edges,
    );
  };
  const mudarForma = (forma: FormaDoCanvas) => {
    if (!selecionados.length) return adicionar(forma);
    aplicar(
      atual.current.nodes.map((n) => (n.selected ? { ...n, data: { ...n.data, forma } } : n)),
      atual.current.edges,
    );
  };

  const contexto = useMemo<ContextoDoCanvas>(
    () => ({
      editavel: true,
      editandoId,
      mudarTexto: (id, texto) => {
        const novos = atual.current.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, texto } } : n,
        );
        atual.current = { nodes: novos, edges: atual.current.edges };
        setNodes(novos);
        gravar(atual.current, `canvas-texto-${id}`);
      },
      terminar: (tecla) => {
        setEditandoId(null);
        raiz.current?.focus({ preventScroll: true });
        if (tecla === "tab") requestAnimationFrame(filhoDoSelecionado);
      },
      aoRedimensionar: () =>
        requestAnimationFrame(() => aplicar(atual.current.nodes, atual.current.edges)),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as operações leem sempre `atual`
    [editandoId, gravar, setNodes],
  );

  // O texto digitado conta como UMA ação do Ctrl+Z: guarda o desenho de antes ao começar a editar.
  const aoComecarAEditar = (id: string) => {
    passado.current.push({ nodes: atual.current.nodes, edges: atual.current.edges });
    futuro.current = [];
    setEditandoId(id);
  };

  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    // Nada do que se digita aqui chega ao editor da página (Delete apagaria o bloco, Ctrl+Z desfaria a página).
    e.stopPropagation();
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (editandoId) return;
    if (k === "escape") {
      e.preventDefault();
      return aoFechar();
    }
    if (mod && (k === "z" || k === "y")) {
      e.preventDefault();
      return voltar(k === "y" || e.shiftKey ? "refazer" : "desfazer");
    }
    if (k === "delete" || k === "backspace") {
      e.preventDefault();
      return apagarSelecao();
    }
    if (mod && k === "d") {
      e.preventDefault();
      return duplicarSelecao();
    }
    if (mod && k === "a") {
      e.preventDefault();
      return setNodes((ns) => ns.map((n) => ({ ...n, selected: true })));
    }
    if (k === "tab") {
      e.preventDefault();
      return selecionados.length ? filhoDoSelecionado() : adicionar("arredondado");
    }
    if ((k === "enter" || k === "f2") && selecionados.length === 1) {
      e.preventDefault();
      return aoComecarAEditar(selecionados[0]!.id);
    }
  };

  // Foco no desenho ao abrir (para o teclado já valer) e a tela atrás não rola.
  useEffect(() => {
    raiz.current?.focus({ preventScroll: true });
    const jaTinha = document.body.classList.contains("overflow-hidden");
    document.body.classList.add("overflow-hidden");
    return () => {
      if (!jaTinha) document.body.classList.remove("overflow-hidden");
    };
  }, []);

  const arestasDesenhadas = useMemo(() => arestasComLados(edges, nodes), [edges, nodes]);
  const nomeDaForma = (f: FormaDoCanvas) =>
    f === "retangulo"
      ? t("Retângulo")
      : f === "arredondado"
        ? t("Arredondado")
        : f === "elipse"
          ? t("Elipse")
          : f === "losango"
            ? t("Losango (decisão)")
            : f === "nota"
              ? t("Nota adesiva")
              : t("Texto livre");
  const nomeDaCor = (c: CorDoCanvas) =>
    c === "neutra"
      ? t("Neutra")
      : c === "verde"
        ? t("Verde")
        : c === "azul"
          ? t("Azul")
          : c === "amarela"
            ? t("Amarela")
            : c === "laranja"
              ? t("Laranja")
              : c === "vermelha"
                ? t("Vermelha")
                : t("Roxa");

  return (
    <div
      ref={raiz}
      role="dialog"
      aria-modal="true"
      aria-label={t("Canvas")}
      tabIndex={-1}
      onKeyDown={aoTeclar}
      onDoubleClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[70] flex flex-col bg-background outline-hidden"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-3 py-2">
        <div role="toolbar" aria-label={t("Adicionar")} className="flex flex-wrap gap-1">
          {FORMAS_DO_CANVAS.map((f) => (
            <button
              key={f}
              type="button"
              title={nomeDaForma(f)}
              aria-label={nomeDaForma(f)}
              onClick={() => mudarForma(f)}
              className="grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-base hover:bg-secondary"
            >
              {GLIFO_DA_FORMA[f]}
            </button>
          ))}
        </div>
        <div role="toolbar" aria-label={t("Cor")} className="flex items-center gap-1">
          {CORES_DO_CANVAS.map((c) => (
            <button
              key={c}
              type="button"
              title={nomeDaCor(c)}
              aria-label={nomeDaCor(c)}
              aria-pressed={
                selecionados.length ? selecionados.every((n) => n.data.cor === c) : corAtual === c
              }
              onClick={() => pintar(c)}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full border-2 border-transparent",
                (selecionados.length
                  ? selecionados.every((n) => n.data.cor === c)
                  : corAtual === c) && "border-primary",
              )}
            >
              <span className={cn("h-4 w-4 rounded-full", BOLINHA_DA_COR[c])} />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => voltar("desfazer")}
            className="h-9 rounded-lg border px-3 text-sm hover:bg-secondary"
          >
            {t("Desfazer")}
          </button>
          <button
            type="button"
            onClick={() => voltar("refazer")}
            className="h-9 rounded-lg border px-3 text-sm hover:bg-secondary"
          >
            {t("Refazer")}
          </button>
          <button
            type="button"
            disabled={!selecionados.length && !arestasSelecionadas.length}
            onClick={apagarSelecao}
            className="h-9 rounded-lg border px-3 text-sm hover:bg-secondary disabled:opacity-40"
          >
            {t("Apagar")}
          </button>
        </div>
        <button
          type="button"
          onClick={aoFechar}
          className="ml-auto h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[var(--color-accent-hover)]"
        >
          {t("Concluir")}
        </button>
      </div>

      <p className="border-b bg-secondary/40 px-3 py-1 text-xs text-muted-foreground">
        {t(
          "Dois cliques no fundo criam um bloco · Tab cria um bloco ligado ao selecionado · Enter edita o texto · arraste a bolinha de um bloco para ligar · Delete apaga · Ctrl+Z desfaz · Esc conclui",
        )}
      </p>

      <div className="min-h-0 flex-1">
        <ContextoDoCanvasReact.Provider value={contexto}>
          <ReactFlow
            nodes={nodes}
            edges={arestasDesenhadas}
            nodeTypes={TIPOS_DE_NO}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={aoConectar}
            onConnectEnd={aoSoltarSeta}
            onNodeDragStart={() => {
              passado.current.push({ nodes: atual.current.nodes, edges: atual.current.edges });
              futuro.current = [];
            }}
            onNodeDragStop={() => gravar(atual.current)}
            onNodeDoubleClick={(_, n) => aoComecarAEditar(n.id)}
            onDoubleClick={(e) => {
              const alvo = e.target as HTMLElement;
              if (!alvo.classList.contains("react-flow__pane")) return;
              const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
              adicionar("arredondado", { x: p.x - LARGURA_PADRAO / 2, y: p.y - ALTURA_PADRAO / 2 });
            }}
            connectionMode={ConnectionMode.Strict}
            deleteKeyCode={null}
            selectionKeyCode={null}
            multiSelectionKeyCode={["Shift", "Control", "Meta"]}
            selectionOnDrag
            panOnDrag={[1, 2]}
            panOnScroll
            zoomOnDoubleClick={false}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
            minZoom={0.2}
            maxZoom={2}
            snapToGrid
            snapGrid={[8, 8]}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!hidden sm:!block" />
          </ReactFlow>
        </ContextoDoCanvasReact.Provider>
      </div>
      <button type="button" className="sr-only" onClick={() => void fitView()}>
        {t("Ajustar à tela")}
      </button>
    </div>
  );
}
