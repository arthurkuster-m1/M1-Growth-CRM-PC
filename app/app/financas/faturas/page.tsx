import type { Metadata } from "next";

import { Faturas } from "@/components/financas/telas/Faturas";

export const metadata: Metadata = { title: "Finanças · Faturas" };

export default function Pagina() {
  return <Faturas />;
}
