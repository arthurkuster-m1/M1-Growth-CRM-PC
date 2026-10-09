import { z } from "zod";

/**
 * A CONSULTA de uma tabela estilo Notion: filtros, ordenação e agrupamento.
 *
 * Pura e sem React. A tela declara os campos (`CampoConsultavel`: como ler o valor de uma
 * linha e de que TIPO ele é); este módulo decide o que a consulta faz com eles. A consulta
 * em si (`ConsultaDaTabela`) é só dado — por isso cabe em `user_view_preferences.config`
 * e, mais adiante, numa visualização salva e compartilhada.
 *
 * Regra de ouro: consulta que fala de um campo que não existe mais (propriedade apagada)
 * é IGNORADA, nunca quebra a tela. O mesmo vale para operador que não serve ao tipo.
 */

export const TIPOS_DE_CAMPO = [
  "texto",
  "opcao",
  "multi",
  "data",
  "numero",
  "caixa",
  "pessoa",
] as const;
export type TipoDeCampo = (typeof TIPOS_DE_CAMPO)[number];

export const OPERADORES = [
  "contem",
  "nao_contem",
  "e",
  "nao_e",
  "vazio",
  "preenchido",
  "antes",
  "depois",
  "igual",
  "maior",
  "menor",
  "marcado",
  "desmarcado",
] as const;
export type Operador = (typeof OPERADORES)[number];

/** Os operadores de cada tipo, na ordem em que o menu os mostra. O primeiro é o padrão. */
export const OPERADORES_DO_TIPO: Record<TipoDeCampo, readonly Operador[]> = {
  texto: ["contem", "nao_contem", "vazio", "preenchido"],
  opcao: ["e", "nao_e", "vazio", "preenchido"],
  pessoa: ["e", "nao_e", "vazio", "preenchido"],
  multi: ["contem", "nao_contem", "vazio", "preenchido"],
  data: ["antes", "depois", "e", "vazio", "preenchido"],
  numero: ["igual", "maior", "menor", "vazio", "preenchido"],
  caixa: ["marcado", "desmarcado"],
};

/** Operadores que não pedem valor. */
export function semValor(operador: Operador): boolean {
  return (
    operador === "vazio" ||
    operador === "preenchido" ||
    operador === "marcado" ||
    operador === "desmarcado"
  );
}

/** O que um campo guarda, já normalizado: dia `YYYY-MM-DD` para datas, ids para opções. */
export type ValorDoCampo = string | number | boolean | string[] | null | undefined;

export interface CampoConsultavel<T> {
  id: string;
  tipo: TipoDeCampo;
  valorDe: (linha: T) => ValorDoCampo;
  /** O nome de um valor (para ordenar por nome e para o título do grupo). */
  rotuloDoValor?: (valor: string) => string;
  /** Posição de um valor numa lista fixa (status, prioridade): ordena e agrupa por ela. */
  ordemDoValor?: (valor: string) => number;
}

const MAXIMO = 20;
const idDeCampo = z.string().min(1).max(80);

export const filtroSchema = z
  .object({
    campo: idDeCampo,
    operador: z.enum(OPERADORES),
    valor: z
      .union([z.string().max(500), z.number().finite(), z.array(z.string().max(80)).max(100)])
      .optional(),
  })
  .strict();
export type Filtro = z.infer<typeof filtroSchema>;

export const ordemSchema = z
  .object({ campo: idDeCampo, direcao: z.enum(["asc", "desc"]) })
  .strict();
export type Ordem = z.infer<typeof ordemSchema>;

/** A forma guardada: a mesma que a rota valida. Tudo opcional — consulta vazia = tudo à vista. */
export const consultaSchema = z
  .object({
    filtros: z.array(filtroSchema).max(MAXIMO).optional(),
    ordenacao: z.array(ordemSchema).max(5).optional(),
    agrupar: idDeCampo.optional(),
  })
  .strict();
export type ConsultaDaTabela = z.infer<typeof consultaSchema>;

export interface ContextoDaConsulta {
  /** `YYYY-MM-DD` de hoje no fuso da organização — o que "hoje" significa. */
  hoje: string;
}

/** Os filtros que sobram quando se tira o do índice `i`. */
export const semFiltro = (filtros: readonly Filtro[], i: number): Filtro[] =>
  filtros.filter((_, k) => k !== i);

/** A consulta está pedindo algo? (Decide se a reordenação manual fica valendo.) */
export function consultaAtiva(c: ConsultaDaTabela | undefined): boolean {
  return Boolean(c?.filtros?.length || c?.ordenacao?.length || c?.agrupar);
}

/** O filtro, pronto para uso: campo conhecido, operador do tipo e valor presente se preciso. */
function filtroUtil<T>(f: Filtro, campo: CampoConsultavel<T> | undefined): boolean {
  if (!campo) return false;
  if (!OPERADORES_DO_TIPO[campo.tipo].includes(f.operador)) return false;
  if (semValor(f.operador)) return true;
  if (f.valor === undefined) return false;
  if (typeof f.valor === "string") return f.valor.trim() !== "";
  if (Array.isArray(f.valor)) return f.valor.length > 0;
  return true;
}

