import { redirect } from "next/navigation";

import { loadOnboardingState } from "@/app/actions/onboarding/_shared";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { resumoDoOnboarding } from "@/lib/onboarding/passos";

import { DoneClient } from "./_client";

export const dynamic = "force-dynamic";

/**
 * O fim do onboarding novo: um resumo do que foi feito (Seu negócio, Sua equipe) e as quatro telas do dia a dia.
 * O resumo sai da MESMA lista que decide a ordem e desenha o indicador (`lib/onboarding/passos.ts`).
 */
export default async function DonePage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/login");

  const { state } = await loadOnboardingState(activeOrg.orgId);
  return <DoneClient itens={resumoDoOnboarding(state, {})} />;
}
