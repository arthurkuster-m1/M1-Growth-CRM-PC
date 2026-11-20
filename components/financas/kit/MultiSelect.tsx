"use client";

import { useId, useRef } from "react";
import { CaretDown, Check } from "@/lib/ui/icons";
import { cx } from "./cx";
import { usePopover } from "./popover";

export type GrupoOpcoes = { label: string; opcoes: { value: string; label: string }[] };

/**
 * Seleção de VÁRIAS opções no padrão do Design System (lista que não fecha ao marcar). Vazio = "todas".
 * `onChange` recebe a lista nova; a opção do topo limpa a seleção.
 */
export function MultiSelect({
  values,
  onChange,
  grupos,
  todas = "Todas as categorias",
  className,
  ...aria
}: {
  values: string[];
  onChange: (v: string[]) => void;
  grupos: GrupoOpcoes[];
  todas?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const uid = useId();
  const gatilho = useRef<HTMLButtonElement>(null);
  const { ref: lista, aberto, setAberto } = usePopover(gatilho, { alturaMax: 360 });
  const nomes = new Map(grupos.flatMap((g) => g.opcoes.map((o) => [o.value, o.label] as const)));
  const marcados = values.filter((v) => nomes.has(v));
  const texto =
    marcados.length === 0
      ? todas
      : marcados.length <= 2
        ? marcados.map((v) => nomes.get(v)).join(", ")
        : `${marcados.length} categorias`;
  const alternar = (v: string) =>
    onChange(marcados.includes(v) ? marcados.filter((x) => x !== v) : [...marcados, v]);
  return (
    <>
      <button
        ref={gatilho}
        type="button"
        className={cx("fi-selectbox", aberto && "is-open", className)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={`${uid}-lb`}
        aria-label={aria["aria-label"]}
        onClick={() => setAberto(!aberto)}
      >
        <span
          className={cx("fi-selectbox__texto", marcados.length === 0 && "is-vazio")}
          style={marcados.length === 0 ? { color: "inherit" } : undefined}
        >
          {texto}
        </span>
        <CaretDown size={16} weight="bold" className="fi-selectbox__seta" aria-hidden />
      </button>
      <div
        ref={lista}
        id={`${uid}-lb`}
        popover="auto"
        role="listbox"
        aria-multiselectable="true"
        tabIndex={-1}
        className="fi-pop fi-pop--lista"
        onKeyDown={(e) => {
          if (e.key === "Escape") setAberto(false);
        }}
      >
        <div
          role="option"
          aria-selected={marcados.length === 0}
          tabIndex={0}
          className="fi-pop__opcao"
          onClick={() => onChange([])}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onChange([]);
            }
          }}
        >
          <span>{todas}</span>
          {marcados.length === 0 && <Check size={16} weight="bold" aria-hidden />}
        </div>
        {grupos.map((g) => (
          <div key={g.label} role="group" aria-label={g.label}>
            <div role="presentation" className="fi-pop__grupo">
              {g.label}
            </div>
            {g.opcoes.map((o) => (
              <div
                key={o.value}
                role="option"
                aria-selected={marcados.includes(o.value)}
                tabIndex={0}
                className="fi-pop__opcao"
                data-value={o.value}
                onClick={() => alternar(o.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    alternar(o.value);
                  }
                }}
              >
                <span>{o.label}</span>
                {marcados.includes(o.value) && <Check size={16} weight="bold" aria-hidden />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
