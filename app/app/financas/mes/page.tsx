import type { Metadata } from "next";

import { Mes } from "@/components/financas/telas/Mes";

export const metadata: Metadata = { title: "Finanças · Mês" };

export default function Pagina() {
  return <Mes />;
}
