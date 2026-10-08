"use client";

import { useState } from "react";

/** O nome de uma opção ou propriedade, editável no lugar: salva ao sair do campo ou com Enter. */
export function CampoDeNome({
  valor,
  rotulo,
  aoSalvar,
  className,
}: {
  valor: string;
  rotulo: string;
  aoSalvar: (novo: string) => void;
  className?: string;
}) {
  const [rascunho, setRascunho] = useState(valor);

  return (
    <input
      value={rascunho}
      aria-label={rotulo}
      maxLength={60}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={() => {
        const novo = rascunho.trim();
        if (novo && novo !== valor) aoSalvar(novo);
        else setRascunho(valor);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setRascunho(valor);
      }}
      className={
        className ??
        "min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
      }
    />
  );
}

/** O campo "Adicionar opção": Enter cria e limpa. */
export function CampoDeNovaOpcao({
  placeholder,
  aoCriar,
}: {
  placeholder: string;
  aoCriar: (nome: string) => void;
}) {
  const [texto, setTexto] = useState("");

  return (
    <input
      value={texto}
      placeholder={placeholder}
      aria-label={placeholder}
      maxLength={60}
      onChange={(e) => setTexto(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && texto.trim()) {
          aoCriar(texto.trim());
          setTexto("");
        }
      }}
      className="w-full rounded-md border border-dashed bg-background px-2 py-1 text-sm outline-none placeholder:text-text-subtle focus:border-primary/50"
    />
  );
}
