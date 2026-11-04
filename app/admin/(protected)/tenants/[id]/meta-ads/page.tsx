import { redirect } from "next/navigation";

// As contas do Meta Ads moram em Conexões (junto do Google Ads); este endereço antigo leva para lá.
export default async function TenantMetaAdsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  redirect(`/admin/tenants/${(await params).id}/conexoes`);
}
