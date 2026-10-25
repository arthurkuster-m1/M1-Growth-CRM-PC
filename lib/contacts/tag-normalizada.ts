/**
 * A MESMA regra de normalização nos dois lados do marcador de contato.
 *
 * O editor normalizava ao GRAVAR (`raw.trim().toLowerCase().slice(0, 40)`) e a
 * rota de sugestões devolvia a tag CRUA. Para toda tag armazenada fora dessa
 * forma o chip mentia sobre si mesmo: clicar em "+ VIP" gravava "vip", o chip
 * continuava na tela porque o filtro comparava com sensibilidade a caixa, e do
 * segundo clique em diante não fazia nada — controle decorativo, e a duplicação
 * que a sugestão veio impedir.
 *
 * Tag de contato em caixa mista é alcançável pelo caminho NORMAL do produto, e
 * a razão é uma assimetria: a tag de CONVERSA é normalizada pelo próprio schema
 * (`conversationTagSchema`, lib/schemas/messaging.ts:147, com `.trim()
 * .toLowerCase()`), enquanto a de CONTATO era `z.array(z.string())` e o handler
 * gravava verbatim — o diálogo de novo contato, o de edição, a importação por
 * CSV e a API só aparam as pontas.
 *
 * ⚠️ ESCOPO: os DOIS lados estão consertados (issue #1224). A escrita passou a
 * normalizar por aqui — `contactCreateSchema`, `contactPatchSchema`,
 * `contactListQuerySchema` (o filtro `?tag=`), a ficha, a importação por CSV e
 * o `crm_manage_tags` —, e a migration 0324 leva a regra aos marcadores que já
 * estavam gravados em caixa mista.
 *
 * O que NÃO mora aqui é o teto de 20 marcadores: `normalizarTags` só apara as
 * pontas, passa a minúscula, corta em 40, descarta o vazio e tira o repetido.
 * Quem tem teto o aplica depois (a importação por CSV corta em 20) ou recusa ao
 * estourar (`conversationTagsSchema`) — descartar em silêncio o que passa do
 * teto apagaria marcador de quem lê uma planilha.
 */
export const TAMANHO_MAXIMO_DA_TAG = 40;

/** O teto das tags automáticas (`Campanha: …`, `Ad: …`, `LP: …`, `Funil: …`): o mesmo do banco. */
export const TAMANHO_MAXIMO_DA_TAG_AUTOMATICA = 60;

const PREFIXOS_AUTOMATICOS: Readonly<Record<string, string>> = {
  campanha: "Campanha",
  ad: "Ad",
  lp: "LP",
  conjunto: "Conjunto",
  funil: "Funil",
  abordagem: "Abordagem",
};

/**
 * A forma de uma tag AUTOMÁTICA (a que o sistema cria pela origem, pelo funil e pelo MQL):
 * `Campanha: Nome`, `Ad: Nome`, `LP: Nome`, `Conjunto: Nome`, `Funil: Nome` e `MQL`, com a 1ª letra
 * do nome em maiúscula e o resto como veio. Devolve `null` quando não é uma delas.
 */
export function tagAutomaticaCanonica(cru: string): string | null {
  const texto = cru.trim();
  if (/^mql$/i.test(texto)) return "MQL";
  // As marcas de estado que a abordagem põe sozinha.
  if (/^contato$/i.test(texto)) return "Contato";
  if (/^contato com decisor$/i.test(texto)) return "Contato com decisor";
  // "Contato · <funil>" e "Contato com decisor · <funil>": o funil mantém a caixa que tem.
  const estado = /^(contato com decisor|contato)\s·\s(.+)$/i.exec(texto);
  if (estado && estado[2]!.trim()) {
    const base = /^contato com decisor/i.test(estado[1]!) ? "Contato com decisor" : "Contato";
    return `${base} · ${estado[2]!.trim()}`.slice(0, TAMANHO_MAXIMO_DA_TAG_AUTOMATICA);
  }
  const m = /^(campanha|ad|lp|conjunto|funil|abordagem)\s*:\s*(.+)$/i.exec(texto);
  if (!m) return null;
  const nome = m[2]!.trim();
  if (!nome) return null;
  const prefixo = PREFIXOS_AUTOMATICOS[m[1]!.toLowerCase()]!;
  return `${prefixo}: ${nome.charAt(0).toUpperCase()}${nome.slice(1)}`.slice(
    0,
    TAMANHO_MAXIMO_DA_TAG_AUTOMATICA,
  );
}

export function normalizarTag(cru: string): string {
  // A tag automática mantém a caixa do nome (só a inicial é maiúscula); as digitadas à mão seguem
  // em minúsculas, que é o que o filtro `?tag=` casa.
  const automatica = tagAutomaticaCanonica(cru);
  if (automatica) return automatica;
  return cru.trim().toLowerCase().slice(0, TAMANHO_MAXIMO_DA_TAG);
}

/**
 * Normaliza uma LISTA de marcadores como um conjunto: aplica `normalizarTag` em
 * cada um, descarta o que vira vazio, não repete e preserva a ordem da primeira
 * aparição. É a forma que o banco guarda — e, por ser a mesma dos dois lados, a
 * forma que o filtro `?tag=` casa.
 */
export function normalizarTags(cruas: readonly string[]): string[] {
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const crua of cruas) {
    const tag = normalizarTag(crua);
    if (tag === "" || vistas.has(tag)) continue;
    vistas.add(tag);
    saida.push(tag);
  }
  return saida;
}
