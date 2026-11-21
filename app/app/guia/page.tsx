import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";

import { GuiaTela } from "./_tela";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Guia" };

/**
 * GUIA — o "cônsul" de cada empresa (docs/PLANO-GUIA-M1.md). G1: tela PROVISÓRIA que mostra o
 * diagnóstico do mapa de marketing (o que está pronto, o que falta, os próximos passos) para um
 * perfil escolhido na própria tela. A G2 traz o perfil gravado, o menu lateral e as ações.
 *
 * Só gerente ou acima (agência); a rota de leitura repete o piso.
 */
export default async function GuiaPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const plataforma = user.is_platform_admin && !user.support;
  if (!plataforma && ROLE_RANK[org.role] < ROLE_RANK.manager) redirect("/app");

  const t = (texto: string) => traduzir(texto, user.idioma);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:px-8 sm:py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Guia")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("O que já está pronto no marketing da empresa, o que falta e o próximo passo.")}
        </p>
      </header>
      <GuiaTela />
    </div>
  );
}
