"use client";

import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from "react";

import type { Bloco } from "@/lib/marketing/blocos";
import { gravarNoCaminho, lerNoCaminho, type Caminho } from "@/lib/marketing/caminho";
import { cn } from "@/lib/utils";

/**
 * A EDIÇÃO NO LUGAR dos blocos: quando o editor visual põe um bloco em "digitar direto", cada
 * texto dele vira um campo com a MESMA aparência do texto final (mesma fonte, tamanho,
 * alinhamento), e o que se digita já é o bloco. Sem `edicao`, nada disto existe — o bloco
 * desenha o texto como sempre (painel, apresentação e link público).
 */
export interface EdicaoNoLugar {
  /** O bloco que está em edição (só um por vez). */
  ativoId: string | null;
  aoMudar: (bloco: Bloco) => void;
  /** Quem deve receber o cursor no próximo desenho: `<id do bloco>|<caminho>`. */
  foco: string | null;
  pedirFoco: (chave: string | null) => void;
  /** Enter num campo de uma linha, ou Esc: encerra a digitação. */
  sair: () => void;
}

export const emEdicao = (
  edicao: EdicaoNoLugar | undefined,
  bloco: Bloco,
): edicao is EdicaoNoLugar => Boolean(edicao) && edicao!.ativoId === bloco.id;

export const chaveDoCampo = (bloco: Bloco, caminho: Caminho) => `${bloco.id}|${caminho.join(".")}`;

export function CampoNoLugar({
  edicao,
  bloco,
  caminho,
  className,
  multilinha = false,
  placeholder,
  aoTeclar,
  valor: valorDado,
  gravar,
}: {
  edicao: EdicaoNoLugar;
  bloco: Bloco;
  caminho: Caminho;
  className?: string;
  /** Várias linhas (Enter quebra a linha); senão Enter encerra a digitação. */
  multilinha?: boolean;
  placeholder?: string;
  /** Teclas próprias do campo (listas: Enter cria outro item). Devolver `true` = tratou. */
  aoTeclar?: (e: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  /** Para texto que não está num caminho simples (célula de tabela): o valor e como gravá-lo. */
  valor?: string;
  gravar?: (valor: string) => Bloco;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const valor = valorDado ?? String(lerNoCaminho(bloco, caminho) ?? "");
  const chave = chaveDoCampo(bloco, caminho);

  // Cresce com o texto, sem barra de rolagem.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [valor]);

  useEffect(() => {
    if (edicao.foco !== chave) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    edicao.pedirFoco(null);
  });

  return (
    <textarea
      ref={ref}
      data-campo-no-lugar={chave}
      rows={1}
      value={valor}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) =>
        edicao.aoMudar(
          gravar ? gravar(e.target.value) : gravarNoCaminho(bloco, caminho, e.target.value),
        )
      }
      onKeyDown={(e) => {
        if (aoTeclar?.(e)) return;
        if (e.key === "Enter" && !e.shiftKey && !multilinha && !e.nativeEvent.isComposing) {
          e.preventDefault();
          edicao.sair();
        }
      }}
      className={cn(
        "block w-full min-w-0 resize-none overflow-hidden rounded-sm border-0 bg-transparent p-0 ring-1 ring-primary/25 outline-hidden transition-shadow placeholder:font-normal placeholder:text-text-subtle focus:ring-2 focus:ring-primary/60",
        className,
      )}
    />
  );
}
