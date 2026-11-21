"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
  cloneElement,
} from "react";
import { cx } from "./cx";
import { centavosParaCampo, digitosParaCentavos } from "@/lib/financas/formato";

/** Rótulo + campo + dica/erro, ligados por id (leitor de tela lê tudo junto). */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
}) {
  const id = useId();
  const nota = error ?? hint;
  return (
    <div className="fi-field">
      <label className="fi-label" htmlFor={id}>
        {label}
      </label>
      {cloneElement(children, {
        id,
        "aria-describedby": nota ? `${id}-nota` : undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {nota && (
        <span id={`${id}-nota`} className={error ? "fi-error-text" : "fi-hint"}>
          {nota}
        </span>
      )}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { money?: boolean }
>(function Input({ className, money, ...p }, ref) {
  return (
    <input ref={ref} className={cx("fi-input", money && "fi-input--money", className)} {...p} />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cx("fi-textarea", className)} {...p} />;
});

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="fi-switch"
      onClick={() => onChange(!checked)}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  block,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  block?: boolean;
}) {
  return (
    <div className={cx("fi-segmented", block && "fi-segmented--block")} role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="fi-chips" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="fi-chip"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Campo de dinheiro estilo banco: digita só números e as 2 últimas casas são os centavos (4590 → 45,90). Valor em centavos. */
export const ValorInput = forwardRef<
  HTMLInputElement,
  { value: number; onChange: (centavos: number) => void } & Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type"
  >
>(function ValorInput({ value, onChange, className, ...p }, ref) {
  return (
    <input
      ref={ref}
      className={cx("fi-input", "fi-input--money", className)}
      inputMode="numeric"
      autoComplete="off"
      placeholder="0,00"
      value={centavosParaCampo(value)}
      onChange={(e) => onChange(digitosParaCentavos(e.target.value))}
      {...p}
    />
  );
});
