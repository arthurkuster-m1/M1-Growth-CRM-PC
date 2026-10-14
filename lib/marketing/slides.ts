import type { Bloco } from "./blocos";

/**
 * DE PÁGINA PARA APRESENTAÇÃO: a mesma lista de blocos, repartida em slides.
 *
 * Regras:
 *  - o slide 0 é a CAPA (o título e a descrição da página);
 *  - cada `titulo` (nível 1 ou o subtítulo, nível 2) abre um slide novo; o que vem depois vai
 *    nele — o subtítulo nunca fica no fim de um slide com o texto no seguinte;
 *  - blocos antes do primeiro título formam um slide sem título;
 *  - slide com blocos demais é partido (continuação);
 *  - blocos GRANDES (oferta, tabela, calculadora) ganham um slide só para eles — o que passar da
 *    altura da tela rola, sempre a partir do topo;
 *  - o `separador` só marca a quebra (não aparece);
 *  - página sem nenhum bloco vira só a capa.
 */
export interface Slide {
  chave: string;
  tipo: "capa" | "conteudo";
  /** O título do slide (o `titulo` que o abriu), se houver. */
  titulo: string | null;
  /** Nível do título: 1 = título da seção, 2 = subtítulo. */
  nivel?: 1 | 2;
  blocos: Bloco[];
}

/** Quantos blocos cabem num slide antes de continuar no seguinte. */
export const BLOCOS_POR_SLIDE = 4;

/** Blocos que, sozinhos, já enchem uma tela. */
const BLOCOS_GRANDES: ReadonlySet<Bloco["tipo"]> = new Set(["oferta", "tabela", "calculadora"]);

export function slidesDaPagina(blocos: readonly Bloco[]): Slide[] {
  const slides: Slide[] = [{ chave: "capa", tipo: "capa", titulo: null, blocos: [] }];
  // O slide aberto fica num objeto (e não numa variável solta) porque `abrir` o muda por dentro.
  const aberto: { slide: Slide | null; contador: number } = { slide: null, contador: 0 };

  const abrir = (titulo: string | null, nivel: 1 | 2 = 1): Slide => {
    aberto.contador += 1;
    const novo: Slide = { chave: `s${aberto.contador}`, tipo: "conteudo", titulo, nivel, blocos: [] };
    slides.push(novo);
    aberto.slide = novo;
    return novo;
  };

  for (const bloco of blocos) {
    if (bloco.tipo === "titulo") {
      abrir(bloco.texto || null, bloco.nivel === 2 ? 2 : 1);
      continue;
    }
    if (bloco.tipo === "separador") {
      aberto.slide = null;
      continue;
    }
    if (BLOCOS_GRANDES.has(bloco.tipo)) {
      // Sozinho num slide (reaproveita o do título, se acabou de abrir); o seguinte abre outro.
      const vazio = aberto.slide !== null && aberto.slide.blocos.length === 0;
      (vazio && aberto.slide ? aberto.slide : abrir(null)).blocos.push(bloco);
      aberto.slide = null;
      continue;
    }
    const destino =
      aberto.slide && aberto.slide.blocos.length < BLOCOS_POR_SLIDE ? aberto.slide : abrir(null);
    destino.blocos.push(bloco);
  }
  // Um título de seção sozinho é um slide válido; só descarta o vazio sem título.
  return slides.filter((s) => s.tipo === "capa" || s.titulo !== null || s.blocos.length > 0);
}
