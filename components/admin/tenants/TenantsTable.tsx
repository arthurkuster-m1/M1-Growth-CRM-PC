"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import type { AdminTenantRow } from "@/hooks/useAdminTenants";
import { corDoCliente } from "@/lib/agencia/cor-do-cliente";
import { Buildings } from "@/lib/ui/icons";

// A lista de empresas em cartões (design system do CRM). O nome do arquivo e dos
// exports foi mantido de propósito: quem os importa não muda.

const STATUS_VARIANTS: Record<string, "success" | "info" | "warning" | "error" | "neutral"> = {
  active: "success",
  onboarding: "info",
  suspended: "warning",
  redacted: "error",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  onboarding: "Onboarding",
  suspended: "Suspenso",
  redacted: "Redigido",
};

function contagem(arr: Array<{ count: number }> | null | undefined): number {
  return arr?.[0]?.count ?? 0;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const letras = (partes.length > 1 ? [partes[0], partes[1]] : [partes[0] ?? "?"]).map(
    (p) => p?.[0] ?? "",
  );
  return letras.join("").toUpperCase().slice(0, 2);
}

export function TenantsTableSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-2xl" />
      ))}
    </div>
  );
}

function CartaoDaEmpresa({ row }: { row: AdminTenantRow }) {
  const t = useT();
  const tag = useTagDeIdioma();
  // 'onboarding' não existe no banco: é derivado (ativo sem onboarding concluído).
  const status = row.status === "active" && !row.onboarded_at ? "onboarding" : row.status;
  const cor = corDoCliente(row.cor_marca ?? row.cor_agencia, row.id);
  const pessoas = contagem(row.user_count);
  const conversas = contagem(row.conversations_count);
  return (
    <Link
      href={`/admin/tenants/${row.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary/40 focus-visible:outline-2"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: cor }}
        >
          {iniciais(row.display_name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{row.display_name}</div>
          <code className="truncate font-mono text-xs text-text-muted">{row.slug}</code>
        </div>
        <Badge variant={STATUS_VARIANTS[status] ?? "neutral"}>
          {t(STATUS_LABELS[status] ?? status)}
        </Badge>
      </div>
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>
          {pessoas} {pessoas === 1 ? t("pessoa") : t("pessoas")} · {conversas.toLocaleString(tag)}{" "}
          {conversas === 1 ? t("conversa") : t("conversas")}
        </span>
        <span>
          {new Intl.DateTimeFormat(tag, {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
          }).format(new Date(row.created_at))}
        </span>
      </div>
    </Link>
  );
}

interface TenantsTableProps {
  data: AdminTenantRow[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

export function TenantsTable({
  data,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: TenantsTableProps) {
  const t = useT();
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card py-16 text-center text-text-muted">
        <Buildings size={36} weight="duotone" className="opacity-40" aria-hidden />
        <p className="text-sm font-medium">{t("Nenhuma empresa encontrada")}</p>
        <p className="max-w-xs text-xs opacity-70">
          {t("Ajuste os filtros ou crie uma nova empresa.")}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((row) => (
          <CartaoDaEmpresa key={row.id} row={row} />
        ))}
      </div>
      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? t("Carregando...") : t("Carregar mais")}
          </Button>
        </div>
      )}
    </div>
  );
}
