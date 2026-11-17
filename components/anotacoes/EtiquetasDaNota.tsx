"use client";

import { useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import { MAXIMO_DE_ETIQUETAS, TAMANHO_DA_ETIQUETA } from "@/lib/anotacoes/paginas";
import { Tag, X } from "@/lib/ui/icons";

/**
 * As ETIQUETAS de uma página: chips com "x" para tirar e um campo para acrescentar (Enter ou
 * vírgula). Quem só lê vê os chips. Cada mudança já vai inteira ao pai (que grava e permite Ctrl+Z
 * pelo toast da tela, como as outras propriedades da página).
 */
export function EtiquetasDaNota({
  etiquetas,
  podeEditar,
  aoMudar,
  sugestoes = [],
}: {
  etiquetas: readonly string[];
  podeEditar: boolean;
  aoMudar: (etiquetas: string[]) => void;
  /** Etiquetas já usadas em outras páginas (aparecem como sugestão ao digitar). */
  sugestoes?: readonly string[];
}) {
  const t = useT();
  const [texto, setTexto] = useState("");

  function acrescentar(bruto: string) {
    const nova = bruto.trim().replace(/^#/, "").slice(0, TAMANHO_DA_ETIQUETA).trim();
    setTexto("");
    if (!nova || etiquetas.length >= MAXIMO_DE_ETIQUETAS) return;
    if (etiquetas.some((e) => e.toLowerCase() === nova.toLowerCase())) return;
    aoMudar([...etiquetas, nova]);
  }

  if (!podeEditar && etiquetas.length === 0) return null;
  const termo = texto.trim().toLowerCase();
  const filtradas = termo
    ? sugestoes
        .filter(
          (s) =>
            s.toLowerCase().includes(termo) &&
            !etiquetas.some((e) => e.toLowerCase() === s.toLowerCase()),
        )
        .slice(0, 5)
    : [];

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={t("Etiquetas")}>
      <Tag size={14} aria-hidden className="text-muted-foreground" />
      {etiquetas.map((e) => (
        <span
          key={e}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
        >
          {e}
          {podeEditar ? (
            <button
              type="button"
              aria-label={`${t("Tirar a etiqueta")} ${e}`}
              onClick={() => aoMudar(etiquetas.filter((x) => x !== e))}
              className="grid h-4 w-4 place-items-center rounded-full hover:bg-primary/20"
            >
              <X size={10} weight="bold" aria-hidden />
            </button>
          ) : null}
        </span>
      ))}
      {podeEditar ? (
        <span className="relative">
          <input
            value={texto}
            onChange={(e) => {
              const v = e.target.value;
              if (v.endsWith(",")) acrescentar(v.slice(0, -1));
              else setTexto(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                acrescentar(texto);
              } else if (e.key === "Backspace" && texto === "" && etiquetas.length) {
                aoMudar(etiquetas.slice(0, -1));
              }
            }}
            onBlur={() => texto.trim() && acrescentar(texto)}
            maxLength={TAMANHO_DA_ETIQUETA}
            placeholder={etiquetas.length ? t("Nova etiqueta") : t("Adicionar etiqueta")}
            aria-label={t("Adicionar etiqueta")}
            className="h-7 w-36 rounded-full border border-dashed bg-transparent px-3 text-xs outline-hidden placeholder:text-muted-foreground focus:border-primary/60"
          />
          {filtradas.length ? (
            <ul className="absolute top-full left-0 z-20 mt-1 w-44 rounded-xl border bg-popover p-1 shadow-lg">
              {filtradas.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      acrescentar(s);
                    }}
                    className="block w-full truncate rounded-lg px-2 py-1 text-left text-xs hover:bg-secondary"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
