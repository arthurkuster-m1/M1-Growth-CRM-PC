/**
 * TEXTO COM ESTILO dentro dos blocos: `**negrito**` e `*itálico*` (e `***os dois***`) escritos no
 * próprio texto. Não muda o formato do dado (continua uma string): quem lê e quem copia como texto
 * enxergam as mesmas marcas, e o desenho troca por negrito/itálico de verdade.
 */

export interface Trecho {
  texto: string;
  negrito: boolean;
  italico: boolean;
}

const MARCAS =
  /\*\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*\*|\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*|\*(?=\S)([\s\S]+?)(?<=\S)\*/;

/** Quebra o texto em trechos, cada um com seu estilo. Marca sem par fica como texto comum. */
export function trechosDoTexto(texto: string, negrito = false, italico = false): Trecho[] {
  const saida: Trecho[] = [];
  let resto = texto;
  while (resto) {
    const m = MARCAS.exec(resto);
    if (!m) {
      saida.push({ texto: resto, negrito, italico });
      break;
    }
    if (m.index > 0) saida.push({ texto: resto.slice(0, m.index), negrito, italico });
    if (m[1] !== undefined) saida.push(...trechosDoTexto(m[1], true, true));
    else if (m[2] !== undefined) saida.push(...trechosDoTexto(m[2], true, italico));
    else saida.push(...trechosDoTexto(m[3]!, negrito, true));
    resto = resto.slice(m.index + m[0].length);
  }
  return saida;
}

export type MarcaDeEstilo = "**" | "*";

/**
 * Liga/desliga a marca ao redor da seleção (Ctrl+B / Ctrl+I). Sem seleção, abre um par de marcas
 * com o cursor no meio. Devolve o novo texto e a nova seleção.
 */
export function alternarMarca(
  valor: string,
  ini: number,
  fim: number,
  marca: MarcaDeEstilo,
): { valor: string; ini: number; fim: number } {
  const m = marca.length;
  const antes = valor.slice(ini - m, ini);
  const depois = valor.slice(fim, fim + m);
  // Itálico (`*`) ao lado de um negrito (`**`) não é "já está em itálico".
  const colado = marca === "*" && (valor[ini - 2] === "*" || valor[fim + 1] === "*");
  if (ini >= m && antes === marca && depois === marca && !colado) {
    return {
      valor: valor.slice(0, ini - m) + valor.slice(ini, fim) + valor.slice(fim + m),
      ini: ini - m,
      fim: fim - m,
    };
  }
  const selecionado = valor.slice(ini, fim);
  if (
    selecionado.length > 2 * m &&
    selecionado.startsWith(marca) &&
    selecionado.endsWith(marca) &&
    !(marca === "*" && (selecionado.startsWith("**") || selecionado.endsWith("**")))
  ) {
    return {
      valor: valor.slice(0, ini) + selecionado.slice(m, -m) + valor.slice(fim),
      ini,
      fim: fim - 2 * m,
    };
  }
  return {
    valor: valor.slice(0, ini) + marca + selecionado + marca + valor.slice(fim),
    ini: ini + m,
    fim: fim + m,
  };
}

/** Aplica a marca no campo de texto em foco, avisando o React (como se a pessoa tivesse digitado). */
export function aplicarMarcaNoCampo(campo: HTMLTextAreaElement, marca: MarcaDeEstilo): void {
  const r = alternarMarca(campo.value, campo.selectionStart, campo.selectionEnd, marca);
  const escrever = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  escrever?.call(campo, r.valor);
  campo.dispatchEvent(new Event("input", { bubbles: true }));
  campo.setSelectionRange(r.ini, r.fim);
}

/** O texto sem as marcas (para resumos e nomes curtos). */
export const semMarcas = (texto: string): string =>
  trechosDoTexto(texto)
    .map((t) => t.texto)
    .join("");
