import { z } from "zod";

import { CORES_DA_OPCAO } from "./opcoes-de-status";

/**
 * AS PROPRIEDADES PERSONALIZADAS DAS TAREFAS — as colunas que a organização cria.
 *
 * A DEFINIÇÃO mora em `crm_task_properties` (nome, tipo, opções); o VALOR, em
 * `crm_tasks.custom_fields`, por id de propriedade (migration 0584). O banco só garante
 * a forma e o tamanho; é este módulo que garante que cada valor faz sentido para o TIPO
 * da propriedade — e é a rota quem o chama antes de gravar.
 *
 * ⚠️ A FORMA de `TIPOS_DE_PROPRIEDADE` é requisito de instrumento, não estilo: o
 * extrator de `tests/invariants/vocabulario-banco-x-typescript.test.ts` lê
 * `const X = [...] as const` e compara com o CHECK da migration.
 */
export const TIPOS_DE_PROPRIEDADE = [
  "text",
  "number",
  "select",
  "multi_select",
  "date",
  "checkbox",
  "url",
] as const;
export type TipoDePropriedade = (typeof TIPOS_DE_PROPRIEDADE)[number];

export const TIPOS_COM_OPCOES: readonly TipoDePropriedade[] = ["select", "multi_select"];

const MAXIMO_DE_OPCOES = 100;
const MAXIMO_DE_SELECIONADAS = 50;
const MAXIMO_DE_TEXTO = 2000;

export const opcaoDePropriedadeSchema = z
  .object({
    id: z.string().min(1).max(40),
    name: z.string().trim().min(1).max(60),
    color: z.enum(CORES_DA_OPCAO),
  })
  .strict();
export type OpcaoDePropriedade = z.infer<typeof opcaoDePropriedadeSchema>;

/** A lista de opções: sem id nem nome repetido (o nome sem distinguir caixa). */
export const opcoesDePropriedadeSchema = z
  .array(opcaoDePropriedadeSchema)
  .max(MAXIMO_DE_OPCOES)
  .superRefine((opcoes, ctx) => {
    const ids = new Set<string>();
    const nomes = new Set<string>();
    for (const [i, o] of opcoes.entries()) {
      const nome = o.name.trim().toLowerCase();
      if (ids.has(o.id) || nomes.has(nome)) {
        ctx.addIssue({ code: "custom", path: [i], message: "Opção repetida." });
      }
      ids.add(o.id);
      nomes.add(nome);
    }
  });

/** Uma linha de `crm_task_properties`, como a API a devolve. */
export interface PropriedadeDaTarefa {
  id: string;
  organization_id: string;
  name: string;
  type: TipoDePropriedade;
  options: OpcaoDePropriedade[];
  position: number;
}

export type ValorDePropriedade = string | number | boolean | string[];

export type ResultadoDaValidacao =
  { ok: true; valor: ValorDePropriedade | null } | { ok: false; erro: string };

const recusa = (erro: string): ResultadoDaValidacao => ({ ok: false, erro });

function ehDataValida(texto: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  // Rejeita 2026-02-31: o Date "corrige" para março, e a conversão de volta não bate.
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

function ehLinkValido(texto: string): boolean {
  try {
    const { protocol } = new URL(texto);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * O valor de UMA tarefa para UMA propriedade. `null` (ou vazio) significa "limpar" —
 * e é o único jeito de remover o valor.
 *
 * Seleção só aceita ids que EXISTEM na propriedade: aceitar texto livre faria a opção
 * apagada e a opção digitada à mão se confundirem.
 */
export function validarValor(
  propriedade: Pick<PropriedadeDaTarefa, "type" | "options">,
  valor: unknown,
): ResultadoDaValidacao {
  if (valor === null || valor === undefined || valor === "") return { ok: true, valor: null };
  if (Array.isArray(valor) && valor.length === 0 && propriedade.type === "multi_select") {
    return { ok: true, valor: null };
  }

  switch (propriedade.type) {
    case "text": {
      if (typeof valor !== "string") return recusa("Texto inválido.");
      const texto = valor.trim();
      if (texto.length > MAXIMO_DE_TEXTO) return recusa("Texto longo demais.");
      return { ok: true, valor: texto === "" ? null : texto };
    }
    case "number":
      if (typeof valor !== "number" || !Number.isFinite(valor) || Math.abs(valor) > 1e15) {
        return recusa("Número inválido.");
      }
      return { ok: true, valor };
    case "select": {
      if (typeof valor !== "string") return recusa("Opção inválida.");
      if (!propriedade.options.some((o) => o.id === valor)) return recusa("Opção inexistente.");
      return { ok: true, valor };
    }
    case "multi_select": {
      if (!Array.isArray(valor) || valor.some((v) => typeof v !== "string")) {
        return recusa("Opções inválidas.");
      }
      const unicas = [...new Set(valor as string[])];
      if (unicas.length > MAXIMO_DE_SELECIONADAS) return recusa("Opções demais.");
      if (unicas.some((id) => !propriedade.options.some((o) => o.id === id))) {
        return recusa("Opção inexistente.");
      }
      return { ok: true, valor: unicas };
    }
    case "date":
      if (typeof valor !== "string" || !ehDataValida(valor)) return recusa("Data inválida.");
      return { ok: true, valor };
    case "checkbox":
      if (typeof valor !== "boolean") return recusa("Valor inválido.");
      return { ok: true, valor };
    case "url": {
      if (typeof valor !== "string") return recusa("Link inválido.");
      const link = valor.trim();
      if (link.length > MAXIMO_DE_TEXTO || !ehLinkValido(link)) return recusa("Link inválido.");
      return { ok: true, valor: link };
    }
  }
}

export type ResultadoDaMescla =
  | { ok: true; campos: Record<string, ValorDePropriedade> }
  | { ok: false; erro: string; propriedadeId: string };

/**
 * Aplica as alterações de `custom_fields` sobre o que a tarefa já tem.
 *
 * Só aceita chave de propriedade que EXISTE na organização (um id forjado não vira dado
 * novo), valida cada valor contra o tipo e remove a chave quando o valor é `null`. As
 * chaves órfãs que a tarefa já carregava (propriedade apagada) ficam como estão — são
 * inofensivas e nenhuma tela as lê.
 */
export function mesclarCamposPersonalizados(
  atual: Record<string, unknown>,
  alteracoes: Record<string, unknown>,
  propriedades: readonly PropriedadeDaTarefa[],
): ResultadoDaMescla {
  const campos = { ...atual } as Record<string, ValorDePropriedade>;
  for (const [id, bruto] of Object.entries(alteracoes)) {
    const propriedade = propriedades.find((p) => p.id === id);
    if (!propriedade) return { ok: false, erro: "Propriedade inexistente.", propriedadeId: id };
    const r = validarValor(propriedade, bruto);
    if (!r.ok) return { ok: false, erro: r.erro, propriedadeId: id };
    if (r.valor === null) delete campos[id];
    else campos[id] = r.valor;
  }
  return { ok: true, campos };
}

/** O `custom_fields` que a rota aceita no PATCH: id → valor bruto (a validação é por tipo). */
export const alteracoesDeCamposSchema = z
  .record(z.string().uuid(), z.unknown())
  .refine((r) => Object.keys(r).length <= 50, { message: "Propriedades demais." });
