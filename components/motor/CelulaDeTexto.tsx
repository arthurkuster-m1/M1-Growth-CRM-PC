"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface Props {
  valor: string;
  aoSalvar: (novo: string) => void;
  /** Quando a linha acaba de nascer, a célula já abre em edição (com tudo selecionado). */
  iniciarEditando?: boolean;
  aoTerminarEdicao?: () => void;
  podeEditar: boolean;
  /** Texto de acessibilidade do campo (ex.: "Título da tarefa"). */
  rotulo: string;
  riscado?: boolean;
  className?: string;
}

/**
 * Texto que se edita no lugar, como no Notion: um clique vira campo; Enter ou sair do
 * campo salva; Esc desfaz. Texto vazio NÃO salva — título vazio é recusado pela API, e a
 * célula volta ao valor anterior em vez de mostrar um erro por um deslize de teclado.
 */
export function CelulaDeTexto({
  valor,
  aoSalvar,
  iniciarEditando = false,
  aoTerminarEdicao,
  podeEditar,
  rotulo,
  riscado,
  className,
}: Props) {
  const [editando, setEditando] = useState(iniciarEditando);
  const [rascunho, setRascunho] = useState(valor);
  const campo = useRef<HTMLInputElement>(null);
  const cancelando = useRef(false);

  useEffect(() => {
    if (editando) {
      campo.current?.focus();
      campo.current?.select();
    }
  }, [editando]);

  function terminar() {
    const novo = rascunho.trim();
    const desfazer = cancelando.current;
    cancelando.current = false;
    setEditando(false);
    aoTerminarEdicao?.();
    if (!desfazer && novo && novo !== valor) aoSalvar(novo);
    else setRascunho(valor);
  }

  if (!editando) {
    return (
      <button
        type="button"
        disabled={!podeEditar}
        aria-label={rotulo}
        onClick={() => {
          setRascunho(valor);
          setEditando(true);
        }}
        className={cn(
          "block w-full truncate rounded-md px-2 py-1.5 text-left text-sm",
          podeEditar && "hover:bg-secondary",
          riscado && "text-muted-foreground line-through",
          className,
        )}
      >
        {valor}
      </button>
    );
  }

  return (
    <input
      ref={campo}
      value={rascunho}
      aria-label={rotulo}
      maxLength={255}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={terminar}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelando.current = true;
          e.currentTarget.blur();
        }
      }}
      className="w-full rounded-md border border-primary/50 bg-background px-2 py-1.5 text-sm outline-none ring-2 ring-primary/20"
    />
  );
}
