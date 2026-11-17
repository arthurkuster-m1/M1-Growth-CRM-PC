"use client";

import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { BlocosRender, type RotulosDosBlocos } from "@/components/marketing/BlocosRender";
import { EditorDeCanvas } from "@/components/marketing/canvas/CanvasCarregavel";
import type { CursorDoCampo, EdicaoNoLugar } from "@/components/marketing/CampoNoLugar";
import {
  COR_DO_TIPO,
  FormularioDoBloco,
  resumoDoBloco,
  useNomesDosTipos,
} from "@/components/marketing/EditorDeBlocos";
import { ImportarDeTexto } from "@/components/marketing/ImportarDeTexto";
import { useHistoricoDeEdicao } from "@/hooks/editor/useHistoricoDeEdicao";
import { toast } from "sonner";

import { useT } from "@/hooks/i18n/useT";
import {
  blocoEmBranco,
  lerBlocos,
  MAXIMO_DE_BLOCOS,
  MAXIMO_DE_COLUNAS,
  type Bloco,
} from "@/lib/marketing/blocos";
import {
  alvoDoAtalho,
  alvoDoTeclado,
  atalhoDeMarkdown,
  atalhoDoAlvo,
  TODOS_OS_ALVOS,
  ALVOS_BASICOS,
  ALVOS_VISUAIS,
  aplicarPropriedade,
  converterBloco,
  agruparPorLinha,
  duplicarBlocos,
  ehOAlvo,
  juntarComOAnterior,
  juntarEmLinha,
  moverBlocos,
  normalizarLinhas,
  propriedadesDoBloco,
  removerBlocos,
  separarDaLinha,
  type AlvoDeConversao,
} from "@/lib/marketing/edicao-de-blocos";
import { aplicarMarcaNoCampo, type MarcaDeEstilo } from "@/lib/marketing/texto-rico";
import { lerTextoDaPagina, textoDaPagina } from "@/lib/marketing/texto-estruturado";
import { modeloDaPagina } from "@/lib/marketing/modelos";
import type { Caminho } from "@/lib/marketing/caminho";
import { Copy, DotsSixVertical, PencilSimple, Plus, Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface Selecao {
  ids: ReadonlySet<string>;
  ancora: string | null;
  ponta: string | null;
}
const SEM_SELECAO: Selecao = { ids: new Set(), ancora: null, ponta: null };

/** O bloco tem textos que se digitam direto nele (senão, só a caixa de edição). */
function temCamposNoLugar(b: Bloco): boolean {
  if (
    b.tipo === "oferta" ||
    b.tipo === "calculadora" ||
    b.tipo === "separador" ||
    b.tipo === "canvas"
  )
    return false;
  if (b.tipo === "imagem") return b.arquivo !== "";
  return true;
}

type Menu =
  | { tipo: "bloco"; x: number; y: number; blocoId: string }
  | { tipo: "inserir"; x: number; y: number; depoisDe: string | null }
  | { tipo: "comandos"; x: number; y: number; blocoId: string }
  | { tipo: "modelos"; x: number; y: number };

/** O que foi copiado por último aqui (para colar os blocos inteiros, não só o texto). */
const CHAVE_DA_COPIA = "m1:editor-visual:copia";

/** A cópia mora na sessão do navegador: dá para copiar numa página e colar em outra. */
const copia = {
  guardar(valor: { texto: string; blocos: Bloco[] }) {
    try {
      window.sessionStorage.setItem(CHAVE_DA_COPIA, JSON.stringify(valor));
    } catch {
      // sem armazenamento: só não cola
    }
  },
  ler(): { texto: string; blocos: Bloco[] } | null {
    try {
      const bruto = window.sessionStorage.getItem(CHAVE_DA_COPIA);
      return bruto ? (JSON.parse(bruto) as { texto: string; blocos: Bloco[] }) : null;
    } catch {
      return null;
    }
  },
};

/** Blocos que, sem conteúdo, não desenham nada: mostram um convite no lugar. */
const MOSTRA_CONVITE_SE_VAZIO: ReadonlySet<Bloco["tipo"]> = new Set([
  "titulo",
  "texto",
  "destaque",
  "lista",
  "citacao",
  "toggle",
  "imagem",
  "imagem-texto",
  "links",
  "cards",
  "metricas",
  "antes-depois",
  "ficha",
  "fluxo",
  "piramide",
  "canvas",
]);

/** O campo principal de cada bloco de texto: é nele que Enter continua a escrita no bloco de baixo. */
const CAMPO_DE_FLUXO: Partial<Record<Bloco["tipo"], string>> = {
  texto: "texto",
  titulo: "texto",
  destaque: "texto",
  citacao: "texto",
  toggle: "titulo",
};

const semAcento = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** O menu "/": uma busca com teclado (setas e Enter) para trocar o bloco em que se está escrevendo. */
function MenuDeComandos({
  alvos,
  aoEscolher,
  aoFechar,
}: {
  alvos: readonly AlvoDeConversao[];
  aoEscolher: (alvo: AlvoDeConversao) => void;
  aoFechar: () => void;
}) {
  const t = useT();
  const [busca, setBusca] = useState("");
  const [indice, setIndice] = useState(0);
  const termo = semAcento(busca);
  const lista = termo ? alvos.filter((a) => semAcento(t(a.rotulo)).includes(termo)) : alvos;
  const atual = Math.min(indice, Math.max(0, lista.length - 1));
  const itemAtivo = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    itemAtivo.current?.scrollIntoView?.({ block: "nearest" });
  }, [atual, termo]);

  return (
    <div
      data-menu-comandos
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const n = lista.length || 1;
          setIndice((atual + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (lista[atual]) aoEscolher(lista[atual]);
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          aoFechar();
        } else if (e.key === "Backspace" && busca === "") {
          e.preventDefault();
          aoFechar();
        }
      }}
    >
      <input
        autoFocus
        value={busca}
        onChange={(e) => {
          setBusca(e.target.value);
          setIndice(0);
        }}
        placeholder={t("Digite para buscar um bloco…")}
        aria-label={t("Buscar bloco")}
        className="mb-1 h-9 w-full rounded-lg border bg-background px-2.5 text-sm outline-hidden focus:border-primary/60"
      />
      {lista.length === 0 ? (
        <p className="px-2 py-3 text-sm text-muted-foreground">{t("Nenhum bloco encontrado.")}</p>
      ) : (
        lista.map((a, i) => (
          <button
            key={a.rotulo}
            ref={i === atual ? itemAtivo : undefined}
            type="button"
            role="menuitem"
            onMouseEnter={() => setIndice(i)}
            onClick={() => aoEscolher(a)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm",
              i === atual ? "bg-secondary" : "hover:bg-secondary/60",
            )}
          >
            <span className="grid w-6 shrink-0 place-items-center text-xs font-semibold text-muted-foreground">
              {a.glifo}
            </span>
            <span className="min-w-0 flex-1 truncate">{t(a.rotulo)}</span>
            <span className="shrink-0 text-[10px] text-text-subtle">{atalhoDoAlvo(a)?.rotulo}</span>
          </button>
        ))
      )}
    </div>
  );
}

