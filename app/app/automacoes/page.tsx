import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { AI_DECIDE_PADRAO, CHAVE_DAS_AUTOMACOES } from "@/lib/automation/ai-decide-da-org";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";
import { AutomacoesClient } from "./_components/AutomacoesClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Automações" };

/**
 * A CENTRAL DE AUTOMAÇÕES: o lugar único para criar e acompanhar tudo o que o sistema faz sozinho
 * (regras de lead, tags, tarefas, mensagens, webhooks), com a porta para os follow-ups da IA e o
 * freio do passo "a IA decide". Quem monta regra é gerente em diante.
 */
export default async function AutomacoesPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!(user.is_platform_admin && !user.support) && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }
  const t = (texto: string) => traduzir(texto, user.idioma);

  // O freio do passo "a IA decide" mora na aba Ajustes. A régua é a do leitor de runtime: só um
  // `false` gravado desliga; ausente ou lixo mostra LIGADO. Erro de LEITURA vira aviso — a tela não
  // pode afirmar um estado que não leu.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .maybeSingle();
  const settings = (data?.settings ?? null) as Record<string, unknown> | null;
  const bruto = (settings?.[CHAVE_DAS_AUTOMACOES] as Record<string, unknown> | null)?.ai_decide;
  const freioDaIa = {
    ligado: typeof bruto === "boolean" ? bruto : AI_DECIDE_PADRAO,
    erroDeLeitura: Boolean(error),
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Automações")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Tudo o que o sistema faz sozinho, num lugar só: regras, tags, tarefas, mensagens e follow-ups.",
          )}
        </p>
      </header>
      <AutomacoesClient freioDaIa={freioDaIa} idioma={user.idioma} />
    </div>
  );
}
