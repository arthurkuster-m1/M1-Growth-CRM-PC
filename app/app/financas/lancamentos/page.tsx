import type { Metadata } from "next";

import { Lancamentos } from "@/components/financas/telas/Lancamentos";

export const metadata: Metadata = { title: "Finanças · Lançamentos" };

export default function Pagina() {
  return <Lancamentos />;
}
