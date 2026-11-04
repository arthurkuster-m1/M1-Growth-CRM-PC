import { EquipeDaEmpresa } from "@/components/admin/tenants/EquipeDaEmpresa";

export default async function TenantTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EquipeDaEmpresa id={id} />;
}
