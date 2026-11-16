/**
 * A ORIGEM de cada lead importado (campanha → anúncio → landing page), decidida num lugar só
 * para a revisão da tela e a gravação do servidor dizerem a mesma coisa.
 *
 * A campanha e o anúncio só são ligados se já existirem (casados pelo nome). A LANDING PAGE
 * é diferente: se o nome não estiver cadastrado, ela é CADASTRADA na hora — dentro da campanha da
 * linha (criada, se também não existir) ou, sem campanha na linha, numa campanha chamada
 * "Importação de leads". Antes disso o lead ficava só com o texto da LP, sem vínculo nenhum.
 */
import { chaveDoLink } from "@/lib/marketing/landing-pages";

export const CAMPANHA_PADRAO_DAS_LPS = "Importação de leads";

export const semAcento = (x: string) =>
  x
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

export interface CatalogoDeOrigem {
  campanhas: Array<{ id: string; name: string }>;
  criativos: Array<{ id: string; name: string; campaign_id: string }>;
  paginas: Array<{ id: string; name: string; url?: string | null; campaign_id: string }>;
}

export interface PlanoDeOrigem {
  campanhaId: string | null;
  criativoId: string | null;
  paginaId: string | null;
  /** LP que ainda não existe e será cadastrada (nome e link, se a célula trouxe um link). */
  paginaNova: { nome: string; url: string } | null;
  /** Campanha que ainda não existe e será criada para abrigar a LP nova (nome exato). */
  campanhaNova: string | null;
  /** O nome da campanha onde a LP nova vai ficar (existente ou nova), para a revisão. */
  campanhaDaLp: string | null;
}

const ehLink = (x: string) => /^https?:\/\/\S+$/i.test(x.trim());

export function planejarOrigem(
  l: { campanha: string | null; anuncio: string | null; landing_page: string | null },
  cat: CatalogoDeOrigem,
): PlanoDeOrigem {
  const campanha = l.campanha
    ? cat.campanhas.find((c) => semAcento(c.name) === semAcento(l.campanha!))
    : undefined;
  const campanhaId = campanha?.id ?? null;
  const criativo = l.anuncio
    ? cat.criativos.find(
        (c) =>
          semAcento(c.name) === semAcento(l.anuncio!) &&
          (!campanhaId || c.campaign_id === campanhaId),
      )
    : undefined;

  const plano: PlanoDeOrigem = {
    campanhaId: campanhaId ?? criativo?.campaign_id ?? null,
    criativoId: criativo?.id ?? null,
    paginaId: null,
    paginaNova: null,
    campanhaNova: null,
    campanhaDaLp: null,
  };
  if (!l.landing_page) return plano;

  const texto = l.landing_page.trim();
  const link = ehLink(texto);
  const pagina = cat.paginas.find(
    (p) =>
      (semAcento(p.name) === semAcento(texto) ||
        (link && !!p.url && chaveDoLink(p.url) === chaveDoLink(texto))) &&
      (!campanhaId || p.campaign_id === campanhaId),
  );
  if (pagina) {
    plano.paginaId = pagina.id;
    plano.campanhaId = plano.campanhaId ?? pagina.campaign_id;
    return plano;
  }

  // Não existe: será cadastrada. Sem link, o nome é o texto; com link, o nome é o endereço.
  plano.paginaNova = {
    nome: (link ? chaveDoLink(texto) : texto).slice(0, 160),
    url: link ? texto : "",
  };
  if (plano.campanhaId) {
    plano.campanhaDaLp = cat.campanhas.find((c) => c.id === plano.campanhaId)?.name ?? null;
  } else {
    const nome = (l.campanha?.trim() || CAMPANHA_PADRAO_DAS_LPS).slice(0, 160);
    const existente = cat.campanhas.find((c) => semAcento(c.name) === semAcento(nome));
    if (existente) {
      plano.campanhaId = existente.id;
      plano.campanhaDaLp = existente.name;
    } else {
      plano.campanhaNova = nome;
      plano.campanhaDaLp = nome;
    }
  }
  return plano;
}
