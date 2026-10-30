import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** O Meta Ads virou uma aba de Conexões, ao lado de Webhooks; o endereço antigo leva para lá. */
export default function MetaAdsSettingsPage(): never {
  redirect("/app/connections?aba=meta-ads");
}
