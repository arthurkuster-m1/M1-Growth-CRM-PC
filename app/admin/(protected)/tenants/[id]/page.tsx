import { CorDaOrganizacao } from "@/components/agencia/CorDaOrganizacao";
import { corDoCliente, ehHexValido } from "@/lib/agencia/cor-do-cliente";
import { createAdminClient } from "@/lib/supabase/admin";

import { TenantOverviewClient } from "./_client";

interface TenantDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantDetailPage({ params }: TenantDetailPageProps) {
  const { id } = await params;
  // A cor da organização no Modo agência (só a agência vê; o cliente nunca).
  const { data } = await createAdminClient()
    .from("organizations")
    .select("display_name, cor:settings->>agencia_cor")
    .eq("id", id)
    .maybeSingle();
  const row = data as { display_name: string; cor: string | null } | null;
  return (
    <div className="grid gap-4">
      {row ? (
        <CorDaOrganizacao
          orgId={id}
          nome={row.display_name}
          cor={corDoCliente(row.cor, id)}
          escolhida={ehHexValido(row.cor)}
        />
      ) : null}
      <TenantOverviewClient id={id} />
    </div>
  );
}
