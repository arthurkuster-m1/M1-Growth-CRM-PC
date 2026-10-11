import { chaveDoLink } from "@/lib/marketing/landing-pages";

/**
 * DE QUAL CAMPANHA O LEAD VEIO — a conta pura (sem banco, sem rede), testada à parte.
 *
 * O lead chega por quatro portas (anúncio que abre o WhatsApp, formulário da landing page,
 * formulário nativo da Meta e cadastro manual) e cada uma deixa um rastro diferente. Aqui os
 * rastros viram uma resposta só: campanha, landing page e criativo.
 *
 * Ordem de confiança (a primeira que casar vence):
 *  1. a campanha dita pela própria fonte (formulário ligado a uma campanha, ou escolha manual);
 *  2. o anúncio (`ad_id`) → o criativo cadastrado → a campanha dele;
 *  3. a campanha da plataforma (`campaign_id` da Meta, ou `utm_id`/`utm_campaign` com o id) →
 *     a campanha atrelada;
 *  4. os nomes (`utm_campaign`, `utm_content`) → campanha atrelada pelo nome, criativo pelo nome;
 *  5. o endereço da página (`landing_url`) → a landing page cadastrada.
 */
export interface CampanhaParaCasar {
  id: string;
  name: string;
  pipeline_id: string | null;
  platform_campaigns: ReadonlyArray<{ id: string | null; name: string }>;
}
export interface CriativoParaCasar {
  id: string;
  campaign_id: string;
  ad_id: string | null;
  name: string;
  ad_name: string;
  link_url: string;
}
export interface LpParaCasar {
  id: string;
  campaign_id: string;
  url: string;
}

export interface SinaisDeOrigem {
  /** A campanha de demanda dita pela fonte (formulário ligado a ela, ou escolha manual). */
  campanhaDeDemandaId?: string | null;
  /** Do anúncio (CTWA, Lead Ads, UTM com {{ad.id}}). */
  adId?: string | null;
  /** Da Meta: id da campanha da plataforma (pode vir do cache da hierarquia). */
  campanhaDaPlataformaId?: string | null;
  utmId?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  /** Nome da campanha/anúncio como a plataforma o devolve. */
  nomeDaCampanha?: string | null;
  nomeDoAnuncio?: string | null;
  /** O endereço da página onde o formulário foi preenchido. */
  paginaUrl?: string | null;
}

export type ComoCasou =
  "fonte" | "anuncio" | "campanha_da_plataforma" | "nome" | "pagina" | "nenhum";

