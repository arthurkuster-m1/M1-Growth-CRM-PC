import { precoEmTexto, ROTULO_DA_ETAPA } from "@/lib/marketing/oferta";
import {
  APELIDOS,
  COLUNAS_DO_MODELO,
  campos,
  chaveDeColuna,
  ofertaDaLinha,
  semAcento,
  type LinhaDaPlanilha,
  type Oferta,
} from "@/lib/marketing/produtos-csv";

/**
 * COLAR PRODUTOS DIRETO NA TABELA (como no Finanças): a pessoa copia as linhas de uma planilha,
 * cola, e cada linha mostra na hora a SITUAÇÃO dela (pronta, aviso, erro, já existe). Aqui mora
 * o que é puro: ler o texto colado, dizer a situação de cada linha e fazer o caminho de volta
 * (produtos → texto de planilha, para copiar de um cliente e colar em outro).
 *
 * A validação de verdade é `ofertaDaLinha` — a MESMA que a rota de importação roda no servidor.
 */

/** Quantas linhas a grade começa tendo (e quantas ganha ao colar, de folga para digitar). */
export const LINHAS_INICIAIS = 5;

export const linhaVazia = (l: LinhaDaPlanilha): boolean =>
  !Object.values(l).some((v) => v && v.trim() !== "");

/** O texto colado em matriz de células. Tabulação (o que a planilha copia) tem prioridade. */
export function matrizDoTexto(texto: string): string[][] {
  return campos(texto, texto.includes("\t") ? "\t" : undefined);
}

export interface LinhasLidas {
  linhas: LinhaDaPlanilha[];
  /** Colunas do cabeçalho que não foram reconhecidas (ignoradas). */
  ignoradas: string[];
  temCabecalho: boolean;
}

/**
 * A matriz em linhas com os nomes de coluna do modelo. Se a primeira linha parece cabeçalho
 * (reconhece o "nome" ou ao menos duas colunas), ela mapeia as colunas; senão vale a ordem do
 * modelo (nome, resumo, etapa, tipo de preço, preço, setup, carro-chefe, inclui…).
 */
export function linhasDeMatriz(matriz: string[][]): LinhasLidas {
  const linhasCheias = matriz.filter((l) => l.some((c) => (c ?? "").trim() !== ""));
  if (linhasCheias.length === 0) return { linhas: [], ignoradas: [], temCabecalho: false };
  const primeira = linhasCheias[0]!;
  const mapa = primeira.map((c) => APELIDOS[chaveDeColuna(c ?? "")]);
  const reconhecidas = mapa.filter(Boolean).length;
  const temCabecalho = mapa.includes("nome") || reconhecidas >= 2;
  const colunas = temCabecalho ? mapa : primeira.map((_, i) => COLUNAS_DO_MODELO[i]);
  const dados = temCabecalho ? linhasCheias.slice(1) : linhasCheias;
  const linhas = dados.map((cels) => {
    const l: LinhaDaPlanilha = {};
    cels.forEach((valor, i) => {
      const c = colunas[i];
      if (c && l[c] === undefined) l[c] = (valor ?? "").trim();
    });
    return l;
  });
  // As células além do cabeçalho (linha mais larga que ele) seguem a ordem do modelo só sem cabeçalho.
  const ignoradas = temCabecalho
    ? primeira.filter((c, i) => !mapa[i] && (c ?? "").trim() !== "").map((c) => c.trim())
    : [];
  return { linhas, ignoradas, temCabecalho };
}

export type TomDaLinha = "erro" | "aviso" | "ok" | "dup";

export interface SituacaoDaLinha {
  tom: TomDaLinha;
  texto: string;
  /** Só `ok` e `aviso` entram na importação. */
  importavel: boolean;
}

const ROTULO_DO_TIPO = {
  unico: "Pagamento único",
  mensal: "Mensal",
  "setup-mensal": "Setup + mensalidade",
  "sob-consulta": "Sob consulta",
  gratuito: "Gratuito",
} as const;

/**
 * A situação de cada linha da grade, na ordem. `existentes` são os nomes que o cliente já tem
 * (a importação pula esses); um nome repetido na própria tabela só entra na primeira vez.
 * Linha totalmente vazia não tem situação (`null`).
 */
