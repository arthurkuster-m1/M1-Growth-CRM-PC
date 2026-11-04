"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { EmpresasDoModoAgencia } from "@/components/admin/tenants/EmpresasDoModoAgencia";
import { NovaEmpresaDialog } from "@/components/admin/tenants/NovaEmpresaDialog";

export function TenantsClient({ selecionados = [] }: { selecionados?: string[] }) {
  const router = useRouter();
  // `/admin/tenants?nova=1` (o antigo /admin/tenants/new) abre o popup direto.
  const [aberto, setAberto] = useState(useSearchParams().get("nova") === "1");
  return (
    <>
      <EmpresasDoModoAgencia selecionados={selecionados} aoNovaEmpresa={() => setAberto(true)} />
      <NovaEmpresaDialog
        aberto={aberto}
        aoFechar={() => {
          setAberto(false);
          router.replace("/admin/tenants");
        }}
      />
    </>
  );
}
