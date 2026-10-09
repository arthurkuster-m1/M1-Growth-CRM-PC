import type { Bloco } from "./blocos";

/**
 * DE PÁGINA PARA APRESENTAÇÃO: a mesma lista de blocos, repartida em slides.
 *
 * Regras:
 *  - o slide 0 é a CAPA (o título e a descrição da página);
 *  - cada `titulo` de nível 1 abre um slide novo; o que vem depois vai nele;
 *  - blocos antes do primeiro título formam um slide sem título;
 *  - slide com blocos demais é partido (continuação) — slide não rola, tem de caber na tela;
 *  - o `separador` só marca a quebra (não aparece);
 *  - página sem nenhum bloco vira só a capa.
 */
export interface Slide {
  chave: string;
  tipo: "capa" | "conteudo";
  /** O título do slide (o `titulo` nível 1 que o abriu), se houver. */
  titulo: string | null;
  blocos: Bloco[];
}

/** Quantos blocos cabem num slide antes de continuar no seguinte. */
export const BLOCOS_POR_SLIDE = 4;

export function slidesDaPagina(blocos: readonly Bloco[]): Slide[] {
  const slides: Slide[] = [{ chave: "capa", tipo: "capa", titulo: null, blocos: [] }];
  // O slide aberto fica num objeto (e não numa variável solta) porque `abrir` o muda por dentro.
  const aberto: { slide: Slide | null; contador: number } = { slide: null, contador: 0 };

  const abrir = (titulo: string | null): Slide => {
    aberto.contador += 1;
    const novo: Slide = { chave: `s${aberto.contador}`, tipo: "conteudo", titulo, blocos: [] };
    slides.push(novo);
    aberto.slide = novo;
    return novo;
  };

  for (const bloco of blocos) {
    if (bloco.tipo === "titulo" && bloco.nivel === 1) {
      abrir(bloco.texto || null);
      continue;
    }
    if (bloco.tipo === "separador") {
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
