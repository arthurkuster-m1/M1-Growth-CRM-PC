import type { Metadata } from "next";

import { NovaCampanha } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Novo disparo" };

export default function NovaCampanhaPage() {
  return <NovaCampanha />;
}
