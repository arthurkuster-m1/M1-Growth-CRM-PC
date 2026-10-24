import type { Metadata } from "next";

import { NovaCampanha } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Novo disparo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NovaCampanhaPage({
  searchParams,
}: {
  searchParams: Promise<{ campanha?: string }>;
}) {
  // Vindo da aba Disparos de uma campanha de prospecção: o disparo nasce dentro dela.
  const { campanha } = await searchParams;
  return <NovaCampanha campanhaId={campanha && UUID.test(campanha) ? campanha : undefined} />;
}
