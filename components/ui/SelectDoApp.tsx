"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

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
    const el = filho as ReactElement<{
      value?: string | number;
      children?: ReactNode;
      disabled?: boolean;
    }>;
    if (el.type === Fragment) lerOpcoes(el.props.children, saida);
    else if (el.type === "option") {
      saida.push({
        id: String(el.props.value ?? textoDe(el.props.children)),
        rotulo: textoDe(el.props.children),
        desabilitada: el.props.disabled,
      });
    } else if (el.type === "optgroup") lerOpcoes(el.props.children, saida);
  });
  return saida;
}

interface Props {
  /** Controlado (com `onChange`) ou, sem ele, solto com `defaultValue` + `name` (formulário nativo). */
  value?: string | number;
  defaultValue?: string | number;
  name?: string;
  required?: boolean;
  /** Mesma forma do `<select>`: o handler lê `e.target.value`. */
  onChange?: (e: { target: { value: string } }) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  "data-testid"?: string;
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
  defaultValue,
  name,
  required,
  onChange,
  children,
  className,
  disabled,
  "aria-label": ariaLabel,
  title,
  id,
  "data-testid": testId,
}: Props) {
  const [interno, setInterno] = useState(String(defaultValue ?? ""));
  const atual = value === undefined ? interno : String(value);
  const todas = lerOpcoes(children);
  const vazia = todas.find((o) => o.id === "");
  const seletor = (
    <SeletorEmPopup
      rotulo={ariaLabel ?? title}
      valor={atual}
      opcoes={todas.filter((o) => o.id !== "")}
      rotuloVazio={vazia?.rotulo}
      desabilitado={disabled}
      className={className}
      id={id}
      data-testid={testId}
      aoEscolher={(id) => {
        setInterno(id);
        onChange?.({ target: { value: id } });
      }}
    />
  );
  if (!name && !required) return seletor;
  // Dentro de um <form>: leva o valor no envio e mantém o "obrigatório" nativo.
  return (
    <div className="relative">
      {seletor}
      <input
        name={name}
        value={atual}
        required={required}
        disabled={disabled}
        readOnly
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-0 opacity-0"
      />
    </div>
  );
}
