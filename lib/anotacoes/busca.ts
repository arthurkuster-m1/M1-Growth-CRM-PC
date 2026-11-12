/**
 * A BUSCA das anotações: o texto do documento do editor, achatado e sem acento, para o banco
 * procurar com `ilike`. O mesmo "sem acento" vale na gravação (aqui) e na consulta (aqui), e é o
 * mesmo mapa da migration 0687 — por isso é uma tabela explícita e não `normalize("NFD")`.
 */
const COM_ACENTO = "áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ";
const SEM_ACENTO = "aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn";

const MAPA = new Map([...COM_ACENTO].map((c, i) => [c, SEM_ACENTO[i]!]));

/** Minúsculas e sem acento, com o mesmo comprimento do texto original (para achar o trecho certo). */
export function dobrar(texto: string): string {
  let saida = "";
  for (const c of texto) saida += MAPA.get(c) ?? c;
  return saida.toLowerCase();
}

/** O texto que a pessoa digitou na busca, pronto para ir ao `ilike` (sem os caracteres que quebram o filtro). */
export function termoDeBusca(bruto: string): string {
  return dobrar(bruto)
    .replace(/[%_\\,()*"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export const TETO_DO_TEXTO_DE_BUSCA = 200_000;

function textoDoInline(item: unknown, saida: string[]): void {
  if (typeof item === "string") {
    saida.push(item);
    return;
  }
  if (Array.isArray(item)) {
    for (const filho of item) textoDoInline(filho, saida);
    return;
  }
  if (typeof item !== "object" || item === null) return;
  const i = item as { text?: unknown; content?: unknown };
  if (typeof i.text === "string") saida.push(i.text);
  if (Array.isArray(i.content)) for (const filho of i.content) textoDoInline(filho, saida);
}

function textoDosDados(bruto: unknown, saida: string[]): void {
  if (typeof bruto !== "string") return;
  try {
    const valor: unknown = JSON.parse(bruto);
    const anda = (v: unknown): void => {
      if (typeof v === "string") saida.push(v);
      else if (Array.isArray(v)) v.forEach(anda);
      else if (typeof v === "object" && v !== null) Object.values(v).forEach(anda);
    };
    anda(valor);
  } catch {
    // dado ruim não entra na busca
  }
}

/** O texto corrido do documento: parágrafos, títulos, listas, células de tabela e blocos visuais. */
export function textoDoDocumento(documento: readonly unknown[]): string {
  const partes: string[] = [];
  const anda = (blocos: readonly unknown[]) => {
    for (const b of blocos) {
      if (typeof b !== "object" || b === null) continue;
      const bloco = b as { content?: unknown; props?: { dados?: unknown }; children?: unknown };
      const linha: string[] = [];
      const c = bloco.content;
      if (Array.isArray(c)) {
        for (const item of c) textoDoInline(item, linha);
      } else if (typeof c === "object" && c !== null) {
        // Tabela: { type: "tableContent", rows: [{ cells: [ [inline] | { content: [inline] } ] }] }
        const linhas = (c as { rows?: unknown }).rows;
        if (Array.isArray(linhas)) {
          for (const l of linhas) {
            const celulas = (l as { cells?: unknown }).cells;
            if (Array.isArray(celulas)) for (const cel of celulas) textoDoInline(cel, linha);
          }
        }
      }
      textoDosDados(bloco.props?.dados, linha);
      if (linha.length) partes.push(linha.join(" "));
      if (Array.isArray(bloco.children)) anda(bloco.children);
    }
  };
  anda(documento);
  return partes.join("\n").slice(0, TETO_DO_TEXTO_DE_BUSCA);
}

/** Os três campos de busca de uma página, a partir do título e do documento. */
export function camposDeBusca(titulo: string, documento: readonly unknown[]) {
  const texto = textoDoDocumento(documento);
  return {
    search_text: texto,
    search_fold: dobrar(texto),
    title_fold: dobrar(titulo).slice(0, 400),
  };
}

/** Um trecho do texto em volta do primeiro lugar onde o termo aparece. */
export function trechoDaBusca(texto: string, termo: string, raio = 60): string {
  const i = dobrar(texto).indexOf(termo);
  if (i < 0)
    return texto
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, raio * 2);
  const inicio = Math.max(0, i - raio);
  const fim = Math.min(texto.length, i + termo.length + raio);
  const corte = texto.slice(inicio, fim).replace(/\s+/g, " ").trim();
  return `${inicio > 0 ? "…" : ""}${corte}${fim < texto.length ? "…" : ""}`;
}
