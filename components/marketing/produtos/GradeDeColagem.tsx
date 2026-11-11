"use client";

import { ArrowsClockwise, CheckCircle, Warning, XCircle } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { DataSheetGrid, keyColumn, textColumn } from "react-datasheet-grid";
import "react-datasheet-grid/dist/style.css";
import "./grade-de-colagem.css";

import type { TomDaLinha } from "@/lib/marketing/produtos-colagem";
import type { ColunaDoModelo, LinhaDaPlanilha } from "@/lib/marketing/produtos-csv";

/**
 * A GRADE de colar produtos (a mesma do app Finanças): cada linha é um produto, as colunas são
 * as do modelo da planilha, e a última mostra a SITUAÇÃO da linha. A situação viaja DENTRO dos
 * dados (campos `__`): a grade só repassa a linha atual, então nunca mostra um resultado velho.
 * Fica em arquivo à parte para carregar só no navegador (a grade usa `window`).
 */
export type LinhaGrade = LinhaDaPlanilha & { __tom?: TomDaLinha; __texto?: string };

export const semSituacao = ({ __tom, __texto, ...resto }: LinhaGrade): LinhaDaPlanilha => {
  void __tom;
  void __texto;
  return resto;
};

const ICONE: Record<TomDaLinha, ReactNode> = {
  erro: <XCircle size={15} weight="fill" />,
  aviso: <Warning size={15} weight="fill" />,
  dup: <ArrowsClockwise size={15} />,
  ok: <CheckCircle size={15} weight="fill" />,
};

const classeDaLinha = ({ rowData }: { rowData: LinhaGrade; rowIndex: number }) =>
  rowData.__tom ? `massa-linha is-${rowData.__tom}` : undefined;

/** A coluna comum no fim da tabela (rola junto com as outras; não fica congelada). */
const COLUNA_DE_SITUACAO = {
  id: "situacao",
  title: "Situação da linha",
  minWidth: 320,
  basis: 360,
  grow: 1,
  disabled: true,
  component: ({ rowData }: { rowData: LinhaGrade }) =>
    rowData.__tom ? (
      <span className={`massa-status is-${rowData.__tom}`} title={rowData.__texto}>
        {ICONE[rowData.__tom]}
        <span>{rowData.__texto}</span>
      </span>
    ) : null,
  copyValue: ({ rowData }: { rowData: LinhaGrade }) => rowData.__texto ?? "",
  pasteValue: ({ rowData }: { rowData: LinhaGrade }) => rowData,
  deleteValue: ({ rowData }: { rowData: LinhaGrade }) => rowData,
  isCellEmpty: ({ rowData }: { rowData: LinhaGrade }) => !rowData.__tom,
};

/* A biblioteca usa null para célula vazia; nossas linhas usam undefined: o cast só concilia os dois. */
/* eslint-disable @typescript-eslint/no-explicit-any */
const coluna = (chave: ColunaDoModelo, titulo: string, minWidth: number, maxWidth?: number) =>
  keyColumn<LinhaGrade, any>(chave, {
    ...(textColumn as any),
    title: titulo,
    minWidth,
    ...(maxWidth ? { maxWidth } : {}),
  });

const COLUNAS: any[] = [
  coluna("nome", "Nome", 190),
  coluna("resumo", "Resumo", 220),
  coluna("etapa", "Etapa", 100, 130),
  coluna("tipo_de_preco", "Tipo de preço", 120, 150),
  coluna("preco", "Preço", 100, 130),
  coluna("setup", "Setup", 90, 120),
  coluna("carro_chefe", "Carro-chefe", 100, 120),
  coluna("inclui", "Inclui (separe com |)", 220),
  coluna("para_quem", "Para quem", 180),
  coluna("prazo", "Prazo", 100, 140),
  coluna("condicoes", "Condições", 170),
  COLUNA_DE_SITUACAO,
];
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function GradeDeColagem({
  linhas,
  aoMudar,
}: {
  linhas: LinhaGrade[];
  aoMudar: (linhas: LinhaDaPlanilha[]) => void;
}) {
  return (
    <div className="massa" data-testid="grade-de-produtos">
      <DataSheetGrid<LinhaGrade>
        value={linhas}
        onChange={(v) => aoMudar(v.map(semSituacao))}
        columns={COLUNAS}
        createRow={() => ({})}
        rowClassName={classeDaLinha}
        height={Math.min(420, 44 + 38 * (linhas.length + 1))}
        rowHeight={38}
        addRowsComponent={false}
        autoAddRow
      />
    </div>
  );
}
