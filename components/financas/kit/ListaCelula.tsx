"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CellProps } from "react-datasheet-grid";
import { CaretDown } from "@/lib/ui/icons";
import { destacar, filtrarOpcoes } from "./busca";
import { usePopover } from "./popover";
import type { OpcaoBusca } from "./Combobox";

/* ───── Células com lista para tabelas de adição em massa: mostram as opções que já existem enquanto você digita ───── */
/** Opções por coluna (a chave é a `chave` passada em `columnData`). Envolva a tabela em <OpcoesCelulas.Provider value={...}>. */
export const OpcoesCelulas = createContext<Record<string, OpcaoBusca[]>>({});

/** A tabela fecha a célula em edição quando percebe um clique "fora" dela — e a lista de opções fica FORA (camada de cima do navegador).
 *  Por isso o clique na opção é tratado já no pressionar (antes de a lista sumir) e não chega até a tabela. */
const isolar = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
  e.preventDefault();
  e.stopPropagation();
};

export function ListaCell({
  rowData,
  setRowData,
  active,
  focus,
  stopEditing,
  columnData,
}: CellProps<
  string | null | undefined,
  {
    chave: string;
    /** aceita texto fora da lista: aparece "Usar “texto”" no fim das opções */ livre?: boolean;
  }
>) {
  const opcoes = useContext(OpcoesCelulas)[columnData.chave] ?? [];
  const valor = rowData ?? "";
  const rotulo = opcoes.find((o) => o.value === valor)?.label ?? valor;
  const campo = useRef<HTMLInputElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const { ref: lista, setAberto } = usePopover(caixa, { alturaMax: 280 });
  const [texto, setTexto] = useState(rotulo);
  const [digitou, setDigitou] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const visiveis = useMemo(() => {
    const base = digitou ? filtrarOpcoes(opcoes, texto) : opcoes;
    const t = texto.trim(),
      norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
    return columnData.livre && digitou && t && !opcoes.some((o) => norm(o.label) === norm(t))
      ? [...base, { value: t, label: `Usar “${t}”`, sub: "novo" }]
      : base;
  }, [opcoes, texto, digitou, columnData.livre]);

  useLayoutEffect(() => {
    if (focus) {
      setDigitou(false);
      setTexto(rotulo);
      setAtivo(
        Math.max(
          0,
          opcoes.findIndex((o) => o.value === valor),
        ),
      );
      campo.current?.focus();
      campo.current?.select();
      setAberto(true);
    } else setAberto(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);
  useEffect(() => {
    if (focus)
      document
        .getElementById(`fi-lc-${columnData.chave}-o-${ativo}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [focus, ativo, lista]);

  function escolher(o: OpcaoBusca | undefined, descer: boolean) {
    if (o) setRowData(o.value);
    stopEditing({ nextRow: descer });
  }

  return (
    <div ref={caixa} className="fi-lista-cel">
      <input
        ref={campo}
        className="dsg-input"
        tabIndex={-1}
        autoComplete="off"
        spellCheck={false}
        readOnly={!focus}
        value={focus ? texto : rotulo}
        style={{ pointerEvents: focus ? "auto" : "none" }}
        onChange={(e) => {
          setTexto(e.target.value);
          setDigitou(true);
          setAtivo(0);
        }}
        onKeyDown={(e) => {
          if (!focus) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setAtivo((a) => Math.min(visiveis.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setAtivo((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            escolher(visiveis[ativo], true);
          } else if (e.key === "Tab") {
            e.preventDefault();
            escolher(visiveis[ativo], false);
          }
        }}
      />
      {active && !focus && (
        <CaretDown size={12} weight="bold" className="fi-lista-cel__seta" aria-hidden />
      )}
      <div
        ref={lista}
        id={`fi-lc-${columnData.chave}`}
        popover="manual"
        role="listbox"
        className="fi-pop fi-pop--lista"
        onMouseDown={isolar}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {focus && visiveis.length === 0 && (
          <div className="fi-pop__vazio" role="presentation">
            Nenhuma opção com esse texto
          </div>
        )}
        {focus &&
          visiveis.map((o, i) => {
            const [a, b, c] = destacar(o.label, digitou ? texto : "");
            return (
              <div
                key={o.value}
                id={`fi-lc-${columnData.chave}-o-${i}`}
                role="option"
                data-value={o.value}
                aria-selected={o.value === valor}
                className={`fi-pop__opcao${i === ativo ? "is-ativa" : ""}`}
                onMouseMove={() => setAtivo(i)}
                onMouseDown={(e) => {
                  isolar(e);
                  escolher(o, false);
                }}
              >
                <span>
                  {b ? (
                    <>
                      {a}
                      <strong className="fi-pop__achado">{b}</strong>
                      {c}
                    </>
                  ) : (
                    o.label
                  )}
                  {o.sub && <small className="fi-pop__sub"> {o.sub}</small>}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
