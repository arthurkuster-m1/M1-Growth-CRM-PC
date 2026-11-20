"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { useT } from "@/hooks/i18n/useT";
import { DotsSixVertical } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * As peças visuais do app de Anotações da Família Kuster, uma a uma (botão, "Tabela | Cards",
 * folha que sobe de baixo, arrastar pela alça). O estilo está em `app/anotacoes-visual.css`.
 */

/* ───── cor de cada página ───── */

/** Cor de cada página: sempre a mesma para a mesma página (vem do id), entre estas, para os cards ficarem variados. */
const CORES: ReadonlyArray<readonly [string, string]> = [
  ["#c8773a", "#e8a56c"],
  ["#7b5cc4", "#a58be0"],
  ["#2f8f83", "#5fc2b3"],
  ["#3b7dd8", "#79aef0"],
  ["#c2527a", "#ec8fb0"],
  ["#6b8f3a", "#a3c76a"],
  ["#b8903a", "#e6c46e"],
  ["#5b6ad0", "#8f9bf0"],
];
export function corDaNota(id: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CORES[h % CORES.length]!;
}

/** "Hoje, 14:32" para hoje; senão "5 out." (com o ano se não for deste). */
export function dataCurta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) {
    return `Hoje, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== hoje.getFullYear() ? { year: "numeric" } : {}),
  });
}

/* ───── botão, "Tabela | Cards", esqueleto ───── */

type Variante = "primary" | "secondary" | "ghost" | "danger";

export function Botao({
  variant = "primary",
  size,
  block,
  icon,
  className,
  children,
  type = "button",
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variante;
  size?: "sm" | "lg";
  block?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type={type}
      className={cn(
        "an-btn",
        `an-btn--${variant}`,
        size && `an-btn--${size}`,
        block && "an-btn--block",
        className,
      )}
      {...resto}
    >
      {icon}
      {children}
    </button>
  );
}

export function Segmentado<T extends string>({
  options,
  value,
  onChange,
  ...resto
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  "aria-label"?: string;
}) {
  return (
    <div className="an-seg" role="group" aria-label={resto["aria-label"]}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Esqueleto({ h = 16 }: { h?: number }) {
  return <div className="an-esqueleto" style={{ width: "100%", height: h }} aria-hidden />;
}

/* ───── a folha (sheet) ───── */

/**
 * Folha que sobe de baixo no celular e vira janela no computador. Usa `<dialog>`: foco preso e Esc
 * nativos. No celular, arrastar para baixo (pela alça ou pelo conteúdo, quando já está no topo) fecha.
 */
export function Folha({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      // Ao abrir, o navegador focaria o 1º campo (e o teclado do celular subiria sozinho): o foco
      // inicial vai para o corpo da janela, e a pessoa escolhe qual campo preencher.
      const corpo = d.querySelector<HTMLElement>(".an-folha__corpo");
      corpo?.setAttribute("tabindex", "-1");
      corpo?.setAttribute("autofocus", "");
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    }
    if (!open && d.open) {
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
    }
  }, [open]);

  // Arrastar para baixo em qualquer ponto da folha fecha — no celular. Se o conteúdo ainda está
  // rolado, o gesto rola a lista; só no topo o arrasto desce a folha. Passou de ~110px ou foi um
  // "flick" rápido: fecha.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    let y0 = 0;
    let t0 = 0;
    let dy = 0;
    let ativo = false;
    let bloqueado = false;
    const rolado = (alvo: EventTarget | null) => {
      for (let el = alvo as HTMLElement | null; el && el !== d; el = el.parentElement) {
        if (el.scrollTop > 0) return true;
      }
      return d.scrollTop > 0;
    };
    const solta = (fechar: boolean) => {
      d.style.transition = "transform 200ms ease-out";
      d.style.transform = fechar ? "translateY(100%)" : "";
      window.setTimeout(() => {
        d.style.transition = "";
        if (fechar) {
          d.style.transform = "";
          d.style.animation = "";
          d.close();
        } else d.style.animation = "";
      }, 210);
    };
    const inicio = (e: TouchEvent) => {
      ativo = false;
      dy = 0;
      bloqueado =
        (e.target as HTMLElement).closest(".an-folha__alca") !== null ||
        !window.matchMedia("(max-width: 639px)").matches ||
        e.touches.length !== 1 ||
        rolado(e.target);
      y0 = e.touches[0]!.clientY;
      t0 = e.timeStamp;
    };
    const move = (e: TouchEvent) => {
      if (bloqueado) return;
      const d1 = e.touches[0]!.clientY - y0;
      if (!ativo) {
        if (d1 < -4) {
          bloqueado = true;
          return;
        }
        if (d1 < 8) return;
        if (rolado(e.target)) {
          bloqueado = true;
          return;
        }
        ativo = true;
        d.style.animation = "none";
      }
      dy = Math.max(0, d1);
      d.style.transform = `translateY(${dy}px)`;
      if (e.cancelable) e.preventDefault();
    };
    const fim = (e: TouchEvent) => {
      if (!ativo) return;
      ativo = false;
      const v = dy / Math.max(1, e.timeStamp - t0);
      solta(dy > 110 || (dy > 40 && v > 0.6));
    };
    d.addEventListener("touchstart", inicio, { passive: true });
    d.addEventListener("touchmove", move, { passive: false });
    d.addEventListener("touchend", fim);
    d.addEventListener("touchcancel", fim);
    return () => {
      d.removeEventListener("touchstart", inicio);
      d.removeEventListener("touchmove", move);
      d.removeEventListener("touchend", fim);
      d.removeEventListener("touchcancel", fim);
    };
  }, []);

  // Arrastar a alça para baixo fecha a folha (só no celular): solta depois de 120 px, ou num gesto rápido.
  const arrasto = useRef<{ y0: number; t0: number; dy: number } | null>(null);
  const mover = (dy: number) => {
    const d = ref.current;
    if (d) d.style.transform = dy > 0 ? `translateY(${dy}px)` : "";
  };
  const limpar = () => {
    const d = ref.current;
    if (d) {
      d.style.transition = "";
      d.style.transform = "";
      d.style.animation = "";
    }
  };
  const soltar = (cancelado: boolean) => {
    const a = arrasto.current;
    const d = ref.current;
    arrasto.current = null;
    if (!a || !d) return;
    const rapido = a.dy / Math.max(performance.now() - a.t0, 1) > 0.6 && a.dy > 30;
    d.style.transition = "transform 180ms cubic-bezier(0.2, 0, 0, 1)";
    if (!cancelado && (a.dy > 120 || rapido)) {
      d.style.transform = "translateY(100%)";
      setTimeout(() => {
        limpar();
        onClose();
      }, 180);
    } else {
      d.style.transform = "";
      setTimeout(limpar, 190);
    }
  };

  return (
    <dialog
      ref={ref}
      className="an-folha"
      aria-label={title}
      // o evento "close" sobe pela árvore do React: sem este filtro, fechar uma janela aninhada fecharia também a de fora
      onClose={(e) => {
        if (e.target === ref.current) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="an-folha__corpo">
        <div
          className="an-folha__alca"
          aria-hidden
          onPointerDown={(e) => {
            const d = ref.current;
            if (!d) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            arrasto.current = { y0: e.clientY, t0: performance.now(), dy: 0 };
            d.style.animation = "none";
            d.style.transition = "none";
          }}
          onPointerMove={(e) => {
            const a = arrasto.current;
            if (!a) return;
            a.dy = Math.max(0, e.clientY - a.y0);
            mover(a.dy);
          }}
          onPointerUp={() => soltar(false)}
          onPointerCancel={() => soltar(true)}
        />
        <h2 className="an-t-h2">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

/* ───── reordenar por clique e arraste ───── */

/**
 * A ALÇA (⋮⋮) é quem arrasta — o resto da linha continua clicável e a página rola normalmente no
 * celular. Funciona com mouse, toque e TECLADO (alça em foco: espaço levanta, setas movem, espaço
 * solta, Esc cancela). `contexto` identifica a lista: só se solta dentro da mesma em que se pegou.
 */
const ACESSIBILIDADE = {
  screenReaderInstructions: {
    draggable:
      "Para reordenar, aperte espaço, mova com as setas para cima e para baixo e aperte espaço de novo para soltar. Esc cancela.",
  },
  announcements: {
    onDragStart: () => "Item levantado.",
    onDragOver: () => undefined,
    onDragEnd: () => "Item solto na nova posição.",
    onDragCancel: () => "Reordenação cancelada.",
  },
};

export function OrdenavelRaiz({
  children,
  onSoltar,
  grade,
}: {
  children: ReactNode;
  grade?: boolean;
  onSoltar: (contexto: string, idAtivo: string, idSobre: string) => void;
}) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function fim(e: DragEndEvent) {
    const a = e.active.data.current?.contexto as string | undefined;
    const o = e.over?.data.current?.contexto as string | undefined;
    if (!e.over || !a || a !== o || e.active.id === e.over.id) return;
    onSoltar(a, String(e.active.id), String(e.over.id));
  }
  return (
    <DndContext
      sensors={sensores}
      collisionDetection={(args) =>
        closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (c) => c.data.current?.contexto === args.active.data.current?.contexto,
          ),
        })
      }
      // na lista (não na grade) a linha só anda na vertical
      modifiers={grade ? [] : [({ transform }) => ({ ...transform, x: 0 })]}
      accessibility={ACESSIBILIDADE}
      onDragEnd={fim}
    >
      {children}
    </DndContext>
  );
}

export function ListaOrdenavel({
  ids,
  children,
  grade,
}: {
  ids: string[];
  children: ReactNode;
  grade?: boolean;
}) {
  return (
    <SortableContext
      items={ids}
      strategy={grade ? rectSortingStrategy : verticalListSortingStrategy}
    >
      {children}
    </SortableContext>
  );
}

export function ItemOrdenavel({
  id,
  contexto,
  nome,
  as: Tag = "li",
  className,
  children,
  ...resto
}: {
  id: string;
  contexto: string;
  nome: string;
  as?: "li" | "div";
  className?: string;
  "data-testid"?: string;
  children: (p: { alca: ReactNode; arrastando: boolean }) => ReactNode;
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
  } = useSortable({ id, data: { contexto } });
  const alca = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="an-alca"
      aria-label={`${t("Arrastar")} ${nome}`}
      {...attributes}
      {...listeners}
    >
      <DotsSixVertical size={22} weight="bold" aria-hidden />
    </button>
  );
  return (
    <Tag
      ref={setNodeRef as never}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(className, isDragging && "is-arrastando")}
      data-testid={resto["data-testid"]}
    >
      {children({ alca, arrastando: isDragging })}
    </Tag>
  );
}

export { arrayMove };
