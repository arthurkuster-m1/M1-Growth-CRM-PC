/**
 * A descrição da tarefa em BLOCOS, como no Notion. Mora na mesma coluna de texto
 * (`crm_tasks.description`): quem escreve com blocos grava um JSON `{"v":1,"b":[…]}`; o texto
 * puro de antes continua valendo e vira um bloco de texto por linha ao abrir.
 */

export const TIPOS_DE_BLOCO = [
  "texto",
  "h1",
  "h2",
  "h3",
  "todo",
  "bullet",
  "numero",
  "toggle",
  "quote",
  "callout",
] as const;

export type TipoDeBloco = (typeof TIPOS_DE_BLOCO)[number];

export interface Bloco {
  id: string;
  tipo: TipoDeBloco;
  texto: string;
  /** To-do marcado. */
  marcado?: boolean;
  /** Toggle aberto. */
  aberto?: boolean;
  /** Conteúdo de dentro do toggle. */
  filhos?: Bloco[];
}

/** O limite da coluna na API (`description`). */
export const LIMITE_DA_DESCRICAO = 20000;

/** Ctrl+Shift+<tecla> → tipo. */
export const ATALHO_DO_TIPO: Record<TipoDeBloco, string> = {
  h1: "1",
  h2: "2",
  h3: "3",
  todo: "4",
  bullet: "5",
  numero: "6",
  toggle: "7",
  quote: "8",
  callout: "9",
  texto: "0",
};

export function novoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function novoBloco(tipo: TipoDeBloco = "texto", texto = ""): Bloco {
  return { id: novoId(), tipo, texto };
}

function saneia(entrada: unknown, nivel = 0): Bloco[] {
  if (!Array.isArray(entrada) || nivel > 6) return [];
  const saida: Bloco[] = [];
  for (const b of entrada) {
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    const tipo = TIPOS_DE_BLOCO.includes(o.tipo as TipoDeBloco) ? (o.tipo as TipoDeBloco) : "texto";
    const bloco: Bloco = {
      id: typeof o.id === "string" && o.id ? o.id : novoId(),
      tipo,
      texto: typeof o.texto === "string" ? o.texto : "",
    };
    if (o.marcado === true) bloco.marcado = true;
    if (o.aberto === true) bloco.aberto = true;
    const filhos = saneia(o.filhos, nivel + 1);
    if (filhos.length) bloco.filhos = filhos;
    saida.push(bloco);
  }
  return saida;
}

/** O texto salvo → blocos. Nunca lança: texto antigo e JSON quebrado viram blocos de texto. */
export function lerBlocos(descricao: string | null | undefined): Bloco[] {
  const bruto = descricao ?? "";
  if (bruto.startsWith('{"v":1')) {
    try {
      const blocos = saneia((JSON.parse(bruto) as { b?: unknown }).b);
      if (blocos.length) return blocos;
    } catch {
      // cai no texto puro
    }
  }
  const linhas = bruto.split("\n");
  return linhas.length ? linhas.map((l) => novoBloco("texto", l)) : [novoBloco()];
}

function vazio(blocos: Bloco[]): boolean {
  return blocos.every((b) => !b.texto.trim() && vazio(b.filhos ?? []));
}

/** Blocos → o texto que vai para o banco (`null` quando não há nada escrito). */
export function escreverBlocos(blocos: Bloco[]): string | null {
  if (vazio(blocos)) return null;
  return JSON.stringify({ v: 1, b: blocos });
}

/** O texto corrido da descrição, para busca e para a coluna da tabela. */
export function textoDaDescricao(descricao: string | null | undefined): string {
  if (!descricao) return "";
  if (!descricao.startsWith('{"v":1')) return descricao;
  const partes: string[] = [];
  const percorre = (lista: Bloco[]) => {
    for (const b of lista) {
      if (b.texto.trim()) partes.push(b.texto.trim());
      if (b.filhos) percorre(b.filhos);
    }
  };
  percorre(lerBlocos(descricao));
  return partes.join(" · ");
}