const ehCampoDeTexto = (alvo: EventTarget | null) =>
  alvo instanceof HTMLElement &&
  Boolean(alvo.closest("input, textarea, select, [contenteditable='true']"));

// ── o menu flutuante (botão direito, alça e "+") ─────────────────────────────────
function MenuFlutuante({
  x,
  y,
  aoFechar,
  children,
}: {
  x: number;
  y: number;
  aoFechar: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x, y });

  // Mantém o menu inteiro dentro da janela — e ONDE FOI PEDIDO. Dentro de uma janela/página com
  // `transform` (a página do compromisso), `position: fixed` deixa de ser relativo à tela e passa
  // a ser relativo a ela: o menu nascia longe do "+". Mede-se onde ele de fato caiu e soma-se a
  // diferença, o que vale com ou sem esse deslocamento.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const r = el.getBoundingClientRect();
    const dx = r.left - x;
    const dy = r.top - y;
    // Sem espaço embaixo, o menu abre PARA CIMA do ponto clicado (encostado nele) em vez de
    // ser empurrado para o meio da tela.
    const cabeEmbaixo = y + r.height <= window.innerHeight - 8;
    const yEscolhido = cabeEmbaixo ? y : y - r.height - 32;
    setPos({
      x: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)) - dx,
      y: Math.max(8, Math.min(yEscolhido, window.innerHeight - r.height - 8)) - dy,
    });
  }, [x, y]);

  useEffect(() => {
    const fora = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) aoFechar();
    };
    const tecla = (e: globalThis.KeyboardEvent) => e.key === "Escape" && aoFechar();
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    window.addEventListener("resize", aoFechar);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("resize", aoFechar);
    };
  }, [aoFechar]);

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 max-h-[min(34rem,calc(100dvh-1rem))] w-72 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl border bg-popover p-1.5 shadow-xl"
    >
      {children}
    </div>
  );
}

function CabecalhoDoMenu({ children }: { children: ReactNode }) {
  return (
    <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-text-subtle uppercase">
      {children}
    </p>
  );
}

function ItemDoMenu({
  onClick,
  children,
  destrutivo,
  ativo,
  glifo,
  dica,
}: {
  onClick: () => void;
  children: ReactNode;
  destrutivo?: boolean;
  ativo?: boolean;
  glifo?: ReactNode;
  dica?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary",
        destrutivo && "text-error-fg hover:bg-error-bg",
        ativo && "bg-accent-soft font-medium text-primary",
      )}
    >
      {glifo !== undefined ? (
        <span className="grid w-6 shrink-0 place-items-center text-xs font-semibold text-muted-foreground">
          {glifo}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {dica ? <span className="shrink-0 text-[10px] text-text-subtle">{dica}</span> : null}
    </button>
  );
}

/** Um modelo no menu: o nome e as duas formas de aplicar (a substituição pede confirmação). */
function LinhaDeModelo({
  rotulo,
  descricao,
  confirmando,
  vazia,
  semAdicionar,
  aoAdicionar,
  aoSubstituir,
}: {
  rotulo: string;
  descricao: string;
  confirmando: boolean;
  vazia: boolean;
  semAdicionar?: boolean;
  aoAdicionar: () => void;
  aoSubstituir: () => void;
}) {
  const t = useT();
  return (
    <div className="rounded-lg px-2 py-1.5 hover:bg-secondary/60">
      <p className="text-sm font-medium">{rotulo}</p>
      {descricao ? <p className="text-xs text-muted-foreground">{descricao}</p> : null}
      <div className="mt-1 flex flex-wrap gap-1">
        {semAdicionar ? null : (
          <button
            type="button"
            onClick={aoAdicionar}
            className="rounded-lg border px-2 py-0.5 text-xs hover:bg-secondary"
          >
            {vazia ? t("Usar este modelo") : t("Adicionar ao final")}
          </button>
        )}
        {vazia && !semAdicionar ? null : (
          <button
            type="button"
            onClick={aoSubstituir}
            className={cn(
              "rounded-lg border px-2 py-0.5 text-xs hover:bg-secondary",
              confirmando && "border-error bg-error-bg text-error-fg",
            )}
          >
            {confirmando ? t("Confirmar: apagar tudo e usar") : t("Substituir a página")}
          </button>
        )}
      </div>
    </div>
  );
}

