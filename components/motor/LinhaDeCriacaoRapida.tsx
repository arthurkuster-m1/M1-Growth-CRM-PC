"use client";

import { useRef, useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import { CaretRight, Plus } from "@/lib/ui/icons";

interface Props {
  /** O texto do campo vazio (ex.: "Nova tarefa"). */
  rotulo: string;
  /**
   * Enter com texto: cria a linha. O campo se esvazia NA HORA e continua com o foco, para a
   * próxima — quem digita não espera o servidor. Se a criação falhar (a promessa rejeita), o
   * texto volta para o campo, a menos que a pessoa já tenha começado a escrever outro.
   */
  aoCriar: (titulo: string) => Promise<unknown> | void;
  /** "Mais detalhes": abre o formulário completo já com o que foi digitado. Sem isto, o botão some. */
  aoDetalhar?: (titulo: string) => void;
  rotuloDeDetalhar?: string;
}

/**
 * O CAMPO DE BAIXO DA TABELA — criar linha sem abrir pop-up (como o Notion e o app da família).
 *
 * Clica, escreve, Enter: a linha nasce e o campo fica pronto para a seguinte. Esc limpa e sai.
 * O formulário completo continua a um clique ("Mais detalhes") para quando a linha precisa de
 * descrição, prazo etc.
 */
export function LinhaDeCriacaoRapida({ rotulo, aoCriar, aoDetalhar, rotuloDeDetalhar }: Props) {
  const t = useT();
  const [texto, setTexto] = useState("");
  const campo = useRef<HTMLInputElement>(null);
  // O que está no campo agora (a falha de uma criação devolve o texto só se o campo ainda está vazio).
  const atual = useRef("");
  const mudar = (valor: string) => {
    atual.current = valor;
    setTexto(valor);
  };

  function enviar() {
    const titulo = texto.trim();
    if (!titulo) return;
    mudar("");
    const resultado = aoCriar(titulo);
    if (resultado && typeof (resultado as Promise<unknown>).catch === "function") {
      (resultado as Promise<unknown>).catch(() => {
        if (atual.current === "") mudar(titulo);
      });
    }
  }

  return (
    <div className="group flex w-full items-center gap-2 border-t pr-2 pl-4 transition-colors focus-within:bg-secondary/50 hover:bg-secondary/50">
      <Plus size={14} className="shrink-0 text-muted-foreground" aria-hidden />
      <input
        ref={campo}
        value={texto}
        maxLength={255}
        enterKeyHint="done"
        placeholder={rotulo}
        aria-label={rotulo}
        onChange={(e) => mudar(e.target.value)}
        onKeyDown={(e) => {
          // Enter que confirma uma palavra no teclado de celular/japonês não cria a linha.
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            enviar();
          } else if (e.key === "Escape") {
            e.preventDefault();
            mudar("");
            campo.current?.blur();
          }
        }}
        className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-hidden placeholder:text-muted-foreground"
      />
      {texto.trim() ? (
        <span aria-hidden className="hidden shrink-0 text-xs text-text-subtle sm:inline">
          {t("Enter para criar")}
        </span>
      ) : null}
      {aoDetalhar ? (
        <button
          type="button"
          onClick={() => {
            const titulo = texto.trim();
            mudar("");
            aoDetalhar(titulo);
          }}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {rotuloDeDetalhar ?? t("Mais detalhes")}
          <CaretRight size={12} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
