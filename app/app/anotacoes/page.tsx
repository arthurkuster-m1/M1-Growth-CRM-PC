import type { Metadata } from "next";
import { Suspense } from "react";

import { Anotacoes } from "@/components/anotacoes/Anotacoes";
import { requireAuth } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Anotações" };

/**
 * Anotações da empresa: o bloco de notas da agência sobre este cliente, em páginas e subpáginas.
 * A agência escreve; o cliente só lê as páginas que foram liberadas para ele.
 */
export default async function AnotacoesPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-5 p-4 sm:px-8 sm:py-6 2xl:px-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Anotações")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Informações importantes e ideias para revisitar, organizadas em páginas.")}
        </p>
      </header>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-secondary" />}>
        <Anotacoes />
      </Suspense>
    </div>
  );
}
