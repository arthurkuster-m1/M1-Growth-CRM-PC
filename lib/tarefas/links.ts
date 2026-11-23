/**
 * Links dentro do texto da descrição. O editor mostra cada endereço como uma "menção" (um chip
 * clicável, como no Notion) quando o bloco não está sendo editado; este arquivo só sabe PARTIR o
 * texto e DAR NOME ao link — não busca nada na internet (nada de título de página nem favicon).
 */

export type Segmento = { tipo: "texto"; valor: string } | { tipo: "link"; valor: string };

const REGRA_DE_LINK = /https?:\/\/[^\s<>"']+/gi;

/** Tira do fim do link a pontuação da frase ("veja https://x.com/a.") e o ")" que não abriu. */
function aparar(url: string): { link: string; resto: string } {
  let link = url;
  for (;;) {
    const ultimo = link.at(-1);
    if (!ultimo) break;
    if (".,;:!?]}".includes(ultimo) || (ultimo === ")" && !link.includes("("))) {
      link = link.slice(0, -1);
      continue;
    }
    break;
  }
  return { link, resto: url.slice(link.length) };
}

/** Parte o texto em pedaços de texto e de link, na ordem em que aparecem. */
export function partirEmLinks(texto: string): Segmento[] {
  const saida: Segmento[] = [];
  let cursor = 0;
  for (const achado of texto.matchAll(REGRA_DE_LINK)) {
    const inicio = achado.index ?? 0;
    const { link } = aparar(achado[0]);
    // "https://" sozinho (sem endereço depois) não é link.
    if (!/^https?:\/\/[^/\s]+/i.test(link)) continue;
    if (inicio > cursor) saida.push({ tipo: "texto", valor: texto.slice(cursor, inicio) });
    saida.push({ tipo: "link", valor: link });
    cursor = inicio + link.length;
  }
  if (cursor < texto.length) saida.push({ tipo: "texto", valor: texto.slice(cursor) });
  return saida;
}

export function temLink(texto: string): boolean {
  return partirEmLinks(texto).some((s) => s.tipo === "link");
}

const SITES: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)(notion\.so|notion\.site)$/, "Notion"],
  [/^drive\.google\.com$/, "Google Drive"],
  [/(^|\.)figma\.com$/, "Figma"],
  [/(^|\.)canva\.com$/, "Canva"],
  [/(^|\.)loom\.com$/, "Loom"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)facebook\.com$/, "Facebook"],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "WhatsApp"],
  [/(^|\.)github\.com$/, "GitHub"],
  [/(^|\.)claude\.ai$/, "Claude"],
  [/(^|\.)(chatgpt\.com|chat\.openai\.com)$/, "ChatGPT"],
];

const PEDACOS_DO_GOOGLE: [string, string][] = [
  ["/document", "Google Docs"],
  ["/spreadsheets", "Google Sheets"],
  ["/presentation", "Google Slides"],
  ["/forms", "Google Forms"],
];

export interface RotuloDoLink {
  /** O nome do site ("Instagram"), ou o endereço sem "www." quando não é um conhecido. */
  site: string;
  /** O caminho curto depois do site ("/p/DaLmczvFKMk"), vazio na página inicial. */
  detalhe: string;
}

/** O nome que o chip mostra no lugar do endereço comprido. Nunca lança. */
export function rotuloDoLink(url: string): RotuloDoLink {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    let site = host;
    if (host === "docs.google.com") {
      site = PEDACOS_DO_GOOGLE.find(([p]) => u.pathname.startsWith(p))?.[1] ?? "Google Docs";
    } else {
      site = SITES.find(([regra]) => regra.test(host))?.[1] ?? host;
    }
    const caminho = u.pathname.replace(/\/+$/, "");
    const detalhe = caminho.length > 1 ? decodeURIComponentSeguro(caminho) : "";
    return { site, detalhe };
  } catch {
    return { site: url, detalhe: "" };
  }
}

function decodeURIComponentSeguro(texto: string): string {
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto;
  }
}
