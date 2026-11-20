"use client";

import { formatCentsBRL } from "@/lib/money";
import { useFinancas } from "@/lib/financas/dados";

import { Card, Page } from "./kit";

/** A Visão geral (patrimônio, evolução, conferência de saldo) é a fase F5; até lá, o que já está cadastrado. */
export function VisaoGeralEmBreve() {
  const { contas, categorias, config } = useFinancas();
  const visiveis = categorias.filter((c) => c.ativa && c.grupo !== "Sistema");
  return (
    <Page wide>
      <div className="fi-grid fi-grid--3" data-testid="financas-base">
        <Card>
          <p className="t-body-sm t-muted">Contas e cartões</p>
          <p className="t-h1">{contas.filter((c) => c.ativa).length}</p>
          <p className="t-caption t-muted">{contas.map((c) => c.nome).join(" · ")}</p>
        </Card>
        <Card>
          <p className="t-body-sm t-muted">Categorias</p>
          <p className="t-h1">{visiveis.length}</p>
        </Card>
        <Card>
          <p className="t-body-sm t-muted">Teto de gastos do mês</p>
          <p className="t-h1">
            {config.teto_padrao_cents > 0
              ? formatCentsBRL(config.teto_padrao_cents)
              : "Não definido"}
          </p>
        </Card>
      </div>
      <p className="t-body-sm t-muted">
        A Visão geral, o Mês, o Ano e as Faturas chegam nas próximas etapas.
      </p>
    </Page>
  );
}
