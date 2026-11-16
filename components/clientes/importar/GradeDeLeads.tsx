"use client";

import {
  ArrowsClockwise,
  CheckCircle,
  Minus,
  SpinnerGap,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import { useMemo, type ReactNode } from "react";
import { DataSheetGrid, keyColumn, textColumn } from "react-datasheet-grid";
import "react-datasheet-grid/dist/style.css";
import "./grade-de-leads.css";

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

export default function GradeDeLeads({
  colunas,
  linhas,
  aoMudar,
}: {
  colunas: ColunaDaGrade[];
  linhas: LinhaGrade[];
  aoMudar: (linhas: LinhaDeLead[]) => void;
}) {
  /* A biblioteca usa null para célula vazia; nossas linhas usam undefined: o cast só concilia os dois. */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const colunasDaGrade: any[] = useMemo(
    () => [
      ...colunas.map((c) => ({
        ...keyColumn<LinhaGrade, any>(c.id, textColumn as any),
        title: c.obrigatoria ? `${c.rotulo} *` : c.rotulo,
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
