import type { Metadata } from "next";

import { Geral } from "@/components/financas/telas/Geral";

export const metadata: Metadata = { title: "Finanças" };

/** A Visão geral: patrimônio, evolução, médias, alertas, contas e conferência de saldo. */
export default function FinancasPage() {
  return <Geral />;
}
