"use client";

import {
  ArrowsClockwise,
  DotsSixVertical,
  X,
  CheckCircle,
  Minus,
  SpinnerGap,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DataSheetGrid, keyColumn, textColumn } from "react-datasheet-grid";
import "react-datasheet-grid/dist/style.css";
import "./grade-de-leads.css";

import {
  colarNaSelecao,
  matrizDoTextoColado,
  type SelecaoDaGrade,
} from "@/lib/leads/colar-na-selecao";
import type { TomDaLinha } from "@/lib/leads/conferencia-da-importacao";

/**
 * A GRADE de importar leads — a mesma da importação em massa do app Gestão de Frota
 * (react-datasheet-grid): selecionar várias células, copiar, colar do Excel, recortar, apagar,
 * arrastar o canto para preencher, Ctrl+Z / Ctrl+Y e o menu do botão direito (inserir, duplicar e
 * excluir linhas). Cada linha é um objeto { id da coluna → texto }; a situação da linha viaja
 * DENTRO dos dados (campos `__`), então nunca mostra um resultado velho. Fica em arquivo à parte
 * para carregar só no navegador (a grade usa `window`).
 */
export type LinhaDeLead = Record<string, string | undefined>;
export type LinhaGrade = LinhaDeLead & { __tom?: TomDaLinha | "esperando"; __texto?: string };

export interface ColunaDaGrade {
  id: string;
  rotulo: string;
  obrigatoria?: boolean;
}

export const semSituacao = ({ __tom, __texto, ...resto }: LinhaGrade): LinhaDeLead => {
  void __tom;
  void __texto;
  return resto;
};

const ICONE: Record<TomDaLinha | "esperando", ReactNode> = {
  erro: <XCircle size={15} weight="fill" />,
  aviso: <Warning size={15} weight="fill" />,
  info: <ArrowsClockwise size={15} />,
  ok: <CheckCircle size={15} weight="fill" />,
  ign: <Minus size={15} />,
  esperando: <SpinnerGap size={15} className="animate-spin" />,
};

const classeDaLinha = ({ rowData }: { rowData: LinhaGrade; rowIndex: number }) =>
  rowData.__tom ? `leads-linha is-${rowData.__tom}` : undefined;

/** A coluna comum no FIM da tabela: o que vai acontecer com o lead desta linha. */
const COLUNA_DE_SITUACAO = {
  id: "situacao",
  title: "Situação da linha",
  minWidth: 760,
  basis: 760,
  grow: 1,
  disabled: true,
  component: ({ rowData }: { rowData: LinhaGrade }) =>
    rowData.__tom && rowData.__tom !== "ign" ? (
      <span className={`leads-status is-${rowData.__tom}`} title={rowData.__texto}>
        {ICONE[rowData.__tom]}
        <span>{rowData.__texto}</span>
      </span>
    ) : null,
  copyValue: ({ rowData }: { rowData: LinhaGrade }) => rowData.__texto ?? "",
  pasteValue: ({ rowData }: { rowData: LinhaGrade }) => rowData,
  deleteValue: ({ rowData }: { rowData: LinhaGrade }) => rowData,
  isCellEmpty: ({ rowData }: { rowData: LinhaGrade }) => !rowData.__tom,
};

/** Largura sugerida por tipo de coluna (a pessoa pode arrastar a borda do título). */
function largura(id: string): number {
  if (id === "titulo") return 200;
  if (id === "email") return 210;
  if (id === "telefone") return 150;
  if (id === "data_entrada") return 130;
  if (id === "hora_entrada") return 120;
  if (id === "descricao") return 240;
  if (id.startsWith("link_")) return 190;
  return 160;
}

/**
 * O título de uma coluna: dá para PEGAR e arrastar para outro lugar (reordena), e o × esconde a
 * coluna. Qualquer coluna, inclusive Nome, E-mail e Data. O arrastar é por ponteiro (e não o
 * arrastar nativo do navegador): a grade da biblioteca captura o clique no cabeçalho e cancelava
 * o nativo.
 */
