import type { Documento } from "@/lib/anotacoes/documento";
import { blocoSchema, NOME_DE_IMAGEM, type Bloco } from "@/lib/marketing/blocos";

/**
 * Uma página de anotação é escrita com os MESMOS blocos da Estratégia (`lib/marketing/blocos.ts`).
 * Páginas gravadas antes, no editor anterior (BlockNote: blocos com `type`), são convertidas ao
 * abrir — nada se perde: o texto, as listas, os títulos e os blocos visuais viram o bloco
 * equivalente; o que não tem par vira texto. As subpáginas deixam de ser cartões dentro do texto
 * (elas aparecem como cartões ao fim da página, pela árvore).
 */

/** Notas são longas (cada parágrafo é um bloco): o teto é bem maior que o das páginas de Marketing. */
export const MAXIMO_DE_BLOCOS_DA_NOTA = 1000;

type Cru = Record<string, unknown>;
const ehObjeto = (x: unknown): x is Cru => typeof x === "object" && x !== null && !Array.isArray(x);
const cortar = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

/** O texto de um conteúdo em linha do BlockNote, com negrito e itálico no formato do texto rico (`**`, `*`). */
function textoDoInline(conteudo: unknown): string {
  if (typeof conteudo === "string") return conteudo;
  if (!Array.isArray(conteudo)) return "";
  let saida = "";
  for (const item of conteudo) {
    if (typeof item === "string") {
      saida += item;
      continue;
    }
    if (!ehObjeto(item)) continue;
    if (item.type === "link") {
      saida += textoDoInline(item.content);
      continue;
    }
    if (typeof item.text !== "string") continue;
    let t = item.text;
    const estilos = ehObjeto(item.styles) ? item.styles : {};
    if (t.trim() !== "") {
      if (estilos.bold) t = `**${t}**`;
      else if (estilos.italic) t = `*${t}*`;
    }
    saida += t;
  }
  return saida;
}

