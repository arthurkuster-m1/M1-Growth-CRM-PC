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

// ── operações em vários blocos (seleção em massa) ────────────────────────────────

/** Os ids na ordem em que aparecem na tela (filhos de toggle fechado ficam de fora). */
export function idsVisiveis(blocos: Bloco[]): string[] {
  const saida: string[] = [];
  const percorre = (lista: Bloco[]) => {
    for (const b of lista) {
      saida.push(b.id);
      if (b.filhos?.length && (b.tipo !== "toggle" || b.aberto)) percorre(b.filhos);
    }
  };
  percorre(blocos);
  return saida;
}

const comFilhos = (b: Bloco, filhos: Bloco[]): Bloco => {
  const { filhos: _antigos, ...resto } = b;
  void _antigos;
  return filhos.length ? { ...resto, filhos } : resto;
};

/** Tira os blocos escolhidos (e o que há dentro deles). */
export function removerIds(blocos: Bloco[], ids: ReadonlySet<string>): Bloco[] {
  return blocos
    .filter((b) => !ids.has(b.id))
    .map((b) => (b.filhos ? comFilhos(b, removerIds(b.filhos, ids)) : b));
}

/** Aplica a mudança a cada bloco escolhido, em qualquer nível. */
export function mapearIds(
  blocos: Bloco[],
  ids: ReadonlySet<string>,
  mudanca: (b: Bloco) => Partial<Bloco>,
): Bloco[] {
  return blocos.map((b) => {
    const novo = ids.has(b.id) ? { ...b, ...mudanca(b) } : b;
    return novo.filhos ? { ...novo, filhos: mapearIds(novo.filhos, ids, mudanca) } : novo;
  });
}

/** Cópia com ids novos (colar e duplicar não podem repetir id). */
export function clonar(b: Bloco): Bloco {
  return { ...b, id: novoId(), filhos: b.filhos?.map(clonar) };
}

/** Os blocos escolhidos de mais alto nível: o que está dentro de um escolhido vai junto com ele. */
export function topoDosEscolhidos(blocos: Bloco[], ids: ReadonlySet<string>): Bloco[] {
  const saida: Bloco[] = [];
  for (const b of blocos) {
    if (ids.has(b.id)) saida.push(b);
    else if (b.filhos) saida.push(...topoDosEscolhidos(b.filhos, ids));
  }
  return saida;
}

/** Põe uma cópia logo depois de cada bloco escolhido de mais alto nível. */
export function duplicarIds(blocos: Bloco[], ids: ReadonlySet<string>): Bloco[] {
  const saida: Bloco[] = [];
  for (const b of blocos) {
    if (ids.has(b.id)) {
      saida.push(b, clonar(b));
    } else {
      saida.push(b.filhos ? comFilhos(b, duplicarIds(b.filhos, ids)) : b);
    }
  }
  return saida;
}

/** Insere `novos` logo depois do bloco `alvo` (ou no lugar dele, se `substituir`). */
export function inserirDepois(
  blocos: Bloco[],
  alvo: string,
  novos: Bloco[],
  substituir = false,
): Bloco[] {
  const saida: Bloco[] = [];
  for (const b of blocos) {
    if (b.id === alvo) {
      if (!substituir) saida.push(b);
      saida.push(...novos);
    } else {
      saida.push(b.filhos ? comFilhos(b, inserirDepois(b.filhos, alvo, novos, substituir)) : b);
    }
  }
  return saida;
}

export function acharBloco(blocos: Bloco[], id: string): Bloco | null {
  for (const b of blocos) {
    if (b.id === id) return b;
    const dentro = b.filhos ? acharBloco(b.filhos, id) : null;
    if (dentro) return dentro;
  }
  return null;
}

const PREFIXO_DO_TIPO: Record<TipoDeBloco, string> = {
  texto: "",
  h1: "# ",
  h2: "## ",
  h3: "### ",
  todo: "[ ] ",
  bullet: "- ",
  numero: "1. ",
  toggle: "> ",
  quote: '" ',
  callout: "",
};

/** Os blocos como texto (é o que vai para a área de transferência), um por linha, recuados. */
export function textoDosBlocos(blocos: Bloco[], nivel = 0): string {
  return blocos
    .flatMap((b) => [
      `${"  ".repeat(nivel)}${PREFIXO_DO_TIPO[b.tipo]}${b.texto}`,
      ...(b.filhos?.length ? [textoDosBlocos(b.filhos, nivel + 1)] : []),
    ])
    .join("\n");
}
