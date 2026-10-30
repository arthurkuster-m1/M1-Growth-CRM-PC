"use client";

import {
  GradeDeNumeros,
  Painel,
  TabelaDeDados,
  brl,
  inteiro,
  pct,
} from "@/components/dashboards/base";
import { useT } from "@/hooks/i18n/useT";
import type { ResumoDeFechamento } from "@/lib/dashboards/fechamento";

export type FechamentoDoDashboard = ResumoDeFechamento & {
  porCampanha?: Array<ResumoDeFechamento & { id: string; nome: string }>;
};

/**
 * O FECHAMENTO DO PERÍODO — por data de fechamento: das vendas fechadas no período, quanto vale o
 * fechado, quanto já voltou em dinheiro (até hoje), quanto falta e quanto disso está vencido. É a
 * régua para avaliar campanha: segue as vendas que ela gerou, não o caixa do mês.
 */
export function FechamentoDoPeriodo({ dados }: { dados: FechamentoDoDashboard }) {
  const t = useT();
  return (
    <Painel
      titulo={t("Fechamento do período")}
      nota={t("Vendas fechadas no período e quanto já voltou delas (até hoje)")}
    >
      <GradeDeNumeros
        itens={[
          { rotulo: t("Vendas fechadas"), valor: inteiro(dados.vendas) },
          { rotulo: t("Fechado"), valor: brl(dados.fechado), destaque: true },
          { rotulo: t("Recebido até hoje"), valor: brl(dados.recebido) },
          { rotulo: t("A receber"), valor: brl(dados.aReceber) },
          {
            rotulo: t("% recebido"),
            valor: dados.percentualRecebido === null ? "—" : pct(dados.percentualRecebido),
          },
          { rotulo: t("Vencido"), valor: brl(dados.vencido) },
          {
            rotulo: t("Ticket Médio"),
            valor: dados.ticketMedio === null ? "—" : brl(dados.ticketMedio),
          },
        ]}
      />
      {dados.porCampanha && dados.porCampanha.length > 0 ? (
        <div className="mt-4">
          <TabelaDeDados
            colunas={[
              { titulo: t("Campanha") },
              { titulo: t("Vendas") },
              { titulo: t("Fechado") },
              { titulo: t("Recebido até hoje") },
              { titulo: t("A receber") },
              { titulo: t("Vencido") },
              { titulo: t("% recebido") },
            ]}
            linhas={dados.porCampanha.map((c) => [
              c.nome,
              inteiro(c.vendas),
              brl(c.fechado),
              brl(c.recebido),
              brl(c.aReceber),
              brl(c.vencido),
              c.percentualRecebido === null ? "—" : pct(c.percentualRecebido),
            ])}
          />
        </div>
      ) : null}
    </Painel>
  );
}
