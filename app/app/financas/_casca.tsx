"use client";

import { useQuery } from "@tanstack/react-query";

import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import type { Categoria, Conta, GrupoCategoria } from "@/lib/financas/tipos";
import { formatCentsBRL } from "@/lib/money";

type Base = {
  contas: Conta[];
  grupos: GrupoCategoria[];
  categorias: Categoria[];
  config: { teto_padrao_cents: number; meta_padrao_cents: number; conta_vendas_id: string | null };
};

/**
 * A CASCA das Finanças (fase F1): carrega a base da empresa (contas, categorias, teto) e mostra o
 * que há. As telas (Lançar, Lançamentos, Mês, Geral, Faturas, Ano) entram nas próximas fases e
 * moram dentro desta casca.
 */
export function FinancasCasca() {
  const t = useT();
  const base = useQuery({
    queryKey: ["financas", "base"],
    queryFn: async () => (await apiClient.get<{ data: Base }>("/api/v1/financas/base")).data,
    retry: false,
  });

  if (base.isLoading) {
    return <div className="h-40 animate-pulse rounded-3xl bg-secondary" aria-busy="true" />;
  }
  if (base.isError) {
    const semMigration =
      base.error instanceof ApiError && base.error.code === "financas_sem_migration";
    return (
      <p
        role="alert"
        className="rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning-fg"
      >
        {semMigration
          ? t("O banco ainda não recebeu a atualização das Finanças. Peça para aplicá-la na VPS.")
          : t("Não foi possível carregar as Finanças.")}
      </p>
    );
  }

  const { contas, categorias, config } = base.data!;
  const grupoVisivel = (c: Categoria) => c.grupo !== "Sistema";
  return (
    <section
      aria-label={t("Base das Finanças")}
      className="grid gap-4 sm:grid-cols-3"
      data-testid="financas-base"
    >
      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">{t("Contas e cartões")}</p>
        <p className="text-2xl font-semibold">{contas.filter((c) => c.ativa).length}</p>
        <p className="text-xs text-muted-foreground">{contas.map((c) => c.nome).join(" · ")}</p>
      </div>
      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">{t("Categorias")}</p>
        <p className="text-2xl font-semibold">
          {categorias.filter((c) => c.ativa && grupoVisivel(c)).length}
        </p>
      </div>
      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">{t("Teto de gastos do mês")}</p>
        <p className="text-2xl font-semibold">
          {config.teto_padrao_cents > 0
            ? formatCentsBRL(config.teto_padrao_cents)
            : t("Não definido")}
        </p>
      </div>
    </section>
  );
}
