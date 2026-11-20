"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { CheckCircle } from "@/lib/ui/icons";
import { cx } from "./cx";

export function Badge({
  tone = "accent",
  className,
  ...p
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "accent" | "neutral" | "success" | "warning" | "error" | "info";
}) {
  return (
    <span className={cx("fi-badge", tone !== "accent" && `fi-badge--${tone}`, className)} {...p} />
  );
}

export function Avatar({ nome, size, brand }: { nome: string; size?: "lg"; brand?: boolean }) {
  return (
    <span
      className={cx("fi-avatar", size === "lg" && "fi-avatar--lg", brand && "fi-avatar--brand")}
      aria-hidden
    >
      {nome.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Barra de orçamento: verde até 79%, amarela de 80% a 100%, vermelha acima disso. */
export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const tone = pct > 100 ? "bad" : pct >= 80 ? "warn" : "ok";
  return (
    <div
      className="fi-progress"
      data-tone={tone}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
    >
      <span style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fi-stat">
      <span className="fi-stat__label">{label}</span>
      {children}
    </div>
  );
}

export function Skeleton({ w = "100%", h = 16 }: { w?: number | string; h?: number }) {
  return <div className="fi-skeleton" style={{ width: w, height: h }} aria-hidden />;
}

export function Spinner() {
  return <span className="fi-spinner" role="status" aria-label="Carregando" />;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="fi-empty">
      <span className="fi-empty__icon">{icon}</span>
      <h3 className="t-h3">{title}</h3>
      {children && (
        <p className="t-body t-muted" style={{ maxWidth: 320 }}>
          {children}
        </p>
      )}
      {action}
    </div>
  );
}

/* Toast: confirmação curta, some sozinho em 2,6 s. */
type ToastCtx = (mensagem: string) => void;
const Ctx = createContext<ToastCtx>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<{ id: number; texto: string }[]>([]);
  const seq = useRef(0);
  const mostrar = useCallback((texto: string) => {
    const id = ++seq.current;
    setItens((l) => [...l, { id, texto }]);
    window.setTimeout(() => setItens((l) => l.filter((i) => i.id !== id)), 2600);
  }, []);
  return (
    <Ctx.Provider value={mostrar}>
      {children}
      <div className="fi-toasts" aria-live="polite">
        {itens.map((i) => (
          <div key={i.id} className="fi-toast">
            <CheckCircle size={20} weight="fill" />
            {i.texto}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
