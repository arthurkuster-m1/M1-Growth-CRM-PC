"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Um valor que se edita no lugar: aparece como texto (ou como o convite "Adicionar …" quando está
 * vazio) e, ao clicar, vira campo. Enter ou sair do campo salva; Esc cancela. O campo existe mesmo
 * sem valor — é assim que se preenche o que ainda não se sabe.
 */
export function CampoInline({
  valor,
  placeholder,
  aoSalvar,
  podeEditar = true,
  type = "text",
  inputMode,
  className,
  classeDoTexto,
  maxLength = 200,
  rotulo,
}: {
  valor: string;
  placeholder: string;
  /** Devolve `false` para recusar o valor (o campo volta ao que estava). */
  aoSalvar: (novo: string) => Promise<boolean | void> | boolean | void;
  podeEditar?: boolean;
  type?: "text" | "email" | "tel";
  inputMode?: "text" | "email" | "tel";
  className?: string;
  /** Classes do texto (o tamanho do nome é maior que o do e-mail). */
  classeDoTexto?: string;
  maxLength?: number;
  rotulo?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(valor);
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editando) campo.current?.select();
  }, [editando]);

  async function confirmar() {
    setEditando(false);
    const novo = rascunho.trim();
    if (novo === valor.trim()) return;
    const ok = await aoSalvar(novo);
    if (ok === false) setRascunho(valor);
  }

  if (!podeEditar) {
    return valor ? <span className={cn(classeDoTexto, className)}>{valor}</span> : null;
  }

  if (editando) {
    return (
      <input
        ref={campo}
        type={type}
        inputMode={inputMode}
        value={rascunho}
        maxLength={maxLength}
        aria-label={rotulo ?? placeholder}
        placeholder={placeholder}
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={() => void confirmar()}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setRascunho(valor);
            setEditando(false);
          }
        }}
        className={cn(
          "h-9 w-full min-w-0 rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setRascunho(valor);
        setEditando(true);
      }}
      aria-label={rotulo ?? placeholder}
      title={rotulo ?? placeholder}
      className={cn(
        "min-w-0 rounded-lg text-left break-words hover:bg-secondary/70",
        valor ? classeDoTexto : "text-muted-foreground italic",
        className,
      )}
    >
      {valor || placeholder}
    </button>
  );
}