function listaDeDados(bruto: unknown): unknown[] {
  if (typeof bruto !== "string") return [];
  try {
    const v: unknown = JSON.parse(bruto);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const txt = (x: unknown, n: number) => (typeof x === "string" ? cortar(x, n) : "");

/** As linhas de uma tabela do BlockNote: cada linha é uma lista de textos. */
function linhasDaTabela(conteudo: unknown): string[][] {
  if (!ehObjeto(conteudo) || !Array.isArray(conteudo.rows)) return [];
  return conteudo.rows.map((l) => {
    const celulas = ehObjeto(l) && Array.isArray(l.cells) ? l.cells : [];
    return celulas.map((c) => textoDoInline(ehObjeto(c) && "content" in c ? c.content : c));
  });
}

export function converterDocumentoAntigo(documento: readonly unknown[]): Bloco[] {
  const saida: unknown[] = [];
  let contador = 0;
  const novoId = () => `n${++contador}`;

  type EstiloDeLista = "marcadores" | "numerada" | "check";
  const ESTILO: Record<string, EstiloDeLista> = {
    bulletListItem: "marcadores",
    numberedListItem: "numerada",
    checkListItem: "check",
  };
  let listaAberta: { estilo: EstiloDeLista; itens: string[] } | null = null;
  const fecharLista = () => {
    if (listaAberta?.itens.length) {
      saida.push({
        id: novoId(),
        tipo: "lista",
        estilo: listaAberta.estilo,
        itens: listaAberta.itens.slice(0, 40).map((i) => cortar(i, 200)),
      });
    }
    listaAberta = null;
  };

  const anda = (blocos: readonly unknown[]) => {
    for (const b of blocos) {
      if (!ehObjeto(b)) continue;
      const tipo = typeof b.type === "string" ? b.type : "";
      const props = ehObjeto(b.props) ? b.props : {};
      const filhos = Array.isArray(b.children) ? b.children : [];
      const texto = textoDoInline(b.content);

      if (tipo in ESTILO) {
        const estilo = ESTILO[tipo]!;
        if (listaAberta && listaAberta.estilo !== estilo) fecharLista();
        listaAberta ??= { estilo, itens: [] };
        listaAberta.itens.push(texto);
        anda(filhos);
        continue;
      }
      fecharLista();

      switch (tipo) {
        case "paragraph":
        case "codeBlock":
          if (texto.trim() !== "")
            saida.push({ id: novoId(), tipo: "texto", texto: cortar(texto, 5000) });
          break;
        case "heading": {
          const nivel = Math.min(3, Math.max(1, Number(props.level) || 1));
          saida.push({ id: novoId(), tipo: "titulo", nivel, texto: cortar(texto, 200) });
          break;
        }
        case "quote":
          saida.push({ id: novoId(), tipo: "citacao", texto: cortar(texto, 1000), autor: "" });
          break;
        case "toggleListItem": {
          const corpo = filhos
            .map((f) => (ehObjeto(f) ? textoDoInline(f.content) : ""))
            .filter((x) => x.trim() !== "")
            .join("\n\n");
          saida.push({
            id: novoId(),
            tipo: "toggle",
            titulo: cortar(texto, 200),
            texto: cortar(corpo, 5000),
          });
          continue;
        }
        case "table": {
          const linhas = linhasDaTabela(b.content);
          if (!linhas.length) break;
          const colunas = Math.min(8, Math.max(1, ...linhas.map((l) => l.length)));
          const cabecalho = Array.from({ length: colunas }, (_, i) =>
            cortar(linhas[0]![i] ?? "", 60),
          );
          saida.push({
            id: novoId(),
            tipo: "tabela",
            colunas: cabecalho.map((c, i) => c || `${i + 1}`),
            linhas: linhas
              .slice(1, 41)
              .map((l) => Array.from({ length: colunas }, (_, i) => cortar(l[i] ?? "", 300))),
          });
          break;
        }
        case "image": {
          const url = typeof props.url === "string" ? props.url : "";
          const arquivo = url.split("/").pop()?.split("?")[0] ?? "";
          if (NOME_DE_IMAGEM.test(arquivo)) {
            saida.push({
              id: novoId(),
              tipo: "imagem",
              arquivo,
              legenda: cortar(txt(props.caption, 200), 200),
              largura: "grande",
              alinhamento: "centro",
            });
          }
          break;
        }
        case "destaque":
          saida.push({
            id: novoId(),
            tipo: "destaque",
            tom: props.tom === "sucesso" || props.tom === "atencao" ? props.tom : "info",
            texto: cortar(texto, 5000),
          });
          break;
        case "fluxo":
          saida.push({
            id: novoId(),
            tipo: "fluxo",
            itens: listaDeDados(props.dados)
              .filter(ehObjeto)
              .slice(0, 24)
              .map((i) => ({ titulo: txt(i.titulo, 200), texto: txt(i.texto, 200) })),
          });
          break;
        case "cartoes":
          saida.push({
            id: novoId(),
            tipo: "cards",
            itens: listaDeDados(props.dados)
              .filter(ehObjeto)
              .slice(0, 12)
              .map((i) => ({ titulo: txt(i.titulo, 200), texto: txt(i.texto, 1200) })),
          });
          break;
        case "metricas":
          saida.push({
            id: novoId(),
            tipo: "metricas",
            itens: listaDeDados(props.dados)
              .filter(ehObjeto)
              .slice(0, 8)
              .map((i) => ({ rotulo: txt(i.texto, 200), valor: txt(i.titulo, 40), detalhe: "" })),
          });
          break;
        case "matriz":
          saida.push({
            id: novoId(),
            tipo: "matriz",
            estilo: props.estilo === "neutro" ? "neutro" : "swot",
            celulas: listaDeDados(props.dados)
              .filter(ehObjeto)
              .slice(0, 4)
              .map((i) => ({ titulo: txt(i.titulo, 200), texto: txt(i.texto, 1500) })),
          });
          break;
        case "piramide":
          saida.push({
            id: novoId(),
            tipo: "piramide",
            forma: props.forma === "funil" ? "funil" : "piramide",
            itens: listaDeDados(props.dados)
              .filter((x): x is string => typeof x === "string")
              .slice(0, 8)
              .map((t) => ({ titulo: cortar(t, 200), texto: "" })),
          });
          break;
        case "subpagina":
          break;
        default:
          if (texto.trim() !== "")
            saida.push({ id: novoId(), tipo: "texto", texto: cortar(texto, 5000) });
      }
      anda(filhos);
    }
  };
  anda(documento);
  fecharLista();

  const validos: Bloco[] = [];
  for (const candidato of saida.slice(0, MAXIMO_DE_BLOCOS_DA_NOTA)) {
    const r = blocoSchema.safeParse(candidato);
    if (r.success) validos.push(r.data);
  }
  return validos;
}

/**
 * Os blocos da página para o editor: blocos no formato da Estratégia entram como estão (os
 * inválidos saem); blocos do editor antigo são convertidos. Nunca lança.
 */
export function blocosDaNota(documento: Documento | readonly unknown[]): Bloco[] {
  const saida: Bloco[] = [];
  let antigos: unknown[] = [];
  const despejar = () => {
    if (antigos.length) saida.push(...converterDocumentoAntigo(antigos));
    antigos = [];
  };
  for (const b of documento) {
    if (!ehObjeto(b)) continue;
    if (typeof b.tipo === "string") {
      despejar();
      const r = blocoSchema.safeParse(b);
      if (r.success) saida.push(r.data);
    } else if (typeof b.type === "string") antigos.push(b);
  }
  despejar();
  return saida.slice(0, MAXIMO_DE_BLOCOS_DA_NOTA);
}