// ── uma linha: o bloco como o cliente vai ver, com a alça e o "+" ────────────────
function LinhaVisual({
  bloco,
  posicao,
  selecionado,
  editando,
  rotulos,
  aoPressionar,
  aoEditar,
  aoEditarTudo,
  aoSairDoTexto,
  edicao,
  digitando,
  aoAbrirMenu,
  aoInserir,
  painel,
  rotuloDoTipo,
  emColuna,
}: {
  bloco: Bloco;
  /** O bloco divide a linha com outros: faixa da alça mais estreita. */
  emColuna?: boolean;
  posicao: number;
  selecionado: boolean;
  editando: boolean;
  rotulos: RotulosDosBlocos;
  aoPressionar: (e: MouseEvent<HTMLElement>, id: string) => void;
  /** Dois cliques: digitar no próprio bloco (ou abrir a caixa, nos blocos sem texto no lugar). */
  aoEditar: (id: string, x: number, y: number) => void;
  /** O lápis do bloco selecionado: a caixa com todos os campos. */
  aoEditarTudo: (id: string) => void;
  aoSairDoTexto: () => void;
  edicao: EdicaoNoLugar;
  /** Este bloco está em "digitar direto". */
  digitando: boolean;
  aoAbrirMenu: (x: number, y: number, id: string) => void;
  aoInserir: (x: number, y: number, id: string) => void;
  painel: ReactNode;
  rotuloDoTipo: string;
}) {
  const t = useT();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bloco.id });
  const vazio = MOSTRA_CONVITE_SE_VAZIO.has(bloco.tipo) && resumoDoBloco(bloco) === "";

  return (
    <div
      ref={setNodeRef}
      data-bloco-id={bloco.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group/linha relative", isDragging && "z-10 opacity-70")}
    >
      <div className="flex items-start gap-0.5 sm:gap-1">
        <div
          className={cn(
            // No celular a faixa da alça é estreita (o texto aproveita a largura); no computador, larga.
            "flex w-5 shrink-0 items-center justify-end gap-0.5 pt-3 transition-opacity",
            emColuna ? "sm:w-5" : "sm:w-12",
            selecionado
              ? "opacity-100"
              : "opacity-0 group-hover/linha:opacity-100 focus-within:opacity-100",
          )}
        >
          <button
            type="button"
            aria-label={t("Inserir bloco abaixo")}
            title={t("Inserir bloco abaixo")}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              aoInserir(r.left, r.bottom + 4, bloco.id);
            }}
            className={cn(
              "hidden h-6 w-6 place-items-center rounded-md text-text-subtle hover:bg-secondary",
              !emColuna && "sm:grid",
            )}
          >
            <Plus size={14} weight="bold" aria-hidden />
          </button>
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`${t("Arrastar ou abrir o menu do bloco")}: ${rotuloDoTipo} ${posicao}`}
            title={t("Arraste para mover · clique para o menu")}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              aoAbrirMenu(r.left, r.bottom + 4, bloco.id);
            }}
            className="grid h-6 w-5 cursor-grab touch-none place-items-center rounded-md text-text-subtle hover:bg-secondary max-sm:-mr-0.5"
          >
            <DotsSixVertical size={16} weight="bold" aria-hidden />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div
            role="group"
            aria-label={`${rotuloDoTipo} ${posicao}`}
            aria-selected={selecionado}
            onMouseDown={(e) => aoPressionar(e, bloco.id)}
            onDoubleClick={(e) => aoEditar(bloco.id, e.clientX, e.clientY)}
            onBlur={(e) => {
              if (digitando && !e.currentTarget.contains(e.relatedTarget as Node | null)) {
                aoSairDoTexto();
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              aoAbrirMenu(e.clientX, e.clientY, bloco.id);
            }}
            className={cn(
              "relative rounded-2xl border-2 border-transparent p-2 transition-colors sm:p-3",
              digitando ? "cursor-text" : "cursor-pointer select-none",
              selecionado ? "border-primary/50 bg-primary/10" : "hover:bg-secondary/40",
              editando && "border-primary/50",
            )}
          >
            {selecionado && !digitando && temCamposNoLugar(bloco) ? (
              <button
                type="button"
                aria-label={t("Editar todos os campos do bloco")}
                title={t("Editar todos os campos do bloco")}
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onClick={() => aoEditarTudo(bloco.id)}
                className="absolute top-2 right-2 z-10 grid h-7 w-7 place-items-center rounded-lg border bg-card text-muted-foreground shadow-sm hover:text-foreground"
              >
                <PencilSimple size={14} aria-hidden />
              </button>
            ) : null}
            <div className={cn(!digitando && "pointer-events-none")}>
              {vazio && !digitando ? (
                <p
                  className={cn(
                    "rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground",
                    (COR_DO_TIPO[bloco.tipo] ?? COR_DO_TIPO.texto!).fundo,
                  )}
                >
                  {rotuloDoTipo} — {t("dê dois cliques para editar")}
                </p>
              ) : (
                <BlocosRender blocos={[bloco]} rotulos={rotulos} edicao={edicao} />
              )}
            </div>
          </div>
          {painel}
        </div>
      </div>
    </div>
  );
}

interface Props {
  blocos: Bloco[];
  aoMudar: (blocos: Bloco[]) => void;
  novoId: () => string;
  tituloDaPagina?: string;
  chaveDaPagina?: string;
  rotulos: RotulosDosBlocos;
  /** O teto de blocos da página (Marketing: 150; Anotações: mais, porque cada parágrafo é um bloco). */
  maximo?: number;
}

/**
 * O EDITOR VISUAL DE BLOCOS da Estratégia — a página já como o cliente a vê, editável no lugar.
 *
 *  - Clique seleciona; duplo clique abre a caixa de edição logo abaixo do bloco (o resultado
 *    aparece no próprio bloco, em cima, enquanto se digita).
 *  - Botão direito (ou a alça de seis pontos): tipo, tamanho, alinhamento, tom, duplicar, apagar.
 *  - Seleção em massa: Shift+clique, Ctrl+clique, arrastar o mouse por cima de vários blocos,
 *    Ctrl+A; Delete, Ctrl+C/X/V, Ctrl+D e Ctrl+Shift+0…9 valem para todos os selecionados.
 *  - Arrastar a alça move o bloco (ou a seleção inteira). Ctrl+Z desfaz, Ctrl+Shift+Z refaz.
 *
 * Os blocos e o formulário de cada um são os de sempre (`BlocosRender`, `FormularioDoBloco`): só
 * muda ONDE se edita.
 */
