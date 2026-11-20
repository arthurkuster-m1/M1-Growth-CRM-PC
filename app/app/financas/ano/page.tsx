import type { Metadata } from "next";

import { Ano } from "@/components/financas/telas/Ano";

export const metadata: Metadata = { title: "Finanças · Ano" };

export default function Pagina() {
  return <Ano />;
}