const estaVazio = (v: ValorDoCampo): boolean =>
  v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function aprova(
  valor: ValorDoCampo,
  tipo: TipoDeCampo,
  f: Filtro,
  contexto: ContextoDaConsulta,
): boolean {
  const op = f.operador;
  if (op === "vazio") return estaVazio(valor);
  if (op === "preenchido") return !estaVazio(valor);
  if (op === "marcado") return valor === true;
  if (op === "desmarcado") return valor !== true;

  switch (tipo) {
    case "texto": {
      const achou = normalizar(String(valor ?? "")).includes(normalizar(String(f.valor ?? "")));
      return op === "contem" ? achou : !achou;
    }
    case "opcao":
    case "pessoa": {
      const alvo = Array.isArray(f.valor) ? f.valor : [String(f.valor)];
      const esta = typeof valor === "string" && alvo.includes(valor);
      return op === "e" ? esta : !esta;
    }
    case "multi": {
      const alvo = Array.isArray(f.valor) ? f.valor : [String(f.valor)];
      const tem = Array.isArray(valor) && valor.some((v) => alvo.includes(v));
      return op === "contem" ? tem : !tem;
    }
    case "data": {
      if (typeof valor !== "string") return false;
      const limite = f.valor === "hoje" ? contexto.hoje : String(f.valor);
      if (op === "antes") return valor < limite;
      if (op === "depois") return valor > limite;
      return valor === limite;
    }
    case "numero": {
      if (typeof valor !== "number") return false;
      const alvo = Number(f.valor);
      if (!Number.isFinite(alvo)) return false;
      if (op === "maior") return valor > alvo;
      if (op === "menor") return valor < alvo;
      return valor === alvo;
    }
    case "caixa":
      return true;
  }
}

/** Fica só com as linhas que passam em TODOS os filtros (E). */
export function filtrar<T>(
  linhas: readonly T[],
  campos: readonly CampoConsultavel<T>[],
  filtros: readonly Filtro[] | undefined,
  contexto: ContextoDaConsulta,
): T[] {
  const porId = new Map(campos.map((c) => [c.id, c]));
  const uteis = (filtros ?? []).flatMap((f) => {
    const campo = porId.get(f.campo);
    return campo && filtroUtil(f, campo) ? [{ f, campo }] : [];
  });
  if (uteis.length === 0) return [...linhas];
  return linhas.filter((linha) =>
    uteis.every(({ f, campo }) => aprova(campo.valorDe(linha), campo.tipo, f, contexto)),
  );
}

type Comparavel = number | string | null;

/** O valor de uma linha como coisa comparável: posição fixa > nome > valor cru. `null` = vazio. */
function comparavel<T>(campo: CampoConsultavel<T>, linha: T): Comparavel {
  const v = campo.valorDe(linha);
  if (estaVazio(v)) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (Array.isArray(v)) return normalizar((v[0] && campo.rotuloDoValor?.(v[0])) ?? v.join(","));
  if (typeof v === "number") return v;
  const texto = String(v);
  if (campo.ordemDoValor) return campo.ordemDoValor(texto);
  if (campo.tipo === "data") return texto;
  return normalizar(campo.rotuloDoValor?.(texto) ?? texto);
}

function compara(a: Comparavel, b: Comparavel): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true });
}

/**
 * Ordena por uma ou mais chaves. ESTÁVEL (empate mantém a ordem manual de entrada) e com os
 * vazios sempre no fim, qualquer que seja a direção — "sem prazo" não é o menor prazo.
 */
export function ordenar<T>(
  linhas: readonly T[],
  campos: readonly CampoConsultavel<T>[],
  ordenacao: readonly Ordem[] | undefined,
): T[] {
  const porId = new Map(campos.map((c) => [c.id, c]));
  const chaves = (ordenacao ?? []).flatMap((o) => {
    const campo = porId.get(o.campo);
    return campo ? [{ campo, sinal: o.direcao === "desc" ? -1 : 1 }] : [];
  });
  if (chaves.length === 0) return [...linhas];

  return linhas
    .map((linha, indice) => ({ linha, indice }))
    .sort((x, y) => {
      for (const { campo, sinal } of chaves) {
        const a = comparavel(campo, x.linha);
        const b = comparavel(campo, y.linha);
        if (a === null && b === null) continue;
        if (a === null) return 1;
        if (b === null) return -1;
        const r = compara(a, b);
        if (r !== 0) return r * sinal;
      }
      return x.indice - y.indice;
    })
    .map((x) => x.linha);
}

export interface GrupoDeLinhas<T> {
  /** O valor do grupo, ou `""` para "sem valor". */
  chave: string;
  /** Vazio quando a tela deve usar o rótulo de "sem valor". */
  rotulo: string;
  linhas: T[];
}