export function EditorVisualDeBlocos({
  blocos,
  aoMudar: aoMudarDeFora,
  novoId,
  tituloDaPagina,
  chaveDaPagina,
  rotulos,
  maximo = MAXIMO_DE_BLOCOS,
}: Props) {
  const t = useT();
  const nomeDoTipo = useNomesDosTipos();
  const raiz = useRef<HTMLDivElement | null>(null);
  const [sel, setSel] = useState<Selecao>(SEM_SELECAO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  // O bloco em que se digita direto no texto final, e quem recebe o cursor no próximo desenho.
  const [digitandoId, setDigitandoId] = useState<string | null>(null);
  const [focoPedido, setFocoPedido] = useState<string | null>(null);
  const [confirmarModelo, setConfirmarModelo] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [arrastandoMouse, setArrastandoMouse] = useState(false);
  // O canvas aberto em tela cheia (o desenho todo, formas e setas).
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const historico = useHistoricoDeEdicao(blocos, aoMudarDeFora);
  const aoMudar = (novos: Bloco[], chave?: string) =>
    historico.mudar(normalizarLinhas(novos), chave);
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const ids = blocos.map((b) => b.id);
  // A seleção só vale para blocos que ainda existem (um Ctrl+Z pode tê-los tirado).
  const selecionados = new Set([...sel.ids].filter((id) => ids.includes(id)));
  const editando = editandoId && ids.includes(editandoId) ? editandoId : null;
  const digitando = digitandoId && ids.includes(digitandoId) ? digitandoId : null;
  const edicao: EdicaoNoLugar = {
    ativoId: digitando,
    aoMudar: (novo) =>
      aoMudar(
        blocos.map((x) => (x.id === novo.id ? novo : x)),
        novo.id,
      ),
    foco: focoPedido,
    pedirFoco: setFocoPedido,
    sair: () => {
      setDigitandoId(null);
      raiz.current?.focus({ preventScroll: true });
    },
    aoEnter: (b, caminho, cursor) => continuarNoBlocoDeBaixo(b, caminho, cursor),
    aoApagarNoInicio: (b, caminho, cursor) => apagarNoInicio(b, caminho, cursor),
    aoBarra: (b, campo) => abrirBusca(b, campo),
    navegar: (b, direcao, campo) => irParaOVizinho(b, direcao, campo),
    aoDigitar: (b, caminho, valor) => virarBlocoPorMarcador(b, caminho, valor),
    sairDaLista: (b, indice) => sairDaListaParaTexto(b, indice),
  };

  // ── escrever com fluidez (estilo Notion): uma ação liga na outra sem tirar a mão do teclado ──
  const ehCampoPrincipal = (b: Bloco, caminho: Caminho) =>
    caminho.length === 1 && CAMPO_DE_FLUXO[b.tipo] === String(caminho[0]);

  /** Enter: o que vem depois do cursor vai para um bloco de texto novo logo abaixo, já com o cursor nele. */
  function continuarNoBlocoDeBaixo(b: Bloco, caminho: Caminho, cursor: CursorDoCampo): boolean {
    if (!ehCampoPrincipal(b, caminho) || b.linha || blocos.length >= maximo) return false;
    if (b.tipo === "toggle") {
      // Enter na linha do toggle segue para o texto que ele esconde.
      setFocoPedido(`${b.id}|texto`);
      return true;
    }
    const campo = CAMPO_DE_FLUXO[b.tipo]!;
    const atualizado = { ...b, [campo]: cursor.valor.slice(0, cursor.inicio) } as Bloco;
    const novo = {
      ...blocoEmBranco("texto", novoId()),
      texto: cursor.valor.slice(cursor.fim),
    } as Bloco;
    const lista = blocos.map((x) => (x.id === b.id ? atualizado : x));
    lista.splice(ids.indexOf(b.id) + 1, 0, novo);
    aoMudar(lista);
    selecionarUnico(novo.id);
    digitarNoBloco(novo.id, undefined, undefined, "inicio");
    return true;
  }

  /** Backspace no começo de um bloco vazio: vira texto; e um texto vazio some, voltando ao de cima. */
  function apagarNoInicio(b: Bloco, caminho: Caminho, cursor: CursorDoCampo): boolean {
    const listaVaziaDeUm =
      b.tipo === "lista" && caminho[0] === "itens" && b.itens.length === 1 && b.itens[0] === "";
    if (!listaVaziaDeUm && !(ehCampoPrincipal(b, caminho) && cursor.valor === "")) return false;
    if (b.tipo !== "texto") {
      const alvo = alvoDoAtalho("0")!;
      aoMudar(blocos.map((x) => (x.id === b.id ? converterBloco(b, alvo) : x)));
      digitarNoBloco(b.id);
      return true;
    }
    if (blocos.length < 2) return false;
    const i = ids.indexOf(b.id);
    const restantes = removerBlocos(blocos, new Set([b.id]));
    aoMudar(restantes);
    const anterior = restantes[i - 1];
    const vizinho = anterior ?? restantes[i];
    if (!vizinho) return true;
    selecionarUnico(vizinho.id);
    if (temCamposNoLugar(vizinho)) {
      digitarNoBloco(vizinho.id, undefined, undefined, anterior ? "ultimo-campo" : "inicio");
    } else setDigitandoId(null);
    return true;
  }

  /** "/" num texto vazio: abre a busca de blocos ali mesmo. */
  function abrirBusca(b: Bloco, campo: HTMLTextAreaElement): boolean {
    if (b.tipo !== "texto") return false;
    const r = campo.getBoundingClientRect();
    setMenu({ tipo: "comandos", x: r.left, y: r.bottom + 4, blocoId: b.id });
    return true;
  }

  /** Seta na ponta do texto: anda para o campo ou bloco vizinho (pulando os que não têm texto). */
  function irParaOVizinho(
    b: Bloco,
    direcao: "cima" | "baixo",
    campo: HTMLTextAreaElement,
  ): boolean {
    const campos = Array.from(
      document.querySelectorAll<HTMLTextAreaElement>(
        `[data-bloco-id="${b.id}"] textarea[data-campo-no-lugar]`,
      ),
    );
    const j = campos.indexOf(campo);
    const proximo = campos[j + (direcao === "cima" ? -1 : 1)];
    if (proximo) {
      proximo.focus();
      const pos = direcao === "cima" ? proximo.value.length : 0;
      proximo.setSelectionRange(pos, pos);
      return true;
    }
    const i = ids.indexOf(b.id);
    const vizinho =
      direcao === "cima"
        ? blocos.slice(0, i).reverse().find(temCamposNoLugar)
        : blocos.slice(i + 1).find(temCamposNoLugar);
    if (!vizinho) return false;
    selecionarUnico(vizinho.id);
    digitarNoBloco(
      vizinho.id,
      undefined,
      undefined,
      direcao === "cima" ? "ultimo-campo" : "inicio",
    );
    return true;
  }

  /** "# ", "- ", "1. ", "[] ", "> " no começo de um texto viram o bloco certo (como no Notion). */
  function virarBlocoPorMarcador(b: Bloco, caminho: Caminho, valor: string): boolean {
    if (b.tipo !== "texto" || !ehCampoPrincipal(b, caminho)) return false;
    const marca = atalhoDeMarkdown(valor);
    if (!marca) return false;
    const novo = converterBloco({ ...b, texto: marca.resto }, marca.alvo);
    aoMudar(blocos.map((x) => (x.id === b.id ? novo : x)));
    digitarNoBloco(b.id);
    return true;
  }

  /** Enter num item vazio, no fim da lista: a lista termina e a escrita segue num texto novo. */
  function sairDaListaParaTexto(b: Bloco, indice: number): boolean {
    if (b.tipo !== "lista" || b.linha || indice !== b.itens.length - 1) return false;
    if (b.itens.length > 1 && blocos.length >= maximo) return false;
    const texto = blocoEmBranco("texto", novoId());
    if (b.itens.length === 1) {
      aoMudar(blocos.map((x) => (x.id === b.id ? ({ ...texto, id: b.id } as Bloco) : x)));
      digitarNoBloco(b.id);
      return true;
    }
    const lista = blocos.map((x) =>
      x.id === b.id ? ({ ...b, itens: b.itens.slice(0, -1) } as Bloco) : x,
    );
    lista.splice(ids.indexOf(b.id) + 1, 0, texto);
    aoMudar(lista);
    selecionarUnico(texto.id);
    digitarNoBloco(texto.id);
    return true;
  }

  /** Clicar no vazio da página escreve: vai ao último texto em branco, ou cria um novo no fim. */
  function escreverNoFim() {
    const ultimo = blocos[blocos.length - 1];
    if (ultimo && ultimo.tipo === "texto" && ultimo.texto.trim() === "") {
      selecionarUnico(ultimo.id);
      digitarNoBloco(ultimo.id);
      return;
    }
    if (blocos.length >= maximo) return;
    const novo = blocoEmBranco("texto", novoId());
    aoMudar([...blocos, novo]);
    selecionarUnico(novo.id);
    digitarNoBloco(novo.id);
  }

  const focarRaiz = () => raiz.current?.focus({ preventScroll: true });
  /** Põe o bloco para digitar direto: o cursor vai ao texto sob o clique (ou ao primeiro). */
  const digitarNoBloco = (
    id: string,
    x?: number,
    y?: number,
    ponta: "fim" | "inicio" | "ultimo-campo" = "fim",
  ) => {
    setEditandoId(null);
    setDigitandoId(id);
    requestAnimationFrame(() => {
      const campos = Array.from(
        document.querySelectorAll<HTMLTextAreaElement>(
          `[data-bloco-id="${id}"] textarea[data-campo-no-lugar]`,
        ),
      );
      const sob =
        x === undefined || y === undefined
          ? undefined
          : campos.find((c) => {
              const r = c.getBoundingClientRect();
              return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
            });
      const alvo = sob ?? (ponta === "ultimo-campo" ? campos[campos.length - 1] : campos[0]);
      alvo?.focus();
      const pos = ponta === "inicio" ? 0 : (alvo?.value.length ?? 0);
      alvo?.setSelectionRange(pos, pos);
    });
  };
  /** Depois de criar ou converter UM bloco: o que a pessoa faz em seguida (digitar, desenhar…). */
  const comecarNo = (b: Bloco, ponta: "fim" | "inicio" = "fim") => {
    if (temCamposNoLugar(b)) digitarNoBloco(b.id, undefined, undefined, ponta);
    else if (b.tipo === "canvas") setCanvasId(b.id);
    else if (b.tipo !== "separador") abrirCaixa(b.id);
  };
  const abrirCaixa = (id: string) => {
    setDigitandoId(null);
    setEditandoId(id);
  };
  const selecionarUnico = (id: string) => {
    setSel({ ids: new Set([id]), ancora: id, ponta: id });
    focarRaiz();
  };
  const estender = (ponta: string, de: string | null = sel.ancora) => {
    const ancora = de ?? ponta;
    const a = ids.indexOf(ancora);
    const b = ids.indexOf(ponta);
    if (a < 0 || b < 0) return selecionarUnico(ponta);
    const [i, j] = a < b ? [a, b] : [b, a];
    setSel({ ids: new Set(ids.slice(i, j + 1)), ancora, ponta });
    focarRaiz();
  };
  const alternar = (id: string) => {
    const novos = new Set(selecionados);
    if (novos.has(id)) novos.delete(id);
    else novos.add(id);
    setSel({ ids: novos, ancora: id, ponta: id });
    focarRaiz();
  };
  const limpar = () => setSel(SEM_SELECAO);

  // ── operações sobre a seleção ───────────────────────────────────────────────────
  const apagar = () => {
    if (!selecionados.size) return;
    const primeiro = ids.findIndex((i) => selecionados.has(i));
    const restantes = removerBlocos(blocos, selecionados);
    aoMudar(restantes);
    limpar();
    if (editando && selecionados.has(editando)) setEditandoId(null);
    const vizinho = restantes[Math.min(primeiro, restantes.length - 1)];
    if (vizinho) selecionarUnico(vizinho.id);
  };
  const duplicar = () => {
    if (!selecionados.size || blocos.length + selecionados.size > maximo) return;
    aoMudar(duplicarBlocos(blocos, selecionados, novoId));
  };
  const converter = (alvo: AlvoDeConversao) => {
    if (!selecionados.size) return;
    aoMudar(blocos.map((b) => (selecionados.has(b.id) ? converterBloco(b, alvo) : b)));
  };
  const ajustar = (primario: Bloco, campo: string, valor: string | number) => {
    aoMudar(
      blocos.map((b) =>
        selecionados.has(b.id) && b.tipo === primario.tipo
          ? aplicarPropriedade(b, campo, valor)
          : b,
      ),
    );
  };
  const inserir = (alvo: AlvoDeConversao, depoisDe: string | null) => {
    if (blocos.length >= maximo) return;
    const novo = converterBloco(blocoEmBranco(alvo.tipo, novoId()), alvo);
    const i = depoisDe ? ids.indexOf(depoisDe) : -1;
    const copia = [...blocos];
    copia.splice(i < 0 ? copia.length : i + 1, 0, novo);
    aoMudar(copia);
    selecionarUnico(novo.id);
    comecarNo(novo);
  };
  const juntarLado = () => {
    if (selecionados.size > 1) {
      if (selecionados.size > MAXIMO_DE_COLUNAS) {
        toast.error(`${t("No máximo")} ${MAXIMO_DE_COLUNAS} ${t("blocos lado a lado.")}`);
        return;
      }
      aoMudar(juntarEmLinha(blocos, selecionados, novoId()));
    } else if (selecionados.size === 1) {
      const id = [...selecionados][0]!;
      const novos = juntarComOAnterior(blocos, id, novoId());
      if (novos === blocos) {
        toast.error(
          ids.indexOf(id) < 1
            ? t("Não há bloco acima para ficar ao lado.")
            : `${t("No máximo")} ${MAXIMO_DE_COLUNAS} ${t("blocos lado a lado.")}`,
        );
        return;
      }
      aoMudar(novos);
    }
  };
  const separarLado = () => aoMudar(separarDaLinha(blocos, selecionados));

  const colar = (novos: Bloco[]) => {
    if (!novos.length || blocos.length + novos.length > maximo) return;
    // As linhas (colunas) copiadas continuam juntas, mas numa linha nova.
    const novaLinha = new Map<string, string>();
    const copias = novos.map((b) => {
      const c = { ...structuredClone(b), id: novoId() } as Bloco;
      if (b.linha) {
        if (!novaLinha.has(b.linha)) novaLinha.set(b.linha, novoId());
        c.linha = novaLinha.get(b.linha);
      }
      return c;
    });
    const ultimo = [...ids].reverse().find((i) => selecionados.has(i));
    const i = ultimo ? ids.indexOf(ultimo) : ids.length - 1;
    const resultado = [...blocos];
    resultado.splice(i + 1, 0, ...copias);
    aoMudar(resultado);
    setSel({
      ids: new Set(copias.map((b) => b.id)),
      ancora: copias[0]!.id,
      ponta: copias[copias.length - 1]!.id,
    });
  };

  const voltarNoTempo = (direcao: "desfazer" | "refazer") => {
    if (direcao === "desfazer") historico.desfazer();
    else historico.refazer();
  };

  // ── arrastar a alça ─────────────────────────────────────────────────────────────
  const aoSoltar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const de = ids.indexOf(String(e.active.id));
    const para = ids.indexOf(String(e.over.id));
    if (de < 0 || para < 0) return;
    if (selecionados.size > 1 && selecionados.has(String(e.active.id))) {
      aoMudar(moverBlocos(blocos, selecionados, String(e.over.id), de < para));
      return;
    }
    aoMudar(arrayMove(blocos, de, para));
  };

  // ── mouse: clicar seleciona, arrastar por cima de vários seleciona o trecho ─────
  const aoPressionar = (e: MouseEvent<HTMLElement>, id: string) => {
    if (e.button !== 0) return;
    // Digitando no bloco: o clique é do cursor, não da seleção.
    if (digitando === id) return;
    if (e.shiftKey) {
      e.preventDefault();
      return estender(id, sel.ancora ?? ids[0] ?? id);
    }
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      return alternar(id);
    }
    selecionarUnico(id);
    let ativo = false;
    const mover = (m: globalThis.MouseEvent) => {
      const outro = document
        .elementFromPoint(m.clientX, m.clientY)
        ?.closest<HTMLElement>("[data-bloco-id]")?.dataset.blocoId;
      if (!outro || (!ativo && outro === id)) return;
      ativo = true;
      setArrastandoMouse(true);
      estender(outro, id);
    };
    const soltar = () => {
      document.removeEventListener("mousemove", mover);
      document.removeEventListener("mouseup", soltar);
      setArrastandoMouse(false);
    };
    document.addEventListener("mousemove", mover);
    document.addEventListener("mouseup", soltar);
  };

  // ── teclado ─────────────────────────────────────────────────────────────────────
  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    const emCampo = ehCampoDeTexto(e.target);
    const k = e.key.toLowerCase();

    // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y valem em qualquer lugar do editor, inclusive na caixa de edição.
    if (mod && !e.altKey && (k === "z" || k === "y")) {
      e.preventDefault();
      e.stopPropagation();
      return voltarNoTempo(k === "y" || e.shiftKey ? "refazer" : "desfazer");
    }
    if (k === "escape") {
      if (digitando) {
        e.preventDefault();
        setDigitandoId(null);
        return focarRaiz();
      }
      if (editando) {
        e.preventDefault();
        setEditandoId(null);
        return focarRaiz();
      }
      if (!emCampo && selecionados.size) {
        e.preventDefault();
        return limpar();
      }
      return;
    }
    // Cada bloco tem o seu atalho (ver `ATALHOS_DE_BLOCO`) — vale até no meio da digitação.
    const alvoDaTecla = alvoDoTeclado(e.nativeEvent);
    if (alvoDaTecla && (!emCampo || digitando)) {
      e.preventDefault();
      e.stopPropagation();
      return aplicarAtalho(alvoDaTecla);
    }
    if (emCampo) return;

    if (k === "arrowup" || k === "arrowdown") {
      e.preventDefault();
      const i = ids.indexOf(sel.ponta ?? "");
      const alvo = ids[i + (k === "arrowup" ? -1 : 1)] ?? (i < 0 ? ids[0] : undefined);
      if (!alvo) return;
      return e.shiftKey ? estender(alvo) : selecionarUnico(alvo);
    }
    if (k === "enter" && selecionados.size === 1) {
      e.preventDefault();
      const unico = blocos.find((b) => b.id === [...selecionados][0]);
      if (unico && temCamposNoLugar(unico)) return digitarNoBloco(unico.id);
      if (unico?.tipo === "canvas") return setCanvasId(unico.id);
      return abrirCaixa([...selecionados][0]!);
    }
    if (k === "backspace" || k === "delete") {
      e.preventDefault();
      return apagar();
    }
    if (mod && k === "a") {
      e.preventDefault();
      return setSel({ ids: new Set(ids), ancora: ids[0] ?? null, ponta: ids.at(-1) ?? null });
    }
    if (mod && k === "d") {
      e.preventDefault();
      return duplicar();
    }
  };

  /** O atalho de um bloco: troca o que se está digitando ou o que está selecionado; sem nada, cria um novo no fim. */
  const aplicarAtalho = (alvo: AlvoDeConversao) => {
    if (digitando) {
      const b = blocos.find((x) => x.id === digitando);
      if (!b) return;
      const novo = converterBloco(b, alvo);
      aoMudar(blocos.map((x) => (x.id === b.id ? novo : x)));
      selecionarUnico(b.id);
      comecarNo(novo);
      return;
    }
    if (selecionados.size) {
      converter(alvo);
      if (alvo.tipo === "canvas" && selecionados.size === 1) setCanvasId([...selecionados][0]!);
      return;
    }
    inserir(alvo, ids.at(-1) ?? null);
  };

  const aoCopiar = (e: ClipboardEvent<HTMLDivElement>, cortar: boolean) => {
    if (ehCampoDeTexto(e.target) || !selecionados.size) return;
    const escolhidos = blocos.filter((b) => selecionados.has(b.id));
    // Texto estruturado (o mesmo de "Copiar a página como texto"): todos os tipos de bloco saem
    // nele, e colar em outra página (ou no "Importar de texto") traz os blocos de volta.
    const texto = textoDaPagina(escolhidos).texto.trimEnd();
    copia.guardar({ texto, blocos: escolhidos });
    e.clipboardData.setData("text/plain", texto);
    e.preventDefault();
    if (cortar) apagar();
  };
  const aoColar = (e: ClipboardEvent<HTMLDivElement>) => {
    if (ehCampoDeTexto(e.target)) return;
    const texto = e.clipboardData.getData("text/plain");
    const guardada = copia.ler();
    if (guardada && guardada.texto === texto) {
      e.preventDefault();
      // O que vem da sessão passa pela mesma validação de qualquer bloco lido.
      colar(lerBlocos(guardada.blocos));
      return;
    }
    // Texto estruturado copiado de fora (ou de outra aba): vira blocos, se for válido.
    if (/^\s*(:::|\|\|\|)/m.test(texto)) {
      const leitura = lerTextoDaPagina(texto, novoId);
      if (!leitura.problemas.length && leitura.blocos.length) {
        e.preventDefault();
        colar(leitura.blocos);
      }
    }
  };

  const aplicarModelo = (
    modo: "adicionar" | "substituir",
    montar: (n: () => string) => Bloco[],
  ) => {
    const novos = montar(novoId);
    const resultado = modo === "substituir" ? novos : [...blocos, ...novos];
    if (resultado.length > maximo) {
      toast.error(t("A página passaria do limite de blocos."));
      return;
    }
    aoMudar(resultado);
    limpar();
    setEditandoId(null);
    setDigitandoId(null);
    setMenu(null);
    toast.success(t("Modelo aplicado. Ctrl+Z desfaz."));
  };

  const abrirMenu = useCallback(
    (x: number, y: number, blocoId: string) => {
      if (!selecionados.has(blocoId)) selecionarUnico(blocoId);
      setMenu({ tipo: "bloco", x, y, blocoId });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depende só da seleção atual
    [sel],
  );
  const fecharMenu = useCallback(() => setMenu(null), []);

  const canvasAberto = (() => {
    const b = canvasId ? blocos.find((x) => x.id === canvasId) : undefined;
    return b?.tipo === "canvas" ? b : null;
  })();
  const escolherComando = (alvo: AlvoDeConversao) => {
    if (menu?.tipo !== "comandos") return;
    const b = blocos.find((x) => x.id === menu.blocoId);
    setMenu(null);
    if (!b) return;
    const novo = converterBloco(b, alvo);
    aoMudar(blocos.map((x) => (x.id === b.id ? novo : x)));
    selecionarUnico(b.id);
    comecarNo(novo);
  };
  const fecharComandos = () => {
    const id = menu?.tipo === "comandos" ? menu.blocoId : null;
    setMenu(null);
    if (id) digitarNoBloco(id);
  };

  const primario = menu?.tipo === "bloco" ? blocos.find((b) => b.id === menu.blocoId) : undefined;
  const propriedades = primario ? propriedadesDoBloco(primario) : [];
  const nome = (a: AlvoDeConversao) => t(a.rotulo);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {t(
            "Clique para selecionar · dois cliques para digitar no bloco · / escolhe o bloco · Enter cria o próximo · botão direito para tipo e ajustes · Ctrl+Z desfaz",
          )}
        </p>
        <div className="flex items-center gap-2">
          {digitando ? (
            <div role="toolbar" aria-label={t("Estilo do texto")} className="flex gap-1">
              {(
                [
                  ["**", "B", t("Negrito (Ctrl+B)"), "font-bold"],
                  ["*", "I", t("Itálico (Ctrl+I)"), "italic"],
                ] as [MarcaDeEstilo, string, string, string][]
              ).map(([marca, letra, rotulo, classe]) => (
                <button
                  key={marca}
                  type="button"
                  aria-label={rotulo}
                  title={rotulo}
                  // Não tira o foco do texto: a marca vai na seleção que já está lá.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const campo = document.activeElement;
                    if (campo instanceof HTMLTextAreaElement && campo.dataset.campoNoLugar) {
                      aplicarMarcaNoCampo(campo, marca);
                    }
                  }}
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-lg border text-sm hover:bg-secondary",
                    classe,
                  )}
                >
                  {letra}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            aria-haspopup="menu"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setConfirmarModelo(null);
              setMenu({ tipo: "modelos", x: r.right - 288, y: r.bottom + 4 });
            }}
            className="inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium hover:bg-secondary"
          >
            {t("Modelos")}
          </button>
        </div>
      </div>

      <div
        ref={raiz}
        role="group"
        aria-label={t("Blocos da página")}
        tabIndex={-1}
        onKeyDown={aoTeclar}
        onCopy={(e) => aoCopiar(e, false)}
        onCut={(e) => aoCopiar(e, true)}
        onPaste={aoColar}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) limpar();
        }}
        className={cn("flex flex-col gap-1 outline-hidden", arrastandoMouse && "select-none")}
      >
        <DndContext
          id="editor-visual-de-blocos"
          sensors={sensores}
          collisionDetection={closestCenter}
          modifiers={[({ transform }) => ({ ...transform, x: 0 })]}
          onDragEnd={aoSoltar}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {agruparPorLinha(blocos).map((grupo) => {
              const linhaDeBlocos = grupo.length > 1;
              const itens = grupo.map((b) => {
                const i = ids.indexOf(b.id);
                return (
                  <LinhaVisual
                    key={b.id}
                    emColuna={linhaDeBlocos}
                    bloco={b}
                    posicao={i + 1}
                    selecionado={selecionados.has(b.id)}
                    editando={editando === b.id}
                    rotulos={rotulos}
                    rotuloDoTipo={nomeDoTipo(b.tipo)}
                    aoPressionar={aoPressionar}
                    aoEditar={(id, x, y) => {
                      selecionarUnico(id);
                      const bloco = blocos.find((x2) => x2.id === id);
                      if (bloco && temCamposNoLugar(bloco)) digitarNoBloco(id, x, y);
                      else if (bloco?.tipo === "canvas") setCanvasId(id);
                      else abrirCaixa(id);
                    }}
                    aoEditarTudo={abrirCaixa}
                    aoSairDoTexto={() => {
                      // A busca de blocos ("/") tira o foco do texto sem encerrar a digitação.
                      if (!document.querySelector("[data-menu-comandos]")) setDigitandoId(null);
                    }}
                    edicao={edicao}
                    digitando={digitando === b.id}
                    aoAbrirMenu={abrirMenu}
                    aoInserir={(x, y, id) => setMenu({ tipo: "inserir", x, y, depoisDe: id })}
                    painel={
                      editando === b.id ? (
                        <div className="mt-2 rounded-2xl border-2 border-primary/40 bg-card p-4 shadow-sm">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "rounded-md px-2.5 py-0.5 text-xs font-semibold",
                                (COR_DO_TIPO[b.tipo] ?? COR_DO_TIPO.texto!).etiqueta,
                              )}
                            >
                              {nomeDoTipo(b.tipo)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditandoId(null);
                                focarRaiz();
                              }}
                              className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-[var(--color-accent-hover)]"
                            >
                              {t("Concluir")}
                            </button>
                          </div>
                          <FormularioDoBloco
                            bloco={b}
                            aoMudar={(novo) =>
                              aoMudar(
                                blocos.map((x) => (x.id === b.id ? novo : x)),
                                b.id,
                              )
                            }
                            tituloDaPagina={tituloDaPagina}
                            chaveDaPagina={chaveDaPagina}
                          />
                        </div>
                      ) : null
                    }
                  />
                );
              });
              return linhaDeBlocos ? (
                <div
                  key={grupo[0]!.id}
                  style={{ "--colunas": grupo.length } as CSSProperties}
                  className="grid items-start gap-2 sm:[grid-template-columns:repeat(var(--colunas),minmax(0,1fr))]"
                >
                  {itens}
                </div>
              ) : (
                itens
              );
            })}
          </SortableContext>
        </DndContext>
        <div
          role="button"
          tabIndex={0}
          aria-label={t("Escrever no fim da página")}
          onClick={escreverNoFim}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              escreverNoFim();
            }
          }}
          className={cn(
            "cursor-text rounded-2xl outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
            blocos.length === 0
              ? "grid min-h-40 place-items-center border-2 border-dashed p-4 text-center text-sm text-muted-foreground"
              : "min-h-20 flex-1",
          )}
        >
          {blocos.length === 0
            ? t("Clique aqui e comece a escrever · / escolhe o bloco · Enter cria o próximo")
            : null}
        </div>
      </div>

      {canvasAberto ? (
        <EditorDeCanvas
          bloco={canvasAberto}
          aoMudar={(novo, chave) =>
            aoMudar(
              blocos.map((x) => (x.id === novo.id ? novo : x)),
              chave,
            )
          }
          aoFechar={() => {
            setCanvasId(null);
            focarRaiz();
          }}
        />
      ) : null}

      <button
        type="button"
        aria-haspopup="menu"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setMenu({ tipo: "inserir", x: r.left, y: r.bottom + 4, depoisDe: null });
        }}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary/10"
      >
        <Plus size={16} weight="bold" aria-hidden />
        {t("Adicionar bloco")}
      </button>

      <ImportarDeTexto blocos={blocos} aoMudar={aoMudar} novoId={novoId} />

      {menu ? (
        <MenuFlutuante
          x={menu.x}
          y={menu.y}
          aoFechar={menu.tipo === "comandos" ? fecharComandos : fecharMenu}
        >
          {menu.tipo === "comandos" ? (
            <MenuDeComandos
              alvos={TODOS_OS_ALVOS}
              aoEscolher={escolherComando}
              aoFechar={fecharComandos}
            />
          ) : menu.tipo === "modelos" ? (
            <>
              <LinhaDeModelo
                rotulo={t("Página em branco")}
                descricao={t("Apaga todos os blocos")}
                confirmando={confirmarModelo === "em-branco"}
                vazia={blocos.length === 0}
                semAdicionar
                aoAdicionar={() => undefined}
                aoSubstituir={() => {
                  if (blocos.length === 0 || confirmarModelo === "em-branco")
                    aplicarModelo("substituir", () => []);
                  else setConfirmarModelo("em-branco");
                }}
              />
              {modeloDaPagina(chaveDaPagina ?? "")
                ? (() => {
                    const m = modeloDaPagina(chaveDaPagina ?? "")!;
                    return (
                      <LinhaDeModelo
                        key={m.chave}
                        rotulo={t(m.rotulo)}
                        descricao={t(m.descricao)}
                        confirmando={confirmarModelo === m.chave}
                        vazia={blocos.length === 0}
                        aoAdicionar={() => aplicarModelo("adicionar", m.montar)}
                        aoSubstituir={() => {
                          if (blocos.length === 0 || confirmarModelo === m.chave)
                            aplicarModelo("substituir", m.montar);
                          else setConfirmarModelo(m.chave);
                        }}
                      />
                    );
                  })()
                : null}
            </>
          ) : menu.tipo === "inserir" ? (
            <>
              <CabecalhoDoMenu>{t("Inserir bloco")}</CabecalhoDoMenu>
              {ALVOS_BASICOS.map((a) => (
                <ItemDoMenu
                  key={a.rotulo}
                  glifo={a.glifo}
                  dica={atalhoDoAlvo(a)?.rotulo}
                  onClick={() => {
                    setMenu(null);
                    inserir(a, menu.depoisDe);
                  }}
                >
                  {nome(a)}
                </ItemDoMenu>
              ))}
              <CabecalhoDoMenu>{t("Blocos visuais")}</CabecalhoDoMenu>
              {ALVOS_VISUAIS.map((a) => (
                <ItemDoMenu
                  key={a.rotulo}
                  glifo={a.glifo}
                  dica={atalhoDoAlvo(a)?.rotulo}
                  onClick={() => {
                    setMenu(null);
                    inserir(a, menu.depoisDe);
                  }}
                >
                  {nome(a)}
                </ItemDoMenu>
              ))}
            </>
          ) : (
            <>
              <CabecalhoDoMenu>
                {selecionados.size > 1
                  ? `${selecionados.size} ${t("blocos selecionados")}`
                  : primario
                    ? nomeDoTipo(primario.tipo)
                    : ""}
              </CabecalhoDoMenu>
              {primario
                ? propriedades.map((p) => (
                    <div key={p.campo} className="px-2 pb-1.5">
                      <p className="mb-1 text-xs text-muted-foreground">{t(p.rotulo)}</p>
                      <div className="flex flex-wrap gap-1">
                        {p.opcoes.map((o) => (
                          <button
                            key={String(o.valor)}
                            type="button"
                            aria-pressed={p.atual === o.valor}
                            onClick={() => ajustar(primario, p.campo, o.valor)}
                            className={cn(
                              "rounded-lg border px-2.5 py-1 text-xs hover:bg-secondary",
                              p.atual === o.valor &&
                                "border-primary bg-accent-soft font-medium text-primary",
                            )}
                          >
                            {t(o.rotulo)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                : null}
              <div className="my-1 border-t" />
              {selecionados.size === 1 && primario ? (
                <ItemDoMenu
                  glifo={<PencilSimple size={14} aria-hidden />}
                  onClick={() => {
                    setMenu(null);
                    abrirCaixa(primario.id);
                  }}
                >
                  {t("Editar todos os campos")}
                </ItemDoMenu>
              ) : null}
              {selecionados.size > 1 ||
              (selecionados.size === 1 && ids.indexOf([...selecionados][0]!) > 0) ? (
                <ItemDoMenu
                  glifo="▥"
                  onClick={() => {
                    setMenu(null);
                    juntarLado();
                  }}
                >
                  {selecionados.size > 1
                    ? t("Colocar lado a lado")
                    : t("Colocar ao lado do bloco de cima")}
                </ItemDoMenu>
              ) : null}
              {blocos.some((b) => selecionados.has(b.id) && b.linha) ? (
                <ItemDoMenu
                  glifo="▭"
                  onClick={() => {
                    setMenu(null);
                    separarLado();
                  }}
                >
                  {t("Separar (largura toda)")}
                </ItemDoMenu>
              ) : null}
              <ItemDoMenu
                glifo={<Copy size={14} aria-hidden />}
                dica="Ctrl+D"
                onClick={() => {
                  setMenu(null);
                  duplicar();
                }}
              >
                {t("Duplicar")}
              </ItemDoMenu>
              <ItemDoMenu
                destrutivo
                glifo={<Trash size={14} aria-hidden />}
                dica="Del"
                onClick={() => {
                  setMenu(null);
                  apagar();
                }}
              >
                {t("Apagar")}
              </ItemDoMenu>
              <div className="my-1 border-t" />
              <CabecalhoDoMenu>{t("Transformar em")}</CabecalhoDoMenu>
              {ALVOS_BASICOS.map((a) => (
                <ItemDoMenu
                  key={a.rotulo}
                  glifo={a.glifo}
                  ativo={primario ? ehOAlvo(primario, a) : false}
                  dica={atalhoDoAlvo(a)?.rotulo}
                  onClick={() => {
                    setMenu(null);
                    converter(a);
                  }}
                >
                  {nome(a)}
                </ItemDoMenu>
              ))}
              <CabecalhoDoMenu>{t("Blocos visuais")}</CabecalhoDoMenu>
              {ALVOS_VISUAIS.map((a) => (
                <ItemDoMenu
                  key={a.rotulo}
                  glifo={a.glifo}
                  ativo={primario ? ehOAlvo(primario, a) : false}
                  dica={atalhoDoAlvo(a)?.rotulo}
                  onClick={() => {
                    setMenu(null);
                    converter(a);
                  }}
                >
                  {nome(a)}
                </ItemDoMenu>
              ))}
            </>
          )}
        </MenuFlutuante>
      ) : null}
    </div>
  );
}
