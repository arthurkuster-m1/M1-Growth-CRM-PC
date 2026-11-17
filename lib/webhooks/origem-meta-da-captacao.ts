import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import { UTM_SOURCES_DA_META } from "@/lib/conversoes/leitura-da-atribuicao";

/**
 * O LEAD QUE CHEGA POR WEBHOOK (n8n, formulário, Zapier) E VEIO DE ANÚNCIO DA META.
 *
 * Para a venda deste lead voltar à Meta (CAPI), o contato precisa carregar a origem: o ganho lê
 * `ad_platform: "site"` + `utm_source` da Meta (`lib/conversoes/leitura-da-atribuicao.ts`). Quem
 * grava isso é a mesma função de banco do código de origem da página
 * (`fn_estampar_atribuicao_de_anuncio`, regra de primeiro toque) — aqui só se DECIDE se o envio
 * veio da Meta e quais sinais ele trouxe:
 *
 *   - `utm_source` = meta / facebook / fb / instagram / ig; ou
 *   - `fbclid`, `fbc` ou `fbp` no corpo (prova de clique/navegador da Meta, mesmo sem UTM).
 *
 * Sem nada disso, o lead é orgânico e nada é gravado (não se inventa origem de anúncio).
 */
export interface OrigemMetaDaCaptacao {
  /** As UTMs do envio (`utm_*`); `utm_source` ganha "facebook" só quando veio fbclid/fbc/fbp sem UTM. */
  utm: Record<string, string>;
  fbc: string | null;
  fbp: string | null;
}

/** O valor de um campo, de topo ou aninhado (`tracking_fbclid`), sem ligar para maiúsculas. */
function campo(campos: Record<string, string>, nome: string): string | null {
  for (const [chave, valor] of Object.entries(campos)) {
    const k = chave.toLowerCase();
    if ((k === nome || k.endsWith(`_${nome}`)) && valor.trim() !== "") return valor.trim();
  }
  return null;
}

const FBC_VALIDO = /^fb\.\d\.\d{10,13}\.[A-Za-z0-9_-]{6,500}$/;
const FBP_VALIDO = /^fb\.\d\.\d{10,13}\.\d{4,20}$/;

export function origemMetaDaCaptacao(
  campos: Record<string, string>,
  utmDoEnvio: Record<string, string>,
  agoraMs: number = Date.now(),
): OrigemMetaDaCaptacao | null {
  const fbclid = campo(campos, "fbclid");
  const fbcBruto = campo(campos, "fbc");
  const fbpBruto = campo(campos, "fbp");
  // Cookie malformado não vai ao fio (a Meta ignora, e o evento perderia a chance de casar por outro sinal).
  const fbp = fbpBruto && FBP_VALIDO.test(fbpBruto) ? fbpBruto : null;
  // O `_fbc` é `fb.<subdomínio>.<instante em ms>.<fbclid>`: sem o cookie, ele se monta do `fbclid`.
  const fbc =
    fbcBruto && FBC_VALIDO.test(fbcBruto)
      ? fbcBruto
      : fbclid
        ? `fb.1.${agoraMs}.${fbclid}`.slice(0, 600)
        : null;

  const fonte = utmDoEnvio.utm_source?.trim().toLowerCase() ?? "";
  const utmDaMeta = UTM_SOURCES_DA_META.has(fonte);
  const temSinalDaMeta = Boolean(fbclid || fbcBruto || fbpBruto);
  if (!utmDaMeta && !temSinalDaMeta) return null;

  // UTM de OUTRA fonte (ex.: google) com fbclid solto: a UTM declarada vence, e não se rotula de Meta.
  if (fonte !== "" && !utmDaMeta) return null;

  const utm = { ...utmDoEnvio };
  if (!utm.utm_source) utm.utm_source = "facebook";
  return { utm, fbc, fbp };
}

/**
 * Grava a origem no contato pela função de banco que já guarda o primeiro toque. Falha silenciosa
 * por desenho: a captação do lead NUNCA pode quebrar por causa de origem.
 */
export async function estamparOrigemMetaDaCaptacao(
  admin: SupabaseClient,
  organizationId: string,
  contactId: string,
  origem: OrigemMetaDaCaptacao,
): Promise<boolean> {
  const { error } = await admin.rpc("fn_estampar_atribuicao_de_anuncio", {
    p_org: organizationId,
    p_contact: contactId,
    p_platform: "site",
    p_metadata: {
      ad_platform: "site",
      ad_source_id: null,
      origem: "webhook",
      ...origem.utm,
      ...(origem.fbc ? { meta_fbc: origem.fbc } : {}),
      ...(origem.fbp ? { meta_fbp: origem.fbp } : {}),
    },
  });
  if (error) {
    logger.warn("[webhooks.in] não estampou a origem Meta no contato", {
      organizationId,
      contactId,
      error: error.message.slice(0, 120),
    });
  }
  return !error;
}
