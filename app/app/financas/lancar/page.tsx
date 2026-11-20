import type { Metadata } from "next";

import { Lancar } from "@/components/financas/telas/Lancar";

export const metadata: Metadata = { title: "Finanças · Lançar" };

export default function Pagina() {
  return <Lancar />;
}
