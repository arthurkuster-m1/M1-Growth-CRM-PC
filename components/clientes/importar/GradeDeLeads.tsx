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

const LARGURA_DA_SITUACAO = 760;

/** A coluna comum no FIM da tabela: o que vai acontecer com o lead desta linha. */
const COLUNA_DE_SITUACAO = {
  id: "situacao",
  title: "Situação da linha",
  minWidth: LARGURA_DA_SITUACAO,
  basis: LARGURA_DA_SITUACAO,
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
      // Pegar o título é arrastar a coluna: a grade não pode começar a selecionar células por baixo.
      onMouseDown={(e) => e.stopPropagation()}
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

const ALTURA_DA_LINHA = 38;
/** Espaço da barra de rolagem horizontal (dentro da tabela) e um respiro. */
const FOLGA_DA_BARRA = 28;

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

  // A grade remonta quando as colunas mudam: a seleção de antes não existe mais.
  const chaveDasColunas = colunas.map((c) => c.id).join("|");
  useEffect(() => {
    selecao.current = null;
  }, [chaveDasColunas]);

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

  // O CABEÇALHO FIXO: fica FORA da grade (que rola na horizontal), então o `position: sticky` do CSS o
  // prende no topo ao rolar a página, sem JavaScript. Só o deslocamento horizontal é acompanhado
  // (um transform quando a grade rola de lado) e as larguras, medidas das colunas da grade.
  const trilho = useRef<HTMLDivElement>(null);
  const [medidas, setMedidas] = useState<{
    gutter: number;
    colunas: number[];
    situacao: number;
  } | null>(null);
  useEffect(() => {
    const raiz = document.querySelector<HTMLElement>(".leads-grade");
    if (!raiz) return;
    const medir = () => {
      // A grade só desenha as colunas que cabem na tela: as larguras das colunas são as que nós
      // mesmos definimos; só a calha (números das linhas) e a largura útil se medem.
      const calha = raiz.querySelector<HTMLElement>(
        ".dsg-row:not(.dsg-row-header) .dsg-cell-gutter",
      );
      const cont = raiz.querySelector<HTMLElement>(".dsg-container");
      if (!calha || !cont) return;
      const gutter = Math.round(calha.getBoundingClientRect().width * 10) / 10;
      const cols = ultimas.current.colunas.map((c) => largura(c.id));
      const fixo = gutter + cols.reduce((a, b) => a + b, 0);
      // A coluna de situação cresce para ocupar o que sobra (mínimo 760).
      const situacao = Math.max(LARGURA_DA_SITUACAO, Math.floor(cont.clientWidth - fixo));
      setMedidas((atual) =>
        atual &&
        atual.gutter === gutter &&
        atual.situacao === situacao &&
        atual.colunas.join() === cols.join()
          ? atual
          : { gutter, colunas: cols, situacao },
      );
    };
    medir();
    const ro = new ResizeObserver(medir);
    const cont = raiz.querySelector(".dsg-container");
    if (cont) ro.observe(cont);
    ro.observe(raiz);
    return () => ro.disconnect();
  }, [chaveDasColunas, linhas.length]);

  /* A biblioteca usa null para célula vazia; nossas linhas usam undefined: o cast só concilia os dois. */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const colunasDaGrade: any[] = useMemo(
    () => [
      ...colunas.map((c) => ({
        ...keyColumn<LinhaGrade, any>(c.id, textColumn as any),
        title: c.rotulo,
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
    <div className="leads-wrap" data-testid="grade-de-leads">
      <div className="leads-cabecalho-fixo">
        <div className="leads-cabecalho-trilho" ref={trilho}>
          <div
            className="leads-cab-celula leads-cab-gutter"
            style={{ width: medidas?.gutter ?? 44 }}
          >
            <span className="leads-cab-canto" aria-hidden />
          </div>
          {colunas.map((c, i) => (
            <div
              key={c.id}
              className="leads-cab-celula"
              style={{ width: medidas?.colunas[i] ?? largura(c.id) }}
            >
              <TituloDaColuna
                id={c.id}
                texto={c.obrigatoria ? `${c.rotulo} *` : c.rotulo}
                aoMover={(a, b) => mover.current(a, b)}
                aoOcultar={(id) => ocultar.current(id)}
              />
            </div>
          ))}
          <div
            className="leads-cab-celula"
            style={{ width: medidas?.situacao ?? LARGURA_DA_SITUACAO }}
          >
            <span className="leads-cab-situacao">{COLUNA_DE_SITUACAO.title}</span>
          </div>
        </div>
      </div>
      <div className="leads-grade">
        {/* `key`: a biblioteca não redesenha o cabeçalho nem as células quando a lista de colunas muda
            (ocultar, mostrar, reordenar). Trocar o conjunto/ordem das colunas remonta a grade. */}
        <DataSheetGrid<LinhaGrade>
          key={chaveDasColunas}
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
          onScroll={(e) => {
            // O cabeçalho fixo acompanha a rolagem lateral da grade (sem re-renderizar nada).
            if (trilho.current) {
              trilho.current.style.transform = `translateX(${-e.currentTarget.scrollLeft}px)`;
            }
          }}
          columns={colunasDaGrade}
          createRow={() => ({})}
          duplicateRow={({ rowData }) => semSituacao(rowData)}
          rowClassName={classeDaLinha}
          rowKey={undefined}
          rowHeight={ALTURA_DA_LINHA}
          // O cabeçalho da biblioteca fica sem altura: o de verdade é o fixo, acima.
          headerRowHeight={0}
          gutterColumn={{ minWidth: 44 }}
          addRowsComponent={false}
          autoAddRow
          lockRows={false}
          // Sem teto: a tabela cresce com as linhas e quem rola é a PÁGINA (uma barra só, sem barra
          // vertical dentro da tabela). As linhas + uma folga para a barra horizontal.
          height={ALTURA_DA_LINHA * linhas.length + FOLGA_DA_BARRA}
        />
      </div>
    </div>
  );
}
