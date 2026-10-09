import { z } from "zod";

import { somarDias } from "@/lib/inicio/datas";

import { chaveDoPeriodo } from "./calendario";

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
    /**
     * Como este filtro se liga ao ANTERIOR: `e` (padrão) ou `ou`. O "e" prende mais forte:
     * `A e B ou C` é `(A e B) ou C`, como no Notion. Ignorado no primeiro filtro.
     */
    juncao: z.enum(["e", "ou"]).optional(),
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
    /** Campo de data agrupado por dia, semana (começa na segunda) ou mês. Padrão: dia. */
    agruparPor: z.enum(["dia", "semana", "mes"]).optional(),
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
      const achou = normalizar(String(valor ?? "")).includes(
        normalizar(String(f.valor ?? "")).trim(),
      );
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

/**
 * Fica só com as linhas que passam nos filtros. Os filtros ligados por "e" formam um grupo
 * (todos têm de passar); a linha vale se passar em QUALQUER grupo — os grupos são separados
 * pelos filtros marcados "ou". Sem nenhum "ou", é o "todos os filtros" de sempre.
 */
export function filtrar<T>(
  linhas: readonly T[],
  campos: readonly CampoConsultavel<T>[],
  filtros: readonly Filtro[] | undefined,
  contexto: ContextoDaConsulta,
): T[] {
  const porId = new Map(campos.map((c) => [c.id, c]));
  const grupos: Array<Array<{ f: Filtro; campo: CampoConsultavel<T> }>> = [];
  // Um filtro sem efeito (campo apagado, valor vazio) some, mas o "ou" que ele trazia
  // continua valendo para o próximo — senão apagar uma propriedade fundiria dois grupos.
  let novoGrupo = true;
  (filtros ?? []).forEach((f, i) => {
    if (i > 0 && f.juncao === "ou") novoGrupo = true;
    const campo = porId.get(f.campo);
    if (!campo || !filtroUtil(f, campo)) return;
    if (novoGrupo || grupos.length === 0) grupos.push([]);
    novoGrupo = false;
    grupos[grupos.length - 1]!.push({ f, campo });
  });
  if (grupos.length === 0) return [...linhas];
  return linhas.filter((linha) =>
    grupos.some((g) =>
      g.every(({ f, campo }) => aprova(campo.valorDe(linha), campo.tipo, f, contexto)),
    ),
  );
}

/**
 * Os filtros em que a linha NÃO passa. Vazio = ela passa na consulta inteira.
 *
 * Serve para AVISAR: a linha que acabou de ser criada e não combina com os filtros ligados
 * ficaria invisível; a tela a mantém à vista e diz em quais filtros ela não passa.
 */