export interface OrigemCasada {
  campanhaId: string | null;
  criativoId: string | null;
  landingPageId: string | null;
  como: ComoCasou;
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
const vazio: OrigemCasada = {
  campanhaId: null,
  criativoId: null,
  landingPageId: null,
  como: "nenhum",
};

export function casarOrigemDaCampanha(
  campanhas: readonly CampanhaParaCasar[],
  criativos: readonly CriativoParaCasar[],
  lps: readonly LpParaCasar[],
  s: SinaisDeOrigem,
): OrigemCasada {
  const porId = new Map(campanhas.map((c) => [c.id, c]));
  const criativoPorAd = (adId: string) => criativos.find((c) => c.ad_id === adId) ?? null;
  const criativoPorNome = (nome: string, campanhaId?: string) =>
    criativos.find(
      (c) =>
        (!campanhaId || c.campaign_id === campanhaId) &&
        (norm(c.name) === nome || norm(c.ad_name) === nome),
    ) ?? null;
  const lpDaPagina = (campanhaId?: string): string | null => {
    if (!s.paginaUrl) return null;
    const alvo = chaveDoLink(s.paginaUrl);
    return (
      lps.find(
        (l) =>
          l.url && (!campanhaId || l.campaign_id === campanhaId) && chaveDoLink(l.url) === alvo,
      )?.id ?? null
    );
  };
  const montar = (campanhaId: string, como: ComoCasou, criativoId: string | null): OrigemCasada => {
    // A LP: a da página, ou a que o criativo aponta.
    let lp = lpDaPagina(campanhaId);
    if (!lp && criativoId) {
      const link = criativos.find((c) => c.id === criativoId)?.link_url;
      if (link)
        lp =
          lps.find((l) => l.campaign_id === campanhaId && chaveDoLink(l.url) === chaveDoLink(link))
            ?.id ?? null;
    }
    return { campanhaId, criativoId, landingPageId: lp, como };
  };

  // 1. A fonte já disse.
  if (s.campanhaDeDemandaId && porId.has(s.campanhaDeDemandaId)) {
    const c = s.adId ? criativoPorAd(s.adId) : null;
    const porNome =
      !c && s.utmContent ? criativoPorNome(norm(s.utmContent), s.campanhaDeDemandaId) : null;
    return montar(s.campanhaDeDemandaId, "fonte", (c ?? porNome)?.id ?? null);
  }

  // 2. O anúncio.
  if (s.adId) {
    const c = criativoPorAd(s.adId);
    if (c && porId.has(c.campaign_id)) return montar(c.campaign_id, "anuncio", c.id);
  }

  // 3. A campanha da plataforma, pelo id.
  const ids = [s.campanhaDaPlataformaId, s.utmId, s.utmCampaign]
    .map((v) => v?.trim())
    .filter(Boolean) as string[];
  for (const id of ids) {
    const c = campanhas.find((x) => x.platform_campaigns.some((p) => p.id === id));
    if (c) {
      const cr = s.adId
        ? criativoPorAd(s.adId)
        : s.utmContent
          ? criativoPorNome(norm(s.utmContent), c.id)
          : null;
      return montar(c.id, "campanha_da_plataforma", cr?.id ?? null);
    }
  }

  // 4. Os nomes.
  const nomes = [s.utmCampaign, s.nomeDaCampanha, s.utmTerm].map(norm).filter(Boolean);
  for (const nome of nomes) {
    const c = campanhas.find(
      (x) => norm(x.name) === nome || x.platform_campaigns.some((p) => norm(p.name) === nome),
    );
    if (c) {
      const alvo = norm(s.utmContent) || norm(s.nomeDoAnuncio);
      const cr = alvo ? criativoPorNome(alvo, c.id) : null;
      return montar(c.id, "nome", cr?.id ?? null);
    }
  }
  const alvoDoAnuncio = norm(s.utmContent) || norm(s.nomeDoAnuncio);
  if (alvoDoAnuncio) {
    const cr = criativoPorNome(alvoDoAnuncio);
    if (cr && porId.has(cr.campaign_id)) return montar(cr.campaign_id, "nome", cr.id);
  }

  // 5. A página.
  const lp = lpDaPagina();
  if (lp) {
    const l = lps.find((x) => x.id === lp)!;
    return { campanhaId: l.campaign_id, criativoId: null, landingPageId: lp, como: "pagina" };
  }
  return vazio;
}

/** Lê os sinais de origem de um payload cru de formulário (UTMs, ids da Meta, página). */
export function sinaisDoPayload(payload: Record<string, unknown>): SinaisDeOrigem {
  const baixo = new Map<string, unknown>(
    Object.entries(payload).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const texto = (...chaves: string[]): string | null => {
    for (const k of chaves) {
      const v = baixo.get(k);
      if (typeof v === "string" && v.trim() !== "") return v.trim();
      if (typeof v === "number") return String(v);
    }
    return null;
  };
  return {
    adId: texto("ad_id", "adid", "meta_ad_id", "utm_ad_id", "fbclid_ad_id"),
    campanhaDaPlataformaId: texto("campaign_id", "meta_campaign_id", "campanha_id"),
    utmId: texto("utm_id"),
    utmCampaign: texto("utm_campaign"),
    utmContent: texto("utm_content"),
    utmTerm: texto("utm_term"),
    nomeDaCampanha: texto("campaign_name", "campanha"),
    nomeDoAnuncio: texto("ad_name", "anuncio"),
    paginaUrl: texto("page_url", "pageurl", "landing_url", "url", "referrer", "form_url", "origin"),
  };
}
