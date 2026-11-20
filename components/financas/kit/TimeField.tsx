"use client";

import { useRef, useState } from "react";
import { Clock } from "@/lib/ui/icons";
import { cx } from "./cx";
import { usePopover } from "./popover";

const pad = (n: number) => String(n).padStart(2, "0");
const mascara = (t: string) => {
  const d = t.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
};
const lerHora = (v: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  return m && +m[1]! <= 24 && +m[2]! <= 59 ? { h: +m[1]! % 24, m: +m[2]! } : null;
};

/** Posição (em %) de um número no relógio: `i` de 0 a 11 a partir do topo, no sentido horário. */
const ponto = (i: number, raio: number) => ({
  left: `${50 + raio * Math.sin((i * Math.PI) / 6)}%`,
  top: `${50 - raio * Math.cos((i * Math.PI) / 6)}%`,
});

/**
 * Horário no padrão do Design System: dá para DIGITAR ("HH:MM", com máscara) ou abrir o relógio e tocar na hora
 * (anel de fora 1–12, de dentro 13–00) e depois nos minutos. O valor é o texto "HH:MM"; o `onChange` recebe o texto.
 */
export function TimeField({
  value,
  onChange,
  id,
  disabled,
  className,
  "aria-label": rotulo,
  placeholder = "00:00",
  ...resto
}: {
  value: string;
  onChange: (texto: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  placeholder?: string;
  "data-testid"?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const { ref: pop, aberto, setAberto } = usePopover(caixa, { largura: 264 });
  const [passo, setPasso] = useState<"hora" | "min">("hora");
  const atual = lerHora(value) ?? { h: 0, m: 0 };
  const [rascunhoH, setRascunhoH] = useState(atual.h);

  function abrir() {
    if (disabled) return;
    setRascunhoH(atual.h);
    setPasso("hora");
    setAberto(true);
  }
  const escolherHora = (h: number) => {
    setRascunhoH(h);
    onChange(`${pad(h)}:${pad(atual.m)}`);
    setPasso("min");
  };
  const escolherMin = (m: number) => {
    onChange(`${pad(rascunhoH)}:${pad(m)}`);
    setAberto(false);
  };

  return (
    <>
      <div ref={caixa} className={cx("fi-datefield", aberto && "is-open", className)}>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          maxLength={5}
          disabled={disabled}
          className="dia-hora"
          aria-label={rotulo}
          value={value}
          onChange={(e) => onChange(mascara(e.target.value))}
          data-testid={resto["data-testid"]}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && e.altKey) {
              e.preventDefault();
              abrir();
            }
          }}
        />
        <button
          type="button"
          className="fi-datefield__btn"
          aria-label="Abrir relógio"
          aria-haspopup="dialog"
          aria-expanded={aberto}
          disabled={disabled}
          onClick={() => (aberto ? setAberto(false) : abrir())}
        >
          <Clock size={20} />
        </button>
      </div>
      <div
        ref={pop}
        popover="auto"
        role="dialog"
        aria-label="Escolher horário"
        className="fi-pop fi-relogio"
      >
        <div className="fi-relogio__topo" aria-live="polite">
          <button type="button" aria-pressed={passo === "hora"} onClick={() => setPasso("hora")}>
            {pad(passo === "hora" ? atual.h : rascunhoH)}
          </button>
          <span aria-hidden>:</span>
          <button type="button" aria-pressed={passo === "min"} onClick={() => setPasso("min")}>
            {pad(atual.m)}
          </button>
        </div>
        <div className="fi-relogio__mostrador">
          {passo === "hora" ? (
            <>
              {Array.from({ length: 12 }, (_, i) => {
                const h = i === 0 ? 12 : i;
                return (
                  <button
                    key={h}
                    type="button"
                    className="fi-relogio__num"
                    style={ponto(i, 41)}
                    aria-pressed={atual.h === h}
                    aria-label={`${h} horas`}
                    onClick={() => escolherHora(h)}
                  >
                    {h}
                  </button>
                );
              })}
              {Array.from({ length: 12 }, (_, i) => {
                const h = i === 0 ? 0 : 12 + i;
                return (
                  <button
                    key={h}
                    type="button"
                    className="fi-relogio__num fi-relogio__num--dentro"
                    style={ponto(i, 25)}
                    aria-pressed={atual.h === h}
                    aria-label={`${h} horas`}
                    onClick={() => escolherHora(h)}
                  >
                    {pad(h)}
                  </button>
                );
              })}
            </>
          ) : (
            Array.from({ length: 12 }, (_, i) => (
              <button
                key={i}
                type="button"
                className="fi-relogio__num"
                style={ponto(i, 41)}
                aria-pressed={atual.m === i * 5}
                aria-label={`${i * 5} minutos`}
                onClick={() => escolherMin(i * 5)}
              >
                {pad(i * 5)}
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