export function filtrosQueReprovam<T>(
  linha: T,
  campos: readonly CampoConsultavel<T>[],
  filtros: readonly Filtro[] | undefined,
  contexto: ContextoDaConsulta,
): Filtro[] {
  if (filtrar([linha], campos, filtros, contexto).length === 1) return [];
  const porId = new Map(campos.map((c) => [c.id, c]));
  return (filtros ?? []).filter((f) => {
    const campo = porId.get(f.campo);
    return campo && filtroUtil(f, campo) && !aprova(campo.valorDe(linha), campo.tipo, f, contexto);
  });
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

/**
 * Todos os tipos se agrupam — o agrupamento oferece os MESMOS campos que o filtro,
 * inclusive as propriedades que a organização criar depois.
 */
export const TIPOS_AGRUPAVEIS: readonly TipoDeCampo[] = TIPOS_DE_CAMPO;

/**
 * Parte as linhas em grupos pelo valor do campo.
 *
 * Ordem dos grupos: a lista fixa do campo (status, prioridade) quando há; datas em ordem
 * cronológica; números em ordem numérica; o resto pelo nome. "Sem valor" fica por último.
 * Dentro de cada grupo a ordem de entrada é mantida.
 *
 * Datas: `granularidade` junta os dias em semana (a chave é a segunda-feira) ou mês (a chave
 * é o dia 1) — um grupo por dia vira dezenas de grupos.
 *
 * Campo de VÁRIOS valores (multi): a linha entra em UM grupo por valor que tem — como no
 * Notion. Por isso, com multi, a mesma linha pode aparecer em mais de um grupo.
 */
export function agrupar<T>(
  linhas: readonly T[],
  campo: CampoConsultavel<T> | undefined,
  granularidade: "dia" | "semana" | "mes" = "dia",
): GrupoDeLinhas<T>[] | null {
  if (!campo || !TIPOS_AGRUPAVEIS.includes(campo.tipo)) return null;
  const mapa = new Map<string, T[]>();
  const poe = (chave: string, linha: T) => {
    const lista = mapa.get(chave);
    if (lista) lista.push(linha);
    else mapa.set(chave, [linha]);
  };
  for (const linha of linhas) {
    const v = campo.valorDe(linha);
    if (campo.tipo === "caixa") poe(v === true ? "1" : "0", linha);
    else if (campo.tipo === "multi" && Array.isArray(v) && v.length > 0) {
      for (const valor of new Set(v)) poe(String(valor), linha);
    } else if (campo.tipo === "data" && typeof v === "string" && v !== "") {
      poe(chaveDoPeriodo(v, granularidade), linha);
    } else poe(estaVazio(v) ? "" : String(v), linha);
  }
  const rotulo = (chave: string) => (chave === "" ? "" : (campo.rotuloDoValor?.(chave) ?? chave));
  const posicao = (chave: string) => campo.ordemDoValor?.(chave) ?? 0;

  return [...mapa.entries()]
    .sort(([a], [b]) => {
      if (a === "" || b === "") return a === "" ? 1 : -1;
      if (campo.ordemDoValor) return posicao(a) - posicao(b);
      if (campo.tipo === "data") return a.localeCompare(b);
      if (campo.tipo === "numero") return Number(a) - Number(b);
      return rotulo(a).localeCompare(rotulo(b), "pt-BR", { numeric: true });
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
  const grupos = agrupar(final, campoDoGrupo, c.agruparPor);
  return { linhas: grupos ? grupos.flatMap((g) => g.linhas) : final, grupos };
}

/**
 * O que uma linha NOVA já traz por causa dos filtros ativos — como no Notion: com o filtro
 * "Status é Em andamento" ligado, a tarefa criada nasce "Em andamento", senão ela sumiria
 * da tela no instante em que é criada.
 *
 * A regra é uma só: a linha nova NASCE PASSANDO nos filtros, para não sumir da tela no
 * instante em que é criada. Opção/pessoa "é" (o primeiro, se houver vários), multi "contém"
 * (todos), texto "contém" (o próprio texto), caixa marcado/desmarcado, data "é" (o dia),
 * "antes de" / "depois de" (o dia vizinho do limite), número "igual" (o valor), "maior que" /
 * "menor que" (o vizinho que passa). O que não aponta para um valor ("não é", "não contém",
 * "está preenchido") é ignorado: a linha nasce vazia nesse campo.
 * Havendo dois filtros sobre o mesmo campo, o último vence.
 */
export function valoresDeNascimento<T>(
  filtros: readonly Filtro[] | undefined,
  campos: readonly CampoConsultavel<T>[],
  contexto: ContextoDaConsulta,
): Record<string, string | number | boolean | string[]> {
  const porId = new Map(campos.map((c) => [c.id, c]));
  const saida: Record<string, string | number | boolean | string[]> = {};
  // Com "ou", só o PRIMEIRO grupo diz o que a linha deve ter: nascer com o valor dele a
  // deixa à vista (passa em pelo menos um grupo); misturar os grupos a faria sumir.
  const corte = (filtros ?? []).findIndex((f, i) => i > 0 && f.juncao === "ou");
  const doGrupo = corte < 0 ? (filtros ?? []) : (filtros ?? []).slice(0, corte);
  for (const f of doGrupo) {
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
      case "data": {
        if (!lista[0]) break;
        const base = lista[0] === "hoje" ? contexto.hoje : lista[0];
        // "é" → o próprio dia. "antes de" / "depois de" não dizem UM dia, mas a linha tem de
        // ficar à vista: nasce no dia imediatamente anterior / posterior ao limite.
        if (f.operador === "e") saida[campo.id] = base;
        else if (f.operador === "antes") saida[campo.id] = somarDias(base, -1);
        else if (f.operador === "depois") saida[campo.id] = somarDias(base, 1);
        break;
      }
      case "numero": {
        if (typeof f.valor === "object" || !Number.isFinite(Number(f.valor))) break;
        const n = Number(f.valor);
        // "maior que" / "menor que": o vizinho que passa no filtro.
        if (f.operador === "igual") saida[campo.id] = n;
        else if (f.operador === "maior") saida[campo.id] = n + 1;
        else if (f.operador === "menor") saida[campo.id] = n - 1;
        break;
      }
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
