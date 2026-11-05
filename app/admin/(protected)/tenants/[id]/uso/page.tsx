import { UsoDaEmpresa } from "@/components/admin/tenants/UsoDaEmpresa";

export default async function TenantUsoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UsoDaEmpresa id={id} />;
}
