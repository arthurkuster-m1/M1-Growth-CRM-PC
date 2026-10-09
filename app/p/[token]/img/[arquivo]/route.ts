/**
 * GET /p/<token>/img/<arquivo> — a imagem de uma página, para quem tem o LINK (sem login).
 * A empresa vem do link; link inexistente, revogado ou vencido é 404, como a própria página.
 */
import { headers } from "next/headers";
import { type NextRequest } from "next/server";

import { entregarImagem } from "@/lib/marketing/entregar-imagem";
import { acessoPermitido, resolverLink } from "@/lib/marketing/publico";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; arquivo: string }> },
): Promise<Response> {
  const { token, arquivo } = await params;
  const cabecalhos = await headers();
  const ip = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await acessoPermitido(ip))) return new Response(null, { status: 429 });

  const link = await resolverLink(token);
  if (!link) return new Response(null, { status: 404 });
  return entregarImagem(link.organizationId, arquivo, "private");
}
