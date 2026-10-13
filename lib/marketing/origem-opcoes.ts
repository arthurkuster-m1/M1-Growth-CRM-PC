/**
 * AS OPÇÕES DE ORIGEM em cascata: campanha → conjunto → anúncio → página (puxada do anúncio) e os
 * posicionamentos. Puro: recebe as linhas já lidas do banco e monta a árvore.
 */
export const POSICIONAMENTOS = [
  "Facebook Feed",
  "Facebook Stories",
  "Facebook Reels",
  "Facebook Marketplace",
  "Instagram Feed",
  "Instagram Stories",
  "Instagram Reels",
  "Instagram Explorar",
  "Messenger",
  "Audience Network",
  "Pesquisa",
  "Outro",
] as const;

/**
 * As FONTES de origem de fábrica (de onde a pessoa veio, mesmo sem campanha de anúncio). A
 * organização soma as que já usou (uma extração de leads, um evento…) — ver `fontesDeOrigem`.
 */
export const FONTES_DE_FABRICA = [
  "Meta Ads",
  "Google Ads",
  "Instagram",
  "Facebook",
  "WhatsApp",
  "Site",
  "Indicação",
  "Base de clientes",
  "Extração de leads",
  "Evento",
  "Prospecção ativa",
] as const;

/** Valores técnicos de `source` que não são uma fonte que a pessoa escolheria. */
const FONTES_TECNICAS = new Set([
  "manual",
  "webhook",
  "importacao_planilha",
  "import_csv",
  "whatsapp_inbound",
  "inbound",
  "api",
  "mcp",
  "reativacao",
]);

/** A lista de fontes: as de fábrica + as que a organização já usou, sem repetir. */
export function fontesDeOrigem(usadas: ReadonlyArray<string | null | undefined>): string[] {
  const vistas = new Set<string>();
  const saida: string[] = [];
  const somar = (bruta: string) => {
    const nome = bruta.trim();
    const chave = nome.toLowerCase();
    if (!nome || nome.length > 60 || vistas.has(chave) || FONTES_TECNICAS.has(chave)) return;
    vistas.add(chave);
    saida.push(nome);
  };
  for (const f of FONTES_DE_FABRICA) somar(f);
  for (const u of usadas) if (typeof u === "string") somar(u);
  return saida;
}

export interface PaginaOpcao {
  id: string;
  nome: string;
}
export interface AnuncioOpcao {
  id: string;
  nome: string;
  ad_id: string | null;
  pagina: PaginaOpcao | null;
}
export interface ConjuntoOpcao {
  id: string;
  nome: string;
  anuncios: AnuncioOpcao[];
}
export interface CampanhaOpcao {
  id: string;
  nome: string;
  conjuntos: ConjuntoOpcao[];
  /** Anúncios sem conjunto conhecido (cadastrados à mão). */
  anuncios_soltos: AnuncioOpcao[];
  paginas: PaginaOpcao[];
}

/** Endereço comparável: sem esquema, sem `www.`, sem query, sem barra final, em minúsculas. */
export function enderecoComparavel(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function montarOpcoesDeOrigem(entrada: {
  campanhas: Array<{ id: string; name: string; platform_campaigns: Array<{ id: string | null }> }>;
  criativos: Array<{
    id: string;
    name: string;
    campaign_id: string;
    ad_id: string | null;
    link_url: string;
  }>;
  paginas: Array<{ id: string; name: string; campaign_id: string; url: string }>;
  /** ad_id → conjunto, da base diária por anúncio. */
  anuncioNoConjunto: Array<{ ad_id: string; adset_id: string; adset_name: string; campaign_id: string }>;
  /** Cadastro dos conjuntos (aparecem mesmo sem entrega). */
  conjuntos: Array<{ adset_id: string; name: string; campaign_id: string }>;
}): CampanhaOpcao[] {
  const conjuntoDoAd = new Map<string, { id: string; nome: string }>();
  for (const l of entrada.anuncioNoConjunto) {
    if (l.ad_id && l.adset_id) conjuntoDoAd.set(l.ad_id, { id: l.adset_id, nome: l.adset_name });
  }
  const nomeDoConjunto = new Map<string, string>();
  for (const c of entrada.conjuntos) nomeDoConjunto.set(c.adset_id, c.name);

  return entrada.campanhas.map((c) => {
    const idsPlataforma = new Set(
      c.platform_campaigns.map((p) => p.id).filter((x): x is string => Boolean(x)),
    );
    const paginas = entrada.paginas
      .filter((p) => p.campaign_id === c.id)
      .map((p) => ({ id: p.id, nome: p.name, url: p.url }));
    const unicaPagina = paginas.length === 1 ? paginas[0]! : null;
    const paginaDe = (link: string): PaginaOpcao | null => {
      const alvo = enderecoComparavel(link);
      const achada = alvo ? paginas.find((p) => enderecoComparavel(p.url) === alvo) : undefined;
      const escolhida = achada ?? unicaPagina;
      return escolhida ? { id: escolhida.id, nome: escolhida.nome } : null;
    };
    const anuncios = entrada.criativos
      .filter((k) => k.campaign_id === c.id)
      .map((k): AnuncioOpcao & { conjuntoId: string | null } => ({
        id: k.id,
        nome: k.name,
        ad_id: k.ad_id,
        pagina: paginaDe(k.link_url),
        conjuntoId: k.ad_id ? (conjuntoDoAd.get(k.ad_id)?.id ?? null) : null,
      }));

    const conjuntos = new Map<string, ConjuntoOpcao>();
    for (const l of entrada.anuncioNoConjunto) {
      if (!idsPlataforma.has(l.campaign_id) || !l.adset_id) continue;
      if (!conjuntos.has(l.adset_id)) {
        conjuntos.set(l.adset_id, {
          id: l.adset_id,
          nome: nomeDoConjunto.get(l.adset_id) ?? l.adset_name ?? l.adset_id,
          anuncios: [],
        });
      }
    }
    for (const k of entrada.conjuntos) {
      if (!idsPlataforma.has(k.campaign_id)) continue;
      if (!conjuntos.has(k.adset_id)) {
        conjuntos.set(k.adset_id, { id: k.adset_id, nome: k.name, anuncios: [] });
      }
    }
    const soltos: AnuncioOpcao[] = [];
    for (const a of anuncios) {
      const { conjuntoId, ...opcao } = a;
      const alvo = conjuntoId ? conjuntos.get(conjuntoId) : undefined;
      if (alvo) alvo.anuncios.push(opcao);
      else soltos.push(opcao);
    }
    return {
      id: c.id,
      nome: c.name,
      conjuntos: [...conjuntos.values()].sort((x, y) => x.nome.localeCompare(y.nome)),
      anuncios_soltos: soltos,
      paginas: paginas.map(({ id, nome }) => ({ id, nome })),
    };
  });
}
