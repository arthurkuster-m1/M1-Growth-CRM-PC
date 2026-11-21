"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type SelectHTMLAttributes,
} from "react";
import { CaretDown, Check } from "@/lib/ui/icons";
import { cx } from "./cx";
import { usePopover } from "./popover";

type Item = { k: "g"; label: string } | { k: "o"; value: string; label: string; disabled: boolean };

/** Lê as <option>/<optgroup> que o chamador escreveu (inclusive as geradas por outros componentes). */
function lerItens(sel: HTMLSelectElement): Item[] {
  const itens: Item[] = [];
  const opcao = (o: HTMLOptionElement): Item => ({
    k: "o",
    value: o.value,
    label: o.textContent ?? "",
    disabled: o.disabled,
  });
  for (const filho of Array.from(sel.children)) {
    if (filho instanceof HTMLOptGroupElement) {
      itens.push({ k: "g", label: filho.label });
      for (const o of Array.from(filho.children)) itens.push(opcao(o as HTMLOptionElement));
    } else itens.push(opcao(filho as HTMLOptionElement));
  }
  return itens;
}

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size" | "multiple"> & {
  placeholder?: string;
};

/**
 * Lista de seleção no padrão do Design System. Mesma forma de uso do <select>: <Select value onChange={(e) => e.target.value}>
 * com <option>/<optgroup>. O <select> nativo fica escondido só como fonte das opções.
 */
export function Select({
  value,
  onChange,
  children,
  className,
  placeholder = "Selecionar…",
  id,
  disabled,
  ...resto
}: Props) {
  const uid = useId();
  const nativo = useRef<HTMLSelectElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const { ref: lista, aberto, setAberto } = usePopover(gatilho, { alturaMax: 320 });
  const [itens, setItens] = useState<Item[]>([]);
  const [ativo, setAtivo] = useState(-1);
  const doMouse = useRef(false); // o ativo mudou porque o mouse passou: não rola a lista
  const busca = useRef({ texto: "", t: 0 });
  const atual = String(value ?? "");

  useLayoutEffect(() => {
    if (!nativo.current) return;
    const novos = lerItens(nativo.current);
    setItens((prev) => (JSON.stringify(prev) === JSON.stringify(novos) ? prev : novos));
  });

  const selecionado = itens.find(
    (i): i is Extract<Item, { k: "o" }> => i.k === "o" && i.value === atual,
  );
  const habilitado = (i: number) =>
    itens[i]?.k === "o" && !(itens[i] as Extract<Item, { k: "o" }>).disabled;
  const proximo = (de: number, passo: 1 | -1) => {
    for (let i = de + passo; i >= 0 && i < itens.length; i += passo) if (habilitado(i)) return i;
    return de;
  };

  function abrir() {
    if (disabled) return;
    const i = itens.findIndex((x) => x.k === "o" && x.value === atual);
    setAtivo(i >= 0 ? i : proximo(-1, 1));
    setAberto(true);
  }
  function fechar(devolverFoco: boolean) {
    setAberto(false);
    if (devolverFoco) gatilho.current?.focus();
  }
  function escolher(i: number) {
    const it = itens[i];
    if (!it || it.k !== "o" || it.disabled) return;
    onChange?.({
      target: { value: it.value },
      currentTarget: { value: it.value },
    } as unknown as ChangeEvent<HTMLSelectElement>);
    fechar(true);
  }

  useEffect(() => {
    if (aberto) lista.current?.focus();
  }, [aberto, lista]);
  useEffect(() => {
    if (aberto && ativo >= 0 && !doMouse.current)
      document.getElementById(`${uid}-o-${ativo}`)?.scrollIntoView({ block: "nearest" });
    doMouse.current = false;
  }, [aberto, ativo, uid]);

  function aoTeclarNaLista(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((a) => proximo(a, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => proximo(a, -1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setAtivo(proximo(-1, 1));
    } else if (e.key === "End") {
      e.preventDefault();
      setAtivo(proximo(itens.length, -1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      escolher(ativo);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      fechar(true);
    } else if (e.key === "Tab") {
      fechar(false);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // digitar a inicial salta para a opção
      const agora = e.timeStamp; // relógio do próprio evento (em ms)
      const b = busca.current;
      b.texto = agora - b.t > 700 ? e.key.toLowerCase() : b.texto + e.key.toLowerCase();
      b.t = agora;
      const ordem = [...itens.keys()].filter(habilitado);
      const depois = ordem.filter((i) => i > ativo),
        antes = ordem.filter((i) => i <= ativo);
      const achado = [...depois, ...antes].find((i) =>
        (itens[i] as Extract<Item, { k: "o" }>).label.toLowerCase().startsWith(b.texto),
      );
      if (achado !== undefined) setAtivo(achado);
    }
  }

  return (
    <>
      <select
        ref={nativo}
        value={atual}
        onChange={() => undefined}
        hidden
        aria-hidden
        tabIndex={-1}
        disabled={disabled}
      >
        {children}
      </select>
      <button
        ref={gatilho}
        id={id}
        type="button"
        disabled={disabled}
        data-value={atual}
        className={cx("fi-selectbox", aberto && "is-open", className)}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={`${uid}-lb`}
        aria-label={resto["aria-label"]}
        aria-describedby={resto["aria-describedby"]}
        aria-invalid={resto["aria-invalid"]}
        onClick={() => (aberto ? fechar(false) : abrir())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            abrir();
          }
        }}
      >
        <span className={cx("fi-selectbox__texto", !selecionado && "is-vazio")}>
          {selecionado ? selecionado.label : placeholder}
        </span>
        <CaretDown size={16} weight="bold" className="fi-selectbox__seta" aria-hidden />
      </button>
      <div
        ref={lista}
        id={`${uid}-lb`}
        popover="auto"
        role="listbox"
        tabIndex={-1}
        className="fi-pop fi-pop--lista"
        aria-activedescendant={ativo >= 0 ? `${uid}-o-${ativo}` : undefined}
        onKeyDown={aoTeclarNaLista}
      >
        {itens.map((it, i) =>
          it.k === "g" ? (
            <div key={`g${i}`} role="presentation" className="fi-pop__grupo">
              {it.label}
            </div>
          ) : (
            <div
              key={`o${i}`}
              id={`${uid}-o-${i}`}
              role="option"
              data-value={it.value}
              aria-selected={it.value === atual}
              aria-disabled={it.disabled || undefined}
              className={cx(
                "fi-pop__opcao",
                i === ativo && "is-ativa",
                it.disabled && "is-desabilitada",
              )}
              onMouseMove={() => {
                if (!it.disabled && i !== ativo) {
                  doMouse.current = true;
                  setAtivo(i);
                }
              }}
              onClick={() => escolher(i)}
            >
              <span>{it.label}</span>
              {it.value === atual && <Check size={16} weight="bold" aria-hidden />}
            </div>
          ),
        )}
      </div>
    </>
  );
}
