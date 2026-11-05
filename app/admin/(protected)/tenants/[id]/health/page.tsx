import { redirect } from "next/navigation";

// A saúde virou o primeiro bloco da Visão Geral da empresa; este endereço antigo leva para lá.
export default async function TenantHealthRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  redirect(`/admin/tenants/${(await params).id}`);
}
