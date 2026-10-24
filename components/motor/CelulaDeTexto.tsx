"use client";

import { useEffect, useRef, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  /** Aceita salvar texto vazio (ex.: apagar a descrição). O título, não. */
  permitirVazio?: boolean;
  /** O que aparece, em cinza, quando o valor é vazio. */
  vazioRotulo?: string;
  /** O que aparece quando NÃO está editando, se for diferente do valor (ex.: um número formatado). */
  exibir?: string;
  /** Teclado/validação sugeridos ao editar (número, link…). */
  inputMode?: "text" | "decimal" | "numeric" | "url";
  /**
   * Texto longo: um clique abre uma caixa maior (como no Notion) com o conteúdo inteiro, em vez de
   * editar dentro da célula pequena. Selecionar o texto com o mouse ali não mexe no cartão.
   */
  caixaGrande?: boolean;
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
  permitirVazio = false,
  vazioRotulo,
  exibir,
  inputMode,
  caixaGrande = false,
  className,
}: Props) {
  const [editando, setEditando] = useState(iniciarEditando);
  const [rascunho, setRascunho] = useState(valor);
  const campo = useRef<HTMLInputElement>(null);
  const areaGrande = useRef<HTMLTextAreaElement>(null);
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
    if (!desfazer && (novo || permitirVazio) && novo !== valor) aoSalvar(novo);
    else setRascunho(valor);
  }

  if (caixaGrande) {
    // Descrição (permitirVazio): Enter quebra a linha e Ctrl+Enter salva. Título: Enter salva.
    const enterSalva = !permitirVazio;
    return (
      <Popover
        open={editando}
        onOpenChange={(aberto) => {
          if (aberto) {
            if (!podeEditar) return;
            setRascunho(valor);
            setEditando(true);
          } else {
            const unico = enterSalva ? rascunho.replace(/\s*\n\s*/g, " ") : rascunho;
            const novo = unico.trim();
            const desfazer = cancelando.current;
            cancelando.current = false;
            setEditando(false);
            aoTerminarEdicao?.();
            if (!desfazer && (novo || permitirVazio) && novo !== valor) aoSalvar(novo);
            else setRascunho(valor);
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={!podeEditar}
            aria-label={rotulo}
            title={valor || undefined}
            className={cn(
              "block w-full truncate rounded-md px-2 py-1.5 text-left text-sm",
              podeEditar && "hover:bg-secondary",
              riscado && "text-muted-foreground line-through",
              !valor && "text-text-subtle",
              className,
            )}
          >
            {valor ? (exibir ?? valor) : vazioRotulo}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(92vw,26rem)] p-2"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const c = areaGrande.current;
            if (c) {
              c.focus();
              c.setSelectionRange(c.value.length, c.value.length);
            }
          }}
          onEscapeKeyDown={() => {
            cancelando.current = true;
          }}
        >
          <textarea
            ref={areaGrande}
            value={rascunho}
            aria-label={rotulo}
            rows={6}
            maxLength={permitirVazio ? 2000 : 255}
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={(e) => {
              const fechar = () => setEditando(false);
              if (e.key === "Enter" && (enterSalva ? !e.shiftKey : e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                // Fecha pelo mesmo caminho do clique fora: salva uma vez só.
                fechar();
                const unico = enterSalva ? rascunho.replace(/\s*\n\s*/g, " ") : rascunho;
                const novo = unico.trim();
                aoTerminarEdicao?.();
                if ((novo || permitirVazio) && novo !== valor) aoSalvar(novo);
              }
            }}
            className="max-h-[60vh] min-h-32 w-full resize-y rounded-lg border bg-card px-2.5 py-2 text-sm leading-relaxed outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
          <p className="mt-1 px-0.5 text-[11px] text-muted-foreground">
            {enterSalva ? "Enter salva · Esc cancela" : "Ctrl+Enter salva · Esc cancela"}
          </p>
        </PopoverContent>
      </Popover>
    );
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
          !valor && "text-text-subtle",
          className,
        )}
      >
        {valor ? (exibir ?? valor) : vazioRotulo}
      </button>
    );
  }

  return (
    <input
      ref={campo}
      value={rascunho}
      aria-label={rotulo}
      maxLength={permitirVazio ? 2000 : 255}
      inputMode={inputMode}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={terminar}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelando.current = true;
          e.currentTarget.blur();
        }
      }}
      className="w-full rounded-md border border-primary/50 bg-background px-2 py-1.5 text-sm ring-2 ring-primary/20 outline-hidden"
    />
  );
}
