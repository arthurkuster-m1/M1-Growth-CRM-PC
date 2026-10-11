/**
 * POST /api/v1/demand-campaigns/[id]/landing-pages/[lpId]/check-embed
 *
 * Confere se a LP deixa o painel mostrá-la dentro de um `<iframe>` (pré-visualização): lê os
 * cabeçalhos `X-Frame-Options` e `Content-Security-Policy` da página. Só olha o link JÁ
 * cadastrado na LP (nunca um endereço vindo do pedido), recusa destinos internos (anti-SSRF) e
 * segue no máximo 3 redirecionamentos, conferindo cada salto.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { assertDestinoResolvidoSeguro } from "@/lib/automation/outbound-ip";
import { assertSafeOutboundUrl } from "@/lib/automation/outbound-url";
import { env } from "@/lib/env";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";
import { analisarCabecalhosDeEmbed, origemDe } from "@/lib/marketing/embed-da-lp";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
type Ctx = { params: Promise<{ id: string; lpId: string }> };

const uuid = z.string().uuid();

async function lerCabecalhos(inicial: string): Promise<{ headers: Headers; status: number }> {
  let url = inicial;
  for (let salto = 0; salto < 4; salto++) {
    assertSafeOutboundUrl(url);
    await assertDestinoResolvidoSeguro(new URL(url).hostname);
    const resposta = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": "Mozilla/5.0 (compatible; M1PreviewCheck/1.0)" },
      signal: AbortSignal.timeout(8_000),
    });
    // Não lemos o corpo: só os cabeçalhos importam.
    void resposta.body?.cancel().catch(() => undefined);
    const destino = resposta.headers.get("location");
    if (resposta.status >= 300 && resposta.status < 400 && destino) {
      url = new URL(destino, url).toString();
      continue;
    }
    return { headers: resposta.headers, status: resposta.status };
  }
  throw new Error("redirecionamentos demais");
}

export async function POST(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const a = await autorizarCampanhas("manager", false);
  if (!a.ok) return a.response;
  const { id, lpId } = await ctx.params;
  if (!uuid.safeParse(id).success || !uuid.safeParse(lpId).success) {
    return campanhaNaoEncontrada(a.t, a.requestId);
  }
  const { data: lp } = await a.supabase
    .from("demand_campaign_landing_pages")
    .select("url")
    .eq("id", lpId)
    .eq("campaign_id", id)
    .eq("organization_id", a.orgId)
    .maybeSingle();
  const url = (lp?.url as string | undefined) ?? "";
  if (!lp || !/^https?:\/\//i.test(url)) {
    return fail("validation_failed", a.t("Cadastre o link da landing page primeiro."), 422, {
      requestId: a.requestId,
    });
  }

  const origemDoPainel = origemDe(env.NEXT_PUBLIC_APP_URL) ?? env.NEXT_PUBLIC_APP_URL;
  try {
    const { headers, status } = await lerCabecalhos(url);
    const veredito = analisarCabecalhosDeEmbed(headers, origemDoPainel);
    return ok(
      { ...veredito, origem_do_painel: origemDoPainel, status_http: status },
      { requestId: a.requestId },
    );
  } catch (e) {
    return ok(
      {
        pode: null,
        motivo: "nao_foi_possivel_verificar",
        detalhe: e instanceof Error ? e.message : "falha de rede",
        origem_do_painel: origemDoPainel,
        status_http: null,
      },
      { requestId: a.requestId },
    );
  }
}
