"use client";

import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";

import { SeletorEmPopup, type OpcaoDoPopup } from "@/components/ui/SeletorEmPopup";

/** O texto de um filho de `<option>` (strings, números e `{t("…")}` misturados). */
function textoDe(no: ReactNode): string {
  if (no === null || no === undefined || typeof no === "boolean") return "";
  if (typeof no === "string" || typeof no === "number") return String(no);
  if (Array.isArray(no)) return no.map(textoDe).join("");
  if (isValidElement(no)) return textoDe((no.props as { children?: ReactNode }).children);
  return "";
}

/** Lê as `<option>` (também dentro de fragmentos e listas) como opções do popup. */
function lerOpcoes(filhos: ReactNode, saida: OpcaoDoPopup[] = []): OpcaoDoPopup[] {
  Children.forEach(filhos, (filho) => {
    if (!isValidElement(filho)) return;
    const el = filho as ReactElement<{ value?: string | number; children?: ReactNode }>;
    if (el.type === Fragment) lerOpcoes(el.props.children, saida);
    else if (el.type === "option") {
      saida.push({
        id: String(el.props.value ?? textoDe(el.props.children)),
        rotulo: textoDe(el.props.children),
      });
    } else if (el.type === "optgroup") lerOpcoes(el.props.children, saida);
  });
  return saida;
}

interface Props {
  value: string | number;
  /** Mesma forma do `<select>`: o handler lê `e.target.value`. */
  onChange: (e: { target: { value: string } }) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  title?: string;
}

/**
 * O `<select>` no estilo do software: o MESMO uso do `<select>` do navegador (value, onChange,
 * `<option>`), mas desenhado como o seletor em popup do produto. Serve para trocar os campos
 * antigos sem reescrever cada formulário.
 */
export function SelectDoApp({
  value,
  onChange,
  children,
  className,
  disabled,
  "aria-label": ariaLabel,
  title,
}: Props) {
  const todas = lerOpcoes(children);
  const vazia = todas.find((o) => o.id === "");
  return (
    <SeletorEmPopup
      rotulo={ariaLabel ?? title}
      valor={String(value)}
      opcoes={todas.filter((o) => o.id !== "")}
      rotuloVazio={vazia?.rotulo}
      desabilitado={disabled}
      className={className}
      aoEscolher={(id) => onChange({ target: { value: id } })}
    />
  );
}
