import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Anotacoes } from "@/components/anotacoes/Anotacoes";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Modo agência · Anotações" };

/**
 * MODO AGÊNCIA · Anotações: o bloco de notas da própria agência (assuntos gerais, não de um
 * cliente). Fica guardado na organização da agência — a empresa ativa — e usa a mesma tela de
 * Anotações de cada cliente.
 */
export default async function AnotacoesDaAgenciaPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const t = (texto: string) => traduzir(texto, user.idioma);

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-5 p-4 sm:px-8 sm:py-6 2xl:px-12">
      <header>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {t("Modo agência")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Anotações")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("O bloco de notas da agência: informações importantes e ideias para revisitar.")}
        </p>
      </header>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-secondary" />}>
        <Anotacoes />
      </Suspense>
    </div>
  );
}
