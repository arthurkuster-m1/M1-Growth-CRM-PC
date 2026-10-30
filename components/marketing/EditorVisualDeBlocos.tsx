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
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { BlocosRender, type RotulosDosBlocos } from "@/components/marketing/BlocosRender";
import type { EdicaoNoLugar } from "@/components/marketing/CampoNoLugar";
import {
  COR_DO_TIPO,
  FormularioDoBloco,
  resumoDoBloco,
  useNomesDosTipos,
} from "@/components/marketing/EditorDeBlocos";
import { useHistoricoDeEdicao } from "@/hooks/editor/useHistoricoDeEdicao";
import { toast } from "sonner";

import { useT } from "@/hooks/i18n/useT";
import { blocoEmBranco, lerBlocos, MAXIMO_DE_BLOCOS, type Bloco } from "@/lib/marketing/blocos";
import {
  alvoDoAtalho,
  ALVOS_BASICOS,
  ALVOS_VISUAIS,
  aplicarPropriedade,
  converterBloco,
  duplicarBlocos,
  ehOAlvo,
  moverBlocos,
  propriedadesDoBloco,
  removerBlocos,
  textoDoBloco,
  type AlvoDeConversao,
} from "@/lib/marketing/edicao-de-blocos";
import { modeloDaPagina } from "@/lib/marketing/modelos";
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
  if (b.tipo === "oferta" || b.tipo === "calculadora" || b.tipo === "separador") return false;
  if (b.tipo === "imagem") return b.arquivo !== "";
  return true;
}

type Menu =
  | { tipo: "bloco"; x: number; y: number; blocoId: string }
  | { tipo: "inserir"; x: number; y: number; depoisDe: string | null }
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
]);

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
}: {
  bloco: Bloco;
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
            "flex w-5 shrink-0 items-center justify-end gap-0.5 pt-3 transition-opacity sm:w-12",
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
            className="hidden h-6 w-6 place-items-center rounded-md text-text-subtle hover:bg-secondary sm:grid"
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
  const historico = useHistoricoDeEdicao(blocos, aoMudarDeFora);
  const aoMudar = (novos: Bloco[], chave?: string) => historico.mudar(novos, chave);
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
  };

  const focarRaiz = () => raiz.current?.focus({ preventScroll: true });
  /** Põe o bloco para digitar direto: o cursor vai ao texto sob o clique (ou ao primeiro). */
  const digitarNoBloco = (id: string, x?: number, y?: number) => {
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
      const alvo = sob ?? campos[0];
      alvo?.focus();
      alvo?.setSelectionRange(alvo.value.length, alvo.value.length);
    });
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
    if (!selecionados.size || blocos.length + selecionados.size > MAXIMO_DE_BLOCOS) return;
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
    if (blocos.length >= MAXIMO_DE_BLOCOS) return;
    const novo = converterBloco(blocoEmBranco(alvo.tipo, novoId()), alvo);
    const i = depoisDe ? ids.indexOf(depoisDe) : -1;
    const copia = [...blocos];
    copia.splice(i < 0 ? copia.length : i + 1, 0, novo);
    aoMudar(copia);
    selecionarUnico(novo.id);
    if (temCamposNoLugar(novo)) digitarNoBloco(novo.id);
    else if (novo.tipo !== "separador") abrirCaixa(novo.id);
  };
  const colar = (novos: Bloco[]) => {
    if (!novos.length || blocos.length + novos.length > MAXIMO_DE_BLOCOS) return;
    const copias = novos.map((b) => ({ ...structuredClone(b), id: novoId() }));
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
    if (mod && e.shiftKey && /^Digit\d$/.test(e.code)) {
      const alvo = alvoDoAtalho(e.code.slice(5));
      if (alvo) {
        e.preventDefault();
        converter(alvo);
      }
    }
  };

  const aoCopiar = (e: ClipboardEvent<HTMLDivElement>, cortar: boolean) => {
    if (ehCampoDeTexto(e.target) || !selecionados.size) return;
    const escolhidos = blocos.filter((b) => selecionados.has(b.id));
    const texto = escolhidos.map((b) => textoDoBloco(b) || nomeDoTipo(b.tipo)).join("\n\n");
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
    }
  };

  const aplicarModelo = (
    modo: "adicionar" | "substituir",
    montar: (n: () => string) => Bloco[],
  ) => {
    const novos = montar(novoId);
    const resultado = modo === "substituir" ? novos : [...blocos, ...novos];
    if (resultado.length > MAXIMO_DE_BLOCOS) {
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

  const primario = menu?.tipo === "bloco" ? blocos.find((b) => b.id === menu.blocoId) : undefined;
  const propriedades = primario ? propriedadesDoBloco(primario) : [];
  const nome = (a: AlvoDeConversao) => t(a.rotulo);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {t(
            "Clique para selecionar · dois cliques para digitar no bloco · botão direito para tipo e ajustes · Ctrl+Z desfaz",
          )}
        </p>
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
            {blocos.map((b, i) => (
              <LinhaVisual
                key={b.id}
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
                  else abrirCaixa(id);
                }}
                aoEditarTudo={abrirCaixa}
                aoSairDoTexto={() => setDigitandoId(null)}
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
            ))}
          </SortableContext>
        </DndContext>
      </div>

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

      {menu ? (
        <MenuFlutuante x={menu.x} y={menu.y} aoFechar={fecharMenu}>
          {menu.tipo === "modelos" ? (
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
                  dica={a.atalho ? `Ctrl+⇧+${a.atalho}` : undefined}
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
                  dica={a.atalho ? `Ctrl+⇧+${a.atalho}` : undefined}
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
