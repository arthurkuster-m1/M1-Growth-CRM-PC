"use client";

import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from "react";

import type { Bloco } from "@/lib/marketing/blocos";
import { gravarNoCaminho, lerNoCaminho, type Caminho } from "@/lib/marketing/caminho";
import { aplicarMarcaNoCampo } from "@/lib/marketing/texto-rico";
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
  /**
   * Fluidez de escrita (estilo Notion) — tudo opcional; quem não define mantém o comportamento
   * antigo. Cada função devolve `true` quando tratou a tecla.
   */
  /** Enter (sem Shift): cria o bloco de texto de baixo, levando o que estava depois do cursor. */
  aoEnter?: (bloco: Bloco, caminho: Caminho, cursor: CursorDoCampo) => boolean;
  /** Backspace com o cursor no começo do campo: transforma ou apaga o bloco. */
  aoApagarNoInicio?: (bloco: Bloco, caminho: Caminho, cursor: CursorDoCampo) => boolean;
  /** "/" num campo vazio: abre a busca de blocos. */
  aoBarra?: (bloco: Bloco, campo: HTMLTextAreaElement) => boolean;
  /** Seta para cima/baixo na ponta do texto: passa para o bloco vizinho. */
  navegar?: (bloco: Bloco, direcao: "cima" | "baixo", campo: HTMLTextAreaElement) => boolean;
  /** O texto mudou: "# ", "- ", "1. "… no começo viram o bloco certo. `true` = já tratou. */
  aoDigitar?: (bloco: Bloco, caminho: Caminho, valor: string) => boolean;
  /** Enter num item vazio da lista: sai da lista para um texto novo. */
  sairDaLista?: (bloco: Bloco, indice: number) => boolean;
}

export interface CursorDoCampo {
  inicio: number;
  fim: number;
  valor: string;
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
  /** Aceita várias linhas (Shift+Enter quebra a linha); o Enter sozinho SEMPRE encerra a digitação. */
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
      onChange={(e) => {
        if (!gravar && edicao.aoDigitar?.(bloco, caminho, e.target.value)) return;
        edicao.aoMudar(
          gravar ? gravar(e.target.value) : gravarNoCaminho(bloco, caminho, e.target.value),
        );
      }}
      onKeyDown={(e) => {
        // Ctrl+B / Ctrl+I: negrito e itálico no trecho selecionado.
        if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
          const k = e.key.toLowerCase();
          if (k === "b" || k === "i") {
            e.preventDefault();
            aplicarMarcaNoCampo(e.currentTarget, k === "b" ? "**" : "*");
            return;
          }
        }
        if (aoTeclar?.(e)) return;
        const el = e.currentTarget;
        const cursor: CursorDoCampo = {
          inicio: el.selectionStart,
          fim: el.selectionEnd,
          valor: el.value,
        };
        if (e.nativeEvent.isComposing) return;
        if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && el.value === "") {
          if (edicao.aoBarra?.(bloco, el)) {
            e.preventDefault();
            return;
          }
        }
        if (
          e.key === "Backspace" &&
          cursor.inicio === 0 &&
          cursor.fim === 0 &&
          edicao.aoApagarNoInicio?.(bloco, caminho, cursor)
        ) {
          e.preventDefault();
          return;
        }
        if (
          (e.key === "ArrowUp" || e.key === "ArrowDown") &&
          !e.shiftKey &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          cursor.inicio === cursor.fim &&
          cursor.inicio === (e.key === "ArrowUp" ? 0 : cursor.valor.length) &&
          edicao.navegar?.(bloco, e.key === "ArrowUp" ? "cima" : "baixo", el)
        ) {
          e.preventDefault();
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          // Enter continua a escrita no bloco de baixo (ou sai, onde não faz sentido); Shift+Enter
          // quebra a linha (só onde o texto tem várias linhas).
          if (!e.shiftKey) {
            if (!edicao.aoEnter?.(bloco, caminho, cursor)) edicao.sair();
          } else if (multilinha) {
            const { selectionStart: a, selectionEnd: b, value } = el;
            const escrever = Object.getOwnPropertyDescriptor(
              HTMLTextAreaElement.prototype,
              "value",
            )?.set;
            escrever?.call(el, `${value.slice(0, a)}\n${value.slice(b)}`);
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.setSelectionRange(a + 1, a + 1);
          }
        }
      }}
      className={cn(
        "block w-full min-w-0 resize-none overflow-hidden rounded-xl border-0 bg-transparent p-0 ring-1 ring-primary/25 outline-hidden transition-shadow placeholder:font-normal placeholder:text-text-subtle focus:ring-2 focus:ring-primary/60",
        className,
      )}
    />
  );
}
