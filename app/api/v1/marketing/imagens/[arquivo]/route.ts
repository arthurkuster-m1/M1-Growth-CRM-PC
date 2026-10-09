/**
 * GET /api/v1/marketing/imagens/<arquivo> — a imagem de uma página, para quem está logado na
 * empresa (a agência editando e o cliente viewer lendo). A empresa vem da SESSÃO.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { entregarImagem } from "@/lib/marketing/entregar-imagem";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ arquivo: string }> },
): Promise<Response> {
  const authz = await requireRole("viewer", {
    requestId: randomUUID(),
    resource: "marketing_pages",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;
  return entregarImagem(authz.org.orgId, (await params).arquivo, "private");
}
