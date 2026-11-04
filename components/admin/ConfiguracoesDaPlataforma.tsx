"use client";
import Link from "next/link";

import { useT } from "@/hooks/i18n/useT";
import { ITENS_DE_CONFIGURACAO } from "@/lib/admin/configuracoes";

/** A página "Configurações": uma porta para cada tela de configuração da instalação. */
export function ConfiguracoesDaPlataforma() {
  const t = useT();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Configurações")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Ajustes da instalação inteira, não de uma empresa só.")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ITENS_DE_CONFIGURACAO.map(({ href, label, descricao, icon: Icone }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary/40"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-text-muted">
              <Icone size={20} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{t(label)}</span>
              <span className="block text-xs text-text-muted">{t(descricao)}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