/** Os tipos que se podem agrupar: valor único e poucos valores distintos. */
export const TIPOS_AGRUPAVEIS: readonly TipoDeCampo[] = ["opcao", "pessoa", "caixa"];

/**
 * Parte as linhas em grupos pelo valor do campo. A ordem dos grupos segue a lista fixa do
 * campo (status, prioridade) quando há, senão o nome; "sem valor" fica por último. Dentro de
 * cada grupo a ordem de entrada é mantida.
 */
export function agrupar<T>(
  linhas: readonly T[],
  campo: CampoConsultavel<T> | undefined,
): GrupoDeLinhas<T>[] | null {
  if (!campo || !TIPOS_AGRUPAVEIS.includes(campo.tipo)) return null;
  const mapa = new Map<string, T[]>();
  for (const linha of linhas) {
    const v = campo.valorDe(linha);
    const chave = campo.tipo === "caixa" ? (v === true ? "1" : "0") : estaVazio(v) ? "" : String(v);
    const lista = mapa.get(chave);
    if (lista) lista.push(linha);
    else mapa.set(chave, [linha]);
  }
  const rotulo = (chave: string) => (chave === "" ? "" : (campo.rotuloDoValor?.(chave) ?? chave));
  const posicao = (chave: string) => campo.ordemDoValor?.(chave) ?? 0;

  return [...mapa.entries()]
    .sort(([a], [b]) => {
      if (a === "" || b === "") return a === "" ? 1 : -1;
      if (campo.ordemDoValor) return posicao(a) - posicao(b);
      return rotulo(a).localeCompare(rotulo(b), "pt-BR");
    })
    .map(([chave, lista]) => ({ chave, rotulo: rotulo(chave), linhas: lista }));
}

/** Filtra, ordena e (se pedido) agrupa — o pipeline completo da tabela. */
export function aplicarConsulta<T>(
  linhas: readonly T[],
  campos: readonly CampoConsultavel<T>[],
  consulta: ConsultaDaTabela | undefined,
  contexto: ContextoDaConsulta,
): { linhas: T[]; grupos: GrupoDeLinhas<T>[] | null } {
  const c = consulta ?? {};
  const final = ordenar(filtrar(linhas, campos, c.filtros, contexto), campos, c.ordenacao);
  const campoDoGrupo = c.agrupar ? campos.find((k) => k.id === c.agrupar) : undefined;
  const grupos = agrupar(final, campoDoGrupo);
  return { linhas: grupos ? grupos.flatMap((g) => g.linhas) : final, grupos };
}

/**
 * O que uma linha NOVA já traz por causa dos filtros ativos — como no Notion: com o filtro
 * "Status é Em andamento" ligado, a tarefa criada nasce "Em andamento", senão ela sumiria
 * da tela no instante em que é criada.
 *
 * Só vale o filtro que aponta para UM valor certo: opção/pessoa "é" (o primeiro, se houver
 * vários), multi "contém" (todos), texto "contém" (o próprio texto), caixa
 * marcado/desmarcado, data "é" e número "igual". "Não é", "antes", "depois", "não contém"
 * etc. não dizem o que a linha deve ter e são ignorados.
 * Havendo dois filtros sobre o mesmo campo, o último vence.
 */
export function valoresDeNascimento<T>(
  filtros: readonly Filtro[] | undefined,
  campos: readonly CampoConsultavel<T>[],
  contexto: ContextoDaConsulta,
): Record<string, string | number | boolean | string[]> {
  const porId = new Map(campos.map((c) => [c.id, c]));
  const saida: Record<string, string | number | boolean | string[]> = {};
  for (const f of filtros ?? []) {
    const campo = porId.get(f.campo);
    if (!campo || !filtroUtil(f, campo)) continue;
    const lista = Array.isArray(f.valor) ? f.valor : f.valor === undefined ? [] : [String(f.valor)];
    switch (campo.tipo) {
      case "opcao":
      case "pessoa":
        if (f.operador === "e" && lista[0]) saida[campo.id] = lista[0];
        break;
      case "multi":
        if (f.operador === "contem" && lista.length > 0) saida[campo.id] = lista;
        break;
      case "caixa":
        if (f.operador === "marcado") saida[campo.id] = true;
        else if (f.operador === "desmarcado") saida[campo.id] = false;
        break;
      case "data":
        if (f.operador === "e" && lista[0]) {
          saida[campo.id] = lista[0] === "hoje" ? contexto.hoje : lista[0];
        }
        break;
      case "numero":
        if (
          f.operador === "igual" &&
          typeof f.valor !== "object" &&
          Number.isFinite(Number(f.valor))
        ) {
          saida[campo.id] = Number(f.valor);
        }
        break;
      case "texto":
        // "Nome contém teste" → a linha nasce com o texto "teste" (como no Notion).
        if (f.operador === "contem" && typeof f.valor === "string" && f.valor.trim() !== "") {
          saida[campo.id] = f.valor.trim();
        }
        break;
    }
  }
  return saida;
}
