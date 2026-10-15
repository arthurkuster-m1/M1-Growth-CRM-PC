import type { Metadata } from "next";
import { Suspense } from "react";

import { PaginaDoCRM } from "@/components/clientes/PaginaDoCRM";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "CRM" };

/** CRM: clientes, oportunidades (por funil) e vendas (pagamentos e parcelas) numa página só. */
export default function CrmPage() {
  return (
    <Suspense fallback={null}>
      <PaginaDoCRM />
    </Suspense>
  );
}
