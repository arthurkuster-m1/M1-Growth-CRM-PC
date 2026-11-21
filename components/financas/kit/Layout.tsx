"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "./cx";

export function Page({
  children,
  center,
  wide,
  className,
}: {
  children: ReactNode;
  center?: boolean;
  wide?: boolean;
  className?: string;
}) {
  return (
    <main
      className={cx("fi-page", center && "fi-page--center", wide && "fi-page--wide", className)}
    >
      {children}
    </main>
  );
}

export function Header({ lead, actions }: { lead: ReactNode; actions?: ReactNode }) {
  return (
    <header className="fi-header">
      <div className="fi-header__lead">{lead}</div>
      <div className="fi-header__actions">{actions}</div>
    </header>
  );
}

export type NavItem = {
  id: string;
  label: string;
  icon: ReactNode;
  /** se houver, vira <a> de verdade (abre em nova aba, mostra o destino) */ href?: string;
};

/** Nav flutuante em pílula azul-marinho. `fixed` por padrão; `static` só para mostrar no guia. */
export function FloatingNav({
  items,
  active,
  onSelect,
  fixed = true,
  className,
}: {
  items: NavItem[];
  active: string;
  onSelect: (id: string) => void;
  fixed?: boolean;
  className?: string;
}) {
  return (
    <nav className={cx("fi-nav", !fixed && "fi-nav--static", className)} aria-label="Principal">
      {items.map((i) =>
        i.href ? (
          <a
            key={i.id}
            href={i.href}
            aria-current={i.id === active ? "page" : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              onSelect(i.id);
            }}
          >
            {i.icon}
            {i.label}
          </a>
        ) : (
          <button
            key={i.id}
            type="button"
            aria-current={i.id === active ? "page" : undefined}
            onClick={() => onSelect(i.id)}
          >
            {i.icon}
            {i.label}
          </button>
        ),
      )}
    </nav>
  );
}

/** Folha que sobe de baixo no celular e vira modal no desktop. Usa <dialog>: foco preso e Esc nativos. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** janela larga no desktop (para trabalho com textos grandes) */ wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      // Ao abrir, o navegador focaria o 1º campo (e o teclado do celular subiria sozinho). Apontamos o foco inicial para o corpo da janela:
      // a pessoa escolhe qual campo preencher.
      const corpo = d.querySelector<HTMLElement>(".fi-sheet__body");
      corpo?.setAttribute("tabindex", "-1");
      corpo?.setAttribute("autofocus", "");
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);
  // Arrastar para baixo em qualquer ponto da folha (alça ou conteúdo) fecha — no celular. Se o conteúdo ainda está rolado, o gesto rola a lista;
  // só quando já está no topo (não dá para subir mais) o arrasto desce a folha. Passou de ~110px ou foi um "flick" rápido: fecha.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    let y0 = 0,
      t0 = 0,
      dy = 0,
      ativo = false,
      bloqueado = false;
    const rolado = (alvo: EventTarget | null) => {
      // algum elemento entre o toque e a folha com rolagem própria já rolada? então o gesto é dele
      for (let el = alvo as HTMLElement | null; el && el !== d; el = el.parentElement)
        if (el.scrollTop > 0) return true;
      return d.scrollTop > 0;
    };
    const solta = (fechar: boolean) => {
      d.style.transition = "transform 200ms ease-out";
      d.style.transform = fechar ? "translateY(100%)" : "";
      const fim = () => {
        d.style.transition = "";
        if (fechar) {
          d.style.transform = "";
          d.style.animation = "";
          d.close();
        } else d.style.animation = "";
      };
      window.setTimeout(fim, 210);
    };
    const inicio = (e: TouchEvent) => {
      ativo = false;
      dy = 0;
      // a alça tem o seu próprio arrasto (ponteiro); aqui só o resto da folha
      bloqueado =
        (e.target as HTMLElement).closest(".fi-sheet__grip") !== null ||
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
        } // subiu: é rolagem normal
        if (d1 < 8) return;
        if (rolado(e.target)) {
          bloqueado = true;
          return;
        }
        ativo = true;
        d.style.animation = "none"; // a animação de abertura (fill both) travaria o transform
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
  // arrastar a alça para baixo fecha a folha (só no celular, onde ela sobe de baixo): solta depois de 120 px, ou num gesto rápido
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
    const a = arrasto.current,
      d = ref.current;
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
      className={`fi-sheet${wide ? "fi-sheet--wide" : ""}`}
      aria-label={title}
      // o evento "close" sobe pela árvore do React: sem este filtro, fechar uma janela aninhada fecharia também a de fora
      onClose={(e) => {
        if (e.target === ref.current) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="fi-sheet__body">
        <div
          className="fi-sheet__grip"
          aria-hidden
          data-testid="alca-sheet"
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
        <h2 className="t-h2">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
