import { CorDaOrganizacao } from "@/components/agencia/CorDaOrganizacao";
import { ConfiguracoesDaEmpresa } from "@/components/admin/tenants/ConfiguracoesDaEmpresa";
import { corDoCliente, ehHexValido } from "@/lib/agencia/cor-do-cliente";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function TenantConfiguracoesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // A cor da empresa no Modo agência (só a agência vê; o cliente nunca).
  const { data } = await createAdminClient()
    .from("organizations")
    .select("display_name, cor:settings->>agencia_cor")
    .eq("id", id)
    .maybeSingle();
  const row = data as { display_name: string; cor: string | null } | null;
  return (
    <div className="space-y-4">
      {row ? (
        <CorDaOrganizacao
          orgId={id}
          nome={row.display_name}
          cor={corDoCliente(row.cor, id)}
          escolhida={ehHexValido(row.cor)}
        />
      ) : null}
      <ConfiguracoesDaEmpresa id={id} />
    </div>
  );
}
