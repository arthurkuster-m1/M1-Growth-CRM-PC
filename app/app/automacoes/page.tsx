import { FaixaEmBreve } from "@/components/shell/FaixaEmBreve";
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
    <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col gap-5 overflow-y-auto p-4 sm:p-6">
      <header className="relative overflow-hidden rounded-[22px] bg-deep p-6 text-deep-foreground shadow-md sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-accent-400/25"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-deep-foreground opacity-85">{t("Central")}</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Automações")}</h1>
            <p className="mt-2 max-w-2xl text-sm text-deep-foreground opacity-85">
              {t(
                "Tudo o que o sistema faz sozinho, num lugar só: regras, tags, tarefas, mensagens e follow-ups.",
              )}
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-white/14 px-3.5 py-1.5 text-xs font-bold text-deep-foreground">
            {t("Em breve")}
          </span>
        </div>
      </header>
      <FaixaEmBreve
        selo={t("Em breve")}
        texto={t("Esta área está em construção: pode mudar nas próximas atualizações.")}
      />
      <AutomacoesClient freioDaIa={freioDaIa} idioma={user.idioma} />
    </div>
  );
}
