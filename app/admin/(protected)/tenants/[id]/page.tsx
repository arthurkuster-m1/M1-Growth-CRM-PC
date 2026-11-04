import { VisaoGeralDaEmpresa } from "@/components/admin/tenants/VisaoGeralDaEmpresa";

interface TenantDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantDetailPage({ params }: TenantDetailPageProps) {
  const { id } = await params;
  return <VisaoGeralDaEmpresa id={id} />;
}
