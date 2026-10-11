import type { Metadata } from "next";
import { Suspense } from "react";

import { ClientesCRM } from "@/components/clientes/ClientesCRM";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clientes" };

/** Clientes: o CRM final — leads, funis, tabela e Kanban (sessão 2 do plano do CRM). */
export default function ClientesPage() {
  return (
    <Suspense fallback={null}>
      <ClientesCRM />
    </Suspense>
  );
}