function TituloDaColuna({
  id,
  texto,
  aoMover,
  aoOcultar,
}: {
  id: string;
  texto: string;
  aoMover: (idMovido: string, idAlvo: string) => void;
  aoOcultar: (id: string) => void;
}) {
  const [arrastando, setArrastando] = useState(false);

  function apertar(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const alvo = e.target as HTMLElement;
    if (alvo.closest(".leads-titulo__x")) return;
    // No toque, só a alça arrasta (o resto rola a tabela).
    if (e.pointerType === "touch" && !alvo.closest(".leads-titulo__alca")) return;
    const x0 = e.clientX;
    let moveu = false;
    let sobre: HTMLElement | null = null;
    const marcar = (el: HTMLElement | null) => {
      if (sobre === el) return;
      sobre?.classList.remove("is-sobre");
      sobre = el;
      sobre?.classList.add("is-sobre");
    };
    const mover = (ev: PointerEvent) => {
      if (!moveu && Math.abs(ev.clientX - x0) < 6) return;
      if (!moveu) {
        moveu = true;
        setArrastando(true);
        document.body.classList.add("leads-arrastando-coluna");
      }
      const el = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest<HTMLElement>(".leads-titulo[data-coluna]");
      marcar(el && el.dataset.coluna !== id ? el : null);
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      document.body.classList.remove("leads-arrastando-coluna");
      const destino = sobre?.dataset.coluna;
      marcar(null);
      setArrastando(false);
      if (moveu && destino) aoMover(id, destino);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
  }

  return (
    <div
      className={`leads-titulo${arrastando ? "is-arrastando" : ""}`}
      data-coluna={id}
      title="Arraste para mudar de lugar"
      onPointerDown={apertar}
    >
      <DotsSixVertical size={13} className="leads-titulo__alca" aria-hidden />
      <span className="leads-titulo__texto">{texto}</span>
      <button
        type="button"
        className="leads-titulo__x"
        aria-label={`Ocultar ${texto}`}
        title="Ocultar esta coluna"
        onClick={(e) => {
          e.stopPropagation();
          aoOcultar(id);
        }}
      >
        <X size={12} weight="bold" aria-hidden />
      </button>
    </div>
  );
}

export default function GradeDeLeads({
  colunas,
  linhas,
  aoMudar,
  aoMoverColuna,
  aoOcultarColuna,
}: {
  colunas: ColunaDaGrade[];
  linhas: LinhaGrade[];
  aoMudar: (linhas: LinhaDeLead[]) => void;
  /** Arrastou o título de `idMovido` para o lugar de `idAlvo`. */
  aoMoverColuna: (idMovido: string, idAlvo: string) => void;
  /** Clicou no × do título. */
  aoOcultarColuna: (id: string) => void;
}) {
  // As funções vão por ref: a lista de colunas não é refeita (e o cabeçalho não pisca) a cada render.
  const mover = useRef(aoMoverColuna);
  const ocultar = useRef(aoOcultarColuna);
  // A seleção atual (várias células) e o que a tela tem agora, para o colar como o do Excel.
  const selecao = useRef<SelecaoDaGrade | null>(null);
  const ultimas = useRef({ colunas, linhas, aoMudar });
  useEffect(() => {
    mover.current = aoMoverColuna;
    ocultar.current = aoOcultarColuna;
    ultimas.current = { colunas, linhas, aoMudar };
  });

  // COLAR NA SELEÇÃO: copiou uma célula e selecionou várias → vale para todas (como o Excel). A
  // biblioteca só cola a partir da célula ativa; aqui, no caso em que a seleção é maior que o
  // copiado, o valor vai para a seleção inteira. Nos outros casos a grade cola do jeito normal.
  useEffect(() => {
    function aoColar(e: ClipboardEvent) {
      const sel = selecao.current;
      if (!sel) return;
      const foco = document.activeElement;
      // Escrevendo num campo (a célula em edição, o custo, a caixa de colar): o colar é dele.
      if (foco instanceof HTMLElement && foco.closest("input, textarea, select")) return;
      const texto = e.clipboardData?.getData("text/plain");
      if (!texto) return;
      const { colunas: cols, linhas: ls, aoMudar: mudar } = ultimas.current;
      const novas = colarNaSelecao(
        ls.map(semSituacao),
        cols.map((c) => c.id),
        sel,
        matrizDoTextoColado(texto),
      );
      if (!novas) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      mudar(novas);
    }
    // Na captura: roda antes do colar da biblioteca (que escuta o documento).
    document.addEventListener("paste", aoColar, true);
    return () => document.removeEventListener("paste", aoColar, true);
  }, []);

  /* A biblioteca usa null para célula vazia; nossas linhas usam undefined: o cast só concilia os dois. */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const colunasDaGrade: any[] = useMemo(
    () => [
      ...colunas.map((c) => ({
        ...keyColumn<LinhaGrade, any>(c.id, textColumn as any),
        title: (
          <TituloDaColuna
            id={c.id}
            texto={c.obrigatoria ? `${c.rotulo} *` : c.rotulo}
            aoMover={(a, b) => mover.current(a, b)}
            aoOcultar={(id) => ocultar.current(id)}
          />
        ),
        minWidth: largura(c.id),
        basis: largura(c.id),
        grow: 0,
      })),
      COLUNA_DE_SITUACAO,
    ],
    [colunas],
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <div className="leads-grade" data-testid="grade-de-leads">
      <DataSheetGrid<LinhaGrade>
        value={linhas}
        onChange={(v) => aoMudar(v.map(semSituacao))}
        onSelectionChange={({ selection }) => {
          selecao.current = selection
            ? {
                min: { col: selection.min.col as number, row: selection.min.row },
                max: { col: selection.max.col as number, row: selection.max.row },
              }
            : null;
        }}
        columns={colunasDaGrade}
        createRow={() => ({})}
        duplicateRow={({ rowData }) => semSituacao(rowData)}
        rowClassName={classeDaLinha}
        rowKey={undefined}
        rowHeight={38}
        gutterColumn={{ minWidth: 44 }}
        addRowsComponent={false}
        autoAddRow
        lockRows={false}
        height={Math.min(560, 48 + 38 * (linhas.length + 1))}
      />
    </div>
  );
}
