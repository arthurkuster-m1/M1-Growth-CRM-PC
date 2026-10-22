import type { Metadata } from "next";

import { requireAuth } from "@/lib/auth/server";

import { DesignSystemClient } from "./_components/DesignSystemClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Design System" };

/**
 * DESIGN SYSTEM: a página de referência visual do app. Cada peça aparece aqui no estado real
 * (são os componentes do produto, não imagens), e o que está aqui é a regra para as telas.
 * Qualquer pessoa logada pode ver; não entra no menu (é uma página de consulta).
 */
export default async function DesignSystemPage() {
  await requireAuth();
  return <DesignSystemClient />;
}
