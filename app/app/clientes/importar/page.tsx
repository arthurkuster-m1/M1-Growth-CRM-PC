import type { Metadata } from "next";
import { Suspense } from "react";

import { ImportarLeadsPagina } from "@/components/clientes/importar/ImportarLeadsPagina";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Importar leads" };

/** Importar leads em massa: a grade estilo Excel (a mesma da importação de veículos da frota). */
export default function ImportarLeadsPage() {
  return (
    <Suspense fallback={null}>
      <ImportarLeadsPagina />
    </Suspense>
  );
}
