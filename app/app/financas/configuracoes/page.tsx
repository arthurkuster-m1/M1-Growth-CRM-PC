import type { Metadata } from "next";

import { Configuracoes } from "@/components/financas/telas/Configuracoes";

export const metadata: Metadata = { title: "Finanças · Configurações" };

export default function Pagina() {
  return <Configuracoes />;
}
