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
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import {
  ATALHO_DO_TIPO,
  novoBloco,
  novoId,
  TIPOS_DE_BLOCO,
  type Bloco,
  type TipoDeBloco,
} from "@/lib/tarefas/blocos";
import { CaretRight, Copy, DotsSixVertical, Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const ROTULO_DO_TIPO: Record<TipoDeBloco, string> = {
  texto: "Texto",
  h1: "Título 1",
  h2: "Título 2",
  h3: "Título 3",
  todo: "Lista de tarefas",
  bullet: "Lista com marcadores",
  numero: "Lista numerada",
  toggle: "Lista recolhível",
  quote: "Citação",
  callout: "Destaque",
};

const GLIFO_DO_TIPO: Record<TipoDeBloco, string> = {
  texto: "Aa",
  h1: "H1",
  h2: "H2",
  h3: "H3",
  todo: "☑",
  bullet: "•",
  numero: "1.",
  toggle: "▸",
  quote: "❝",
  callout: "💡",
};

const ESTILO_DO_TEXTO: Record<TipoDeBloco, string> = {
  texto: "text-sm leading-6",
  h1: "text-2xl font-bold leading-9",
  h2: "text-xl font-semibold leading-8",
  h3: "text-lg font-semibold leading-7",
  todo: "text-sm leading-6",
  bullet: "text-sm leading-6",
  numero: "text-sm leading-6",
  toggle: "text-sm font-medium leading-6",
  quote: "text-sm italic leading-6",
  callout: "text-sm leading-6",
};

/** Quantos níveis de "afilhados" cabem (o leitor em `lerBlocos` aceita o mesmo). */
const LIMITE_DE_NIVEIS = 5;

const CONTINUAM_NA_LISTA: TipoDeBloco[] = ["todo", "bullet", "numero"];
const SAEM_DO_TIPO_AO_FICAR_VAZIOS: TipoDeBloco[] = [
  "todo",
  "bullet",
  "numero",
  "quote",
  "callout",
];

/** "# ", "- ", "1. "… no começo de um bloco de texto viram o tipo, como no Notion. */
const ATALHOS_DE_MARKDOWN: { regra: RegExp; tipo: TipoDeBloco }[] = [
  { regra: /^### /, tipo: "h3" },
  { regra: /^## /, tipo: "h2" },
  { regra: /^# /, tipo: "h1" },
  { regra: /^\[ ?\] /, tipo: "todo" },
  { regra: /^[-*] /, tipo: "bullet" },
  { regra: /^\d+\. /, tipo: "numero" },
  { regra: /^> /, tipo: "toggle" },
  { regra: /^" /, tipo: "quote" },
];

interface Contexto {
  prefixo: string;
  podeEditar: boolean;
  pedirFoco: (id: string, posicao: number | "fim") => void;
  vizinho: (id: string, direcao: -1 | 1) => void;
}

// ── operações puras sobre uma lista ──────────────────────────────────────────
const trocar = (lista: Bloco[], id: string, mudanca: Partial<Bloco>) =>
  lista.map((b) => (b.id === id ? { ...b, ...mudanca } : b));

function duplicar(b: Bloco): Bloco {
  return { ...b, id: novoId(), filhos: b.filhos?.map(duplicar) };
}

function AreaDeTexto({
  valor,
  aoMudar,
  aoTeclar,
  id,
  className,
  placeholder,
  somenteLeitura,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  aoTeclar: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  id: string;
  className: string;
  placeholder: string;
  somenteLeitura: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  // Cresce com o texto: sem barra de rolagem por bloco.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [valor]);
  return (
    <textarea
      ref={ref}
      id={id}
      data-bloco
      rows={1}
      value={valor}
      readOnly={somenteLeitura}
      placeholder={placeholder}
      onChange={(e) => aoMudar(e.target.value)}
      onKeyDown={aoTeclar}
      className={cn(
        "block min-w-0 flex-1 resize-none overflow-hidden bg-transparent outline-hidden placeholder:text-text-subtle",
        className,
      )}
    />
  );
}

function LinhaDoBloco({
  bloco,
  indice,
  numero,
  lista,
  aoMudarLista,
  ctx,
  nivel,
  unico,
  aoDesindentar,
}: {
  bloco: Bloco;
  indice: number;
  numero: number;
  lista: Bloco[];
  aoMudarLista: (nova: Bloco[]) => void;
  ctx: Contexto;
  nivel: number;
  unico: boolean;
  /** Tira o bloco de dentro do pai e o põe logo depois dele (Shift+Tab). Ausente no 1º nível. */
  aoDesindentar?: (id: string) => void;
}) {
  const t = useT();
  const [menuAberto, setMenuAberto] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bloco.id, disabled: !ctx.podeEditar });

  const atualizar = (mudanca: Partial<Bloco>) => aoMudarLista(trocar(lista, bloco.id, mudanca));

  const trocarTipo = (tipo: TipoDeBloco) => {
    atualizar({ tipo, ...(tipo === "toggle" ? { aberto: true } : {}) });
    ctx.pedirFoco(bloco.id, "fim");
  };

  const aoDigitar = (valor: string) => {
    if (bloco.tipo === "texto") {
      const atalho = ATALHOS_DE_MARKDOWN.find((a) => a.regra.test(valor));
      if (atalho) {
        atualizar({
          tipo: atalho.tipo,
          texto: valor.replace(atalho.regra, ""),
          ...(atalho.tipo === "toggle" ? { aberto: true } : {}),
        });
        ctx.pedirFoco(bloco.id, 0);
        return;
      }
    }
    atualizar({ texto: valor });
  };

  const aoTeclar = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!ctx.podeEditar) return;
    const campo = e.currentTarget;
    const inicio = campo.selectionStart;
    const fim = campo.selectionEnd;

    // Ctrl+Shift+0…9: troca o tipo do bloco (usa `code`: com Shift, `key` vira símbolo).
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && /^Digit\d$/.test(e.code)) {
      const digito = e.code.slice(5);
      const tipo = TIPOS_DE_BLOCO.find((x) => ATALHO_DO_TIPO[x] === digito);
      if (tipo) {
        e.preventDefault();
        trocarTipo(tipo);
      }
      return;
    }

    // Tab "afilha" o bloco ao irmão de cima; Shift+Tab o devolve ao nível do pai.
    if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (e.shiftKey) {
        aoDesindentar?.(bloco.id);
        return;
      }
      const anterior = lista[indice - 1];
      if (!anterior || nivel >= LIMITE_DE_NIVEIS) return;
      const copia = lista.filter((b) => b.id !== bloco.id);
      copia[indice - 1] = {
        ...anterior,
        ...(anterior.tipo === "toggle" ? { aberto: true } : {}),
        filhos: [...(anterior.filhos ?? []), bloco],
      };
      aoMudarLista(copia);
      ctx.pedirFoco(bloco.id, inicio);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!bloco.texto && SAEM_DO_TIPO_AO_FICAR_VAZIOS.includes(bloco.tipo)) {
        if (aoDesindentar) aoDesindentar(bloco.id);
        else atualizar({ tipo: "texto" });
        return;
      }
      const antes = bloco.texto.slice(0, inicio);
      const depois = bloco.texto.slice(fim);
      if (bloco.tipo === "toggle" && bloco.aberto) {
        const filho = novoBloco("texto", depois);
        aoMudarLista(
          trocar(lista, bloco.id, { texto: antes, filhos: [filho, ...(bloco.filhos ?? [])] }),
        );
        ctx.pedirFoco(filho.id, 0);
        return;
      }
      const tipoNovo: TipoDeBloco = CONTINUAM_NA_LISTA.includes(bloco.tipo) ? bloco.tipo : "texto";
      const novo = novoBloco(tipoNovo, depois);
      const copia = trocar(lista, bloco.id, { texto: antes });
      copia.splice(indice + 1, 0, novo);
      aoMudarLista(copia);
      ctx.pedirFoco(novo.id, 0);
      return;
    }

    if (e.key === "Backspace" && inicio === 0 && fim === 0) {
      if (bloco.tipo !== "texto") {
        e.preventDefault();
        atualizar({ tipo: "texto" });
        return;
      }
      if (aoDesindentar && indice === 0) {
        e.preventDefault();
        aoDesindentar(bloco.id);
        return;
      }
      const anterior = lista[indice - 1];
      if (anterior) {
        e.preventDefault();
        const junta = trocar(lista, anterior.id, { texto: anterior.texto + bloco.texto });
        junta.splice(indice, 1);
        aoMudarLista(junta);
        ctx.pedirFoco(anterior.id, anterior.texto.length);
      }
      return;
    }

    if (e.key === "ArrowUp" && !bloco.texto.slice(0, inicio).includes("\n") && inicio === fim) {
      e.preventDefault();
      ctx.vizinho(bloco.id, -1);
    }
    if (e.key === "ArrowDown" && !bloco.texto.slice(fim).includes("\n") && inicio === fim) {
      e.preventDefault();
      ctx.vizinho(bloco.id, 1);
    }
  };

  const idDoCampo = `${ctx.prefixo}-${bloco.id}`;
  const campo = (
    <AreaDeTexto
      id={idDoCampo}
      valor={bloco.texto}
      aoMudar={aoDigitar}
      aoTeclar={aoTeclar}
      somenteLeitura={!ctx.podeEditar}
      placeholder={
        bloco.tipo === "texto"
          ? unico
            ? t("Escreva uma descrição… (Ctrl+Shift+1 a 9 muda o tipo do bloco)")
            : ""
          : t(ROTULO_DO_TIPO[bloco.tipo])
      }
      className={cn(
        ESTILO_DO_TEXTO[bloco.tipo],
        bloco.tipo === "texto" && !unico && "placeholder:opacity-0 focus:placeholder:opacity-100",
        bloco.tipo === "todo" && bloco.marcado && "text-muted-foreground line-through",
      )}
    />
  );

  const marcador =
    bloco.tipo === "todo" ? (
      <button
        type="button"
        role="checkbox"
        aria-checked={Boolean(bloco.marcado)}
        aria-label={t("Marcar como feito")}
        disabled={!ctx.podeEditar}
        onClick={() => atualizar({ marcado: !bloco.marcado })}
        className={cn(
          "mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border-2 text-[10px] leading-none transition-colors",
          bloco.marcado
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border-strong hover:border-primary",
        )}
      >
        {bloco.marcado ? "✓" : null}
      </button>
    ) : bloco.tipo === "bullet" ? (
      <span aria-hidden className="w-4 shrink-0 text-center leading-6">
        •
      </span>
    ) : bloco.tipo === "numero" ? (
      <span aria-hidden className="w-5 shrink-0 text-right text-sm leading-6 tabular-nums">
        {numero}.
      </span>
    ) : bloco.tipo === "toggle" ? (
      <button
        type="button"
        aria-label={bloco.aberto ? t("Recolher") : t("Expandir")}
        aria-expanded={Boolean(bloco.aberto)}
        onClick={() => atualizar({ aberto: !bloco.aberto })}
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
      >
        <CaretRight
          size={12}
          weight="bold"
          className={cn("transition-transform", bloco.aberto && "rotate-90")}
          aria-hidden
        />
      </button>
    ) : bloco.tipo === "callout" ? (
      <span aria-hidden className="text-base leading-6">
        💡
      </span>
    ) : null;

  const filhos = bloco.filhos ?? [];

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 opacity-70")}
    >
      <div
        className={cn(
          "group flex items-start gap-1 rounded-lg",
          (menuAberto || isDragging) && "bg-accent-soft/60",
        )}
      >
        {ctx.podeEditar ? (
          <Popover open={menuAberto} onOpenChange={setMenuAberto}>
            <PopoverTrigger asChild>
              <button
                ref={setActivatorNodeRef}
                type="button"
                {...attributes}
                {...listeners}
                aria-label={t("Arrastar ou abrir o menu do bloco")}
                title={t("Arraste para mover · clique para o menu")}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenuAberto(true);
                }}
                className="mt-0.5 grid h-6 w-5 shrink-0 cursor-grab touch-none place-items-center rounded-md text-text-subtle opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-secondary focus-visible:opacity-100 data-[state=open]:opacity-100"
              >
                <DotsSixVertical size={16} weight="bold" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60 p-1.5">
              <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wider text-text-subtle uppercase">
                {t("Transformar em")}
              </p>
              <div className="max-h-72 overflow-y-auto">
                {TIPOS_DE_BLOCO.map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => {
                      setMenuAberto(false);
                      trocarTipo(tipo);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary",
                      bloco.tipo === tipo && "bg-accent-soft font-medium text-primary",
                    )}
                  >
                    <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground">
                      {GLIFO_DO_TIPO[tipo]}
                    </span>
                    <span className="flex-1 truncate">{t(ROTULO_DO_TIPO[tipo])}</span>
                    <span className="shrink-0 text-[10px] text-text-subtle">
                      Ctrl+⇧+{ATALHO_DO_TIPO[tipo]}
                    </span>
                  </button>
                ))}
              </div>
              <div className="my-1 border-t" />
              <button
                type="button"
                onClick={() => {
                  setMenuAberto(false);
                  const copia = [...lista];
                  const nova = duplicar(bloco);
                  copia.splice(indice + 1, 0, nova);
                  aoMudarLista(copia);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
              >
                <Copy size={14} className="mx-1 text-muted-foreground" aria-hidden />
                {t("Duplicar")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuAberto(false);
                  const restante = lista.filter((b) => b.id !== bloco.id);
                  aoMudarLista(restante.length || nivel > 0 ? restante : [novoBloco()]);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-error-fg hover:bg-error-bg"
              >
                <Trash size={14} className="mx-1" aria-hidden />
                {t("Apagar")}
              </button>
            </PopoverContent>
          </Popover>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        <div
          className={cn(
            "flex min-w-0 flex-1 items-start gap-1.5",
            bloco.tipo === "quote" && "border-l-[3px] border-foreground/70 pl-3",
            bloco.tipo === "callout" && "rounded-xl bg-secondary px-3 py-2",
          )}
        >
          {marcador}
          {campo}
        </div>
      </div>

      {(bloco.tipo === "toggle" ? bloco.aberto : filhos.length > 0) ? (
        <div className="ml-6 pl-1">
          {filhos.length ? (
            <ListaDeBlocos
              blocos={filhos}
              aoMudar={(nova) => atualizar({ filhos: nova })}
              ctx={ctx}
              nivel={nivel + 1}
              aoDesindentar={(filhoId) => {
                const filho = filhos.find((f) => f.id === filhoId);
                if (!filho) return;
                const restantes = filhos.filter((f) => f.id !== filhoId);
                const copia = [...lista];
                copia[indice] = { ...bloco, filhos: restantes.length ? restantes : undefined };
                copia.splice(indice + 1, 0, filho);
                aoMudarLista(copia);
                ctx.pedirFoco(filho.id, "fim");
              }}
            />
          ) : ctx.podeEditar && bloco.tipo === "toggle" ? (
            <button
              type="button"
              onClick={() => {
                const filho = novoBloco();
                atualizar({ filhos: [filho] });
                ctx.pedirFoco(filho.id, 0);
              }}
              className="ml-5 rounded-md px-1.5 py-0.5 text-sm text-text-subtle hover:bg-secondary"
            >
              {t("Vazio. Clique para adicionar um bloco aqui dentro")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ListaDeBlocos({
  blocos,
  aoMudar,
  ctx,
  nivel,
  aoDesindentar,
}: {
  blocos: Bloco[];
  aoMudar: (nova: Bloco[]) => void;
  ctx: Contexto;
  nivel: number;
  aoDesindentar?: (id: string) => void;
}) {
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const id = useId();

  const aoSoltar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const de = blocos.findIndex((b) => b.id === e.active.id);
    const para = blocos.findIndex((b) => b.id === e.over!.id);
    if (de >= 0 && para >= 0) aoMudar(arrayMove(blocos, de, para));
  };

  // O número de cada item numerado: conta os vizinhos numerados logo acima.
  const numeros = blocos.map((b, i) => {
    let n = 0;
    for (let j = i; j >= 0 && blocos[j]!.tipo === "numero"; j--) n++;
    return b.tipo === "numero" ? n : 0;
  });
  return (
    <DndContext
      id={id}
      sensors={sensores}
      collisionDetection={closestCenter}
      modifiers={[({ transform }) => ({ ...transform, x: 0 })]}
      onDragEnd={aoSoltar}
    >
      <SortableContext items={blocos.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-0.5">
          {blocos.map((b, i) => {
            return (
              <LinhaDoBloco
                key={b.id}
                bloco={b}
                indice={i}
                numero={numeros[i]!}
                lista={blocos}
                aoMudarLista={aoMudar}
                ctx={ctx}
                nivel={nivel}
                aoDesindentar={aoDesindentar}
                unico={nivel === 0 && blocos.length === 1}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface Props {
  blocos: Bloco[];
  aoMudar: (blocos: Bloco[]) => void;
  podeEditar: boolean;
}

/**
 * O EDITOR DE BLOCOS — a descrição no jeito do Notion: cada linha é um bloco (texto, títulos,
 * listas, to-do, toggle, citação, destaque), com a alça de seis pontos para arrastar, o menu
 * "Transformar em" (clique ou botão direito na alça), atalhos Ctrl+Shift+0…9 e markdown no
 * começo da linha (`# `, `- `, `1. `, `[] `…).
 *
 * Sem biblioteca de editor: cada bloco é uma área de texto simples, então o cursor, o colar e a
 * seleção são os do navegador. O texto não tem negrito/itálico por dentro do bloco.
 */
export function EditorDeBlocos({ blocos, aoMudar, podeEditar }: Props) {
  const t = useT();
  const prefixo = `eb${useId().replace(/[^a-z0-9]/gi, "")}`;
  const raiz = useRef<HTMLDivElement | null>(null);
  const foco = useRef<{ id: string; posicao: number | "fim" } | null>(null);

  const pedirFoco = useCallback((id: string, posicao: number | "fim") => {
    foco.current = { id, posicao };
  }, []);

  // Depois de cada desenho, entrega o cursor ao bloco que o pediu (um bloco novo, por exemplo).
  useEffect(() => {
    const pedido = foco.current;
    if (!pedido) return;
    foco.current = null;
    const el = document.getElementById(`${prefixo}-${pedido.id}`) as HTMLTextAreaElement | null;
    if (!el) return;
    el.focus();
    const p =
      pedido.posicao === "fim" ? el.value.length : Math.min(pedido.posicao, el.value.length);
    el.setSelectionRange(p, p);
  });

  const vizinho = useCallback(
    (id: string, direcao: -1 | 1) => {
      const campos = Array.from(
        raiz.current?.querySelectorAll<HTMLTextAreaElement>("textarea[data-bloco]") ?? [],
      );
      const i = campos.findIndex((c) => c.id === `${prefixo}-${id}`);
      const alvo = campos[i + direcao];
      if (!alvo) return;
      alvo.focus();
      const p = direcao === -1 ? alvo.value.length : 0;
      alvo.setSelectionRange(p, p);
    },
    [prefixo],
  );

  const ctx: Contexto = { prefixo, podeEditar, pedirFoco, vizinho };

  const ultimo = blocos[blocos.length - 1];
  const aoClicarNoFim = () => {
    if (!podeEditar || !ultimo) return;
    if (ultimo.tipo === "texto" && !ultimo.texto && !ultimo.filhos?.length) {
      pedirFoco(ultimo.id, 0);
      // força o efeito de foco mesmo sem mudança de estado
      document.getElementById(`${prefixo}-${ultimo.id}`)?.focus();
      return;
    }
    const novo = novoBloco();
    pedirFoco(novo.id, 0);
    aoMudar([...blocos, novo]);
  };

  return (
    <div ref={raiz} role="group" aria-label={t("Descrição")} className="min-w-0">
      <ListaDeBlocos blocos={blocos} aoMudar={aoMudar} ctx={ctx} nivel={0} />
      {podeEditar ? (
        <div aria-hidden onClick={aoClicarNoFim} className="min-h-8 flex-1 cursor-text" />
      ) : null}
    </div>
  );
}
