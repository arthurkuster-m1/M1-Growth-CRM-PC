import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";
import { ConfiguracoesDoInboxClient } from "./_components/ConfiguracoesDoInboxClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configurações do Inbox" };

export default async function ConfiguracoesDoInboxPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app/inbox");
  const t = (texto: string) => traduzir(texto, user.idioma);
  const gerente = ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager;

  return (
    <div className="flex h-full flex-col gap-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Configurações do Inbox")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Etiquetas do filtro, respostas rápidas e os números de atendimento.")}
        </p>
      </header>
      <ConfiguracoesDoInboxClient podeEditar={gerente} canShare={gerente} currentUserId={user.id} />
    </div>
  );
}