export function situacoesDasLinhas(
  linhas: readonly LinhaDaPlanilha[],
  existentes: readonly string[],
): Array<SituacaoDaLinha | null> {
  const jaTem = new Set(existentes.map(semAcento));
  const vistos = new Set<string>();
  return linhas.map((l) => {
    if (linhaVazia(l)) return null;
    const r = ofertaDaLinha(l, () => "x");
    if (!r.ok) return { tom: "erro", texto: r.erro, importavel: false };
    const nome = semAcento(r.titulo);
    if (jaTem.has(nome)) {
      return { tom: "dup", texto: "Já existe neste cliente · será pulado", importavel: false };
    }
    if (vistos.has(nome)) {
      return { tom: "dup", texto: "Repetida na tabela · só a primeira entra", importavel: false };
    }
    vistos.add(nome);
    const o = r.oferta;
    const resumo = [
      ROTULO_DA_ETAPA[o.etapa] + (o.carroChefe ? " (carro-chefe)" : ""),
      `${ROTULO_DO_TIPO[o.preco.tipo]}: ${precoEmTexto(o)}`,
    ].join(" · ");
    const semPreco = (l.preco ?? "").trim() === "";
    if (semPreco && o.preco.tipo !== "gratuito" && o.preco.tipo !== "sob-consulta") {
      return { tom: "aviso", texto: `Sem preço · ${resumo}`, importavel: true };
    }
    if (semPreco && (l.tipo_de_preco ?? "").trim() === "") {
      return {
        tom: "aviso",
        texto: `Sem preço: entra como “Sob consulta” · ${resumo}`,
        importavel: true,
      };
    }
    return { tom: "ok", texto: `Pronta · ${resumo}`, importavel: true };
  });
}

// ── O caminho de volta: produtos → texto de planilha ────────────────────────────────────────

const TIPO_PARA_PLANILHA: Record<Oferta["preco"]["tipo"], string> = {
  unico: "único",
  mensal: "mensal",
  "setup-mensal": "setup + mensal",
  "sob-consulta": "sob consulta",
  gratuito: "gratuito",
};

/** A oferta como uma linha da planilha (as colunas do modelo); o que a ficha simples não tem sai vazio. */
export function linhaDaOferta(titulo: string, o: Oferta): LinhaDaPlanilha {
  return {
    nome: titulo,
    resumo: o.resumo,
    etapa: o.etapa,
    tipo_de_preco: TIPO_PARA_PLANILHA[o.preco.tipo],
    preco: o.preco.valor,
    setup: o.preco.setup,
    carro_chefe: o.carroChefe ? "sim" : "não",
    inclui: o.inclui.filter((i) => i.trim() !== "").join("|"),
    para_quem: o.paraQuem,
    prazo: o.prazo,
    condicoes: o.preco.condicoes,
  };
}

const limpaCelula = (v: string) => v.replace(/[\t\r\n]+/g, " ").trim();

/**
 * Os produtos como texto separado por tabulação, com cabeçalho: cola direto em outra planilha, ou
 * na tabela de colar produtos (de outro cliente). Tabulação e quebra de linha dentro de um campo
 * viram espaço, porque a planilha e o colar quebrariam a linha ali.
 */
export function textoDeProdutos(itens: ReadonlyArray<{ titulo: string; oferta: Oferta }>): string {
  const cabecalho = [...COLUNAS_DO_MODELO].join("\t");
  const corpo = itens.map(({ titulo, oferta }) => {
    const l = linhaDaOferta(titulo, oferta);
    return COLUNAS_DO_MODELO.map((c) => limpaCelula(l[c] ?? "")).join("\t");
  });
  return [cabecalho, ...corpo].join("\n") + "\n";
}

/** O nome de uma cópia dentro do mesmo cliente: "X (cópia)", "X (cópia 2)"… sem repetir nenhum nome. */
export function nomeDaCopia(titulo: string, emUso: ReadonlySet<string>): string {
  const base = titulo.replace(/\s*\(cópia(?: \d+)?\)\s*$/i, "").trim() || titulo;
  for (let n = 1; n < 1000; n++) {
    const candidato = `${base} (cópia${n === 1 ? "" : ` ${n}`})`.slice(0, 200);
    if (!emUso.has(semAcento(candidato))) return candidato;
  }
  return `${base} (cópia)`.slice(0, 200);
}
