"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import { CaretDown, MagnifyingGlass, Plus } from "@/lib/ui/icons";
import { cx } from "./cx";
import { destacar, existeIgual, filtrarOpcoes } from "./busca";
import { usePopover } from "./popover";

export type OpcaoBusca = { value: string; label: string; sub?: string };
type Props = {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  opcoes: OpcaoBusca[];
  placeholder?: string;
  vazio?: string;
  /** Quando o texto digitado não bate com nenhuma opção, oferece "Criar …" e chama isto com o texto. */
  onCriar?: (texto: string) => void;
  rotuloCriar?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

/**
 * Seleção com busca: ao abrir mostra TODAS as opções na ordem escolhida; ao digitar, filtra (sem acento, sem maiúsculas)
 * e destaca o trecho. Enter ou Tab escolhem a primeira/ativa; setas navegam; Esc fecha. Valor = value da opção.
 */
export function Combobox({
  value,
  onChange,
  opcoes,
  placeholder = "Buscar…",
  vazio = "Nada encontrado",
  onCriar,
  rotuloCriar = "Criar",
  id,
  disabled,
  className,
  ...aria
}: Props) {
  const uid = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const { ref: lista, aberto, setAberto } = usePopover(caixa, { alturaMax: 320 });
  const atual = opcoes.find((o) => o.value === value);
  const [texto, setTexto] = useState(atual?.label ?? "");
  const [digitou, setDigitou] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const confirmou = useRef(false);
  const semAbrirNoFoco = useRef(false); // depois de "Criar", a janela devolve o foco ao campo: isso não deve reabrir a lista
  const doMouse = useRef(false); // o ativo mudou porque o mouse passou: não rola a lista

  useEffect(() => {
    if (!digitou) setTexto(atual?.label ?? "");
  }, [atual?.label, digitou]);
  const visiveis = useMemo(
    () => (digitou ? filtrarOpcoes(opcoes, texto) : opcoes),
    [opcoes, texto, digitou],
  );
  useEffect(() => {
    if (aberto && !doMouse.current)
      document.getElementById(`${uid}-o-${ativo}`)?.scrollIntoView({ block: "nearest" });
    doMouse.current = false;
  }, [aberto, ativo, uid]);

  const textoCriar = texto.trim();
  const podeCriar = !!onCriar && digitou && textoCriar !== "" && !existeIgual(opcoes, textoCriar);
  function criar() {
    if (!onCriar) return;
    const t = textoCriar;
    setAberto(false);
    setDigitou(false);
    setTexto(atual?.label ?? "");
    confirmou.current = true;
    semAbrirNoFoco.current = true;
    window.setTimeout(() => {
      semAbrirNoFoco.current = false;
    }, 800);
    onCriar(t);
  }

  function abrir() {
    if (disabled) return;
    const i = visiveis.findIndex((o) => o.value === value);
    setAtivo(i >= 0 ? i : 0);
    setAberto(true);
  }
  function escolher(o: OpcaoBusca | undefined) {
    if (!o) return;
    confirmou.current = true;
    onChange({
      target: { value: o.value },
      currentTarget: { value: o.value },
    } as unknown as ChangeEvent<HTMLInputElement>);
    setTexto(o.label);
    setDigitou(false);
    setAberto(false);
  }
  function cancelar() {
    setDigitou(false);
    setTexto(atual?.label ?? "");
    setAberto(false);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!aberto) abrir();
      else setAtivo((a) => Math.min(visiveis.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!aberto) abrir();
      else setAtivo((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && aberto && podeCriar && visiveis.length === 0) {
      e.preventDefault();
      e.stopPropagation();
      criar();
    } else if (e.key === "Enter") {
      if (aberto && visiveis[ativo]) {
        e.preventDefault();
        e.stopPropagation();
        escolher(visiveis[ativo]);
      } else if (!aberto) {
        e.preventDefault();
        abrir();
      }
    } else if (e.key === "Escape") {
      if (aberto) {
        e.preventDefault();
        e.stopPropagation();
        cancelar();
      }
    } else if (e.key === "Tab") {
      if (aberto && digitou && visiveis[ativo]) escolher(visiveis[ativo]);
      else setAberto(false);
    }
  }

  return (
    <>
      <div
        ref={caixa}
        className={cx("fi-datefield", "fi-combobox", aberto && "is-open", className)}
        aria-invalid={aria["aria-invalid"]}
      >
        <MagnifyingGlass size={18} className="fi-combobox__lupa" aria-hidden />
        <input
          ref={campo}
          id={id}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          disabled={disabled}
          data-value={value}
          role="combobox"
          aria-expanded={aberto}
          aria-controls={`${uid}-lb`}
          aria-autocomplete="list"
          aria-activedescendant={aberto && visiveis[ativo] ? `${uid}-o-${ativo}` : undefined}
          aria-label={aria["aria-label"]}
          aria-describedby={aria["aria-describedby"]}
          aria-invalid={aria["aria-invalid"]}
          value={texto}
          onFocus={(e) => {
            confirmou.current = false;
            e.currentTarget.select();
            if (!semAbrirNoFoco.current) abrir();
          }}
          onClick={() => {
            if (!aberto) abrir();
          }}
          onChange={(e) => {
            setTexto(e.target.value);
            setDigitou(true);
            setAtivo(0);
            if (!aberto) setAberto(true);
          }}
          onBlur={() => {
            if (!confirmou.current) {
              setDigitou(false);
              setTexto(atual?.label ?? "");
            }
            setAberto(false);
          }}
          onKeyDown={aoTeclar}
        />
        <CaretDown size={16} weight="bold" className="fi-combobox__seta" aria-hidden />
      </div>
      <div
        ref={lista}
        id={`${uid}-lb`}
        popover="manual"
        role="listbox"
        className="fi-pop fi-pop--lista"
        onMouseDown={(e) => e.preventDefault()}
      >
        {visiveis.length === 0 && (
          <div className="fi-pop__vazio" role="presentation">
            {vazio}
          </div>
        )}
        {visiveis.map((o, i) => {
          const [a, b, c] = destacar(o.label, digitou ? texto : "");
          return (
            <div
              key={o.value}
              id={`${uid}-o-${i}`}
              role="option"
              data-value={o.value}
              aria-selected={o.value === value}
              className={cx("fi-pop__opcao", i === ativo && "is-ativa")}
              onMouseMove={() => {
                if (i !== ativo) {
                  doMouse.current = true;
                  setAtivo(i);
                }
              }}
              onClick={() => escolher(o)}
            >
              <span>
                {b ? (
                  <Fragment>
                    {a}
                    <strong className="fi-pop__achado">{b}</strong>
                    {c}
                  </Fragment>
                ) : (
                  o.label
                )}
                {o.sub && <small className="fi-pop__sub"> {o.sub}</small>}
              </span>
            </div>
          );
        })}
        {podeCriar && (
          <button type="button" className="fi-pop__criar" onClick={criar}>
            <Plus size={16} weight="bold" aria-hidden />
            <span>
              {rotuloCriar} <strong>“{textoCriar}”</strong>
            </span>
          </button>
        )}
      </div>
    </>
  );
}
