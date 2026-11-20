import type { Metadata } from "next";

import { VisaoGeralEmBreve } from "@/components/financas/VisaoGeralEmBreve";

export const metadata: Metadata = { title: "Finanças" };

/** A Visão geral (F5) ainda não existe: por enquanto mostra a base carregada. */
export default function FinancasPage() {
  return <VisaoGeralEmBreve />;
}
