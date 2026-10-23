import { z } from "zod";

import { FORMATOS_DO_CRIATIVO, type Criativo } from "@/lib/marketing/criativos";

/**
 * OS MODELOS DE CRIATIVO (migration 0654): o criativo pronto, com as 5 legendas, os 5 títulos e as
 * 5 descrições, o link e o design (Canva), onde uma TAG (ex.: TROCACITY) marca o que muda de um
 * evento para o outro. "Criar a partir do modelo" troca a tag pelo valor (a cidade) em todos os
 * textos e no nome, e o criativo nasce como "planejado", antes de subir no Meta.
 */
export interface ModeloDeCriativo {
  id: string;
  name: string;
  tag: string;
  format: Criativo["format"];
  headlines: string[];
  bodies: string[];
  descriptions: string[];
  link_url: string;
  design_url: string;
  notes: string;
  position: number;
}

export const COLUNAS_DO_MODELO =
  "id, name, tag, format, headlines, bodies, descriptions, link_url, design_url, notes, position";

const link = z
  .string()
  .trim()
  .max(1000)
  .refine((u) => u === "" || /^https?:\/\/[^\s]+$/i.test(u), { message: "Use um link http(s)." });

const camposSchema = z.object({
  name: z.string().trim().min(1).max(160),
  tag: z.string().trim().min(2).max(40),
  format: z.enum(FORMATOS_DO_CRIATIVO),
  headlines: z.array(z.string().trim().max(300)).max(5),
  bodies: z.array(z.string().trim().max(4000)).max(5),
  descriptions: z.array(z.string().trim().max(1000)).max(5),
  link_url: link,
  design_url: link,
  notes: z.string().trim().max(2000),
});
export const novoModeloSchema = camposSchema.partial().required({ name: true });
export const edicaoDeModeloSchema = camposSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para alterar." });

export const criarDoModeloSchema = z.object({
  template_ids: z.array(z.string().uuid()).min(1).max(20),
  /** O que entra no lugar da tag (a cidade do evento). */
  valor: z.string().trim().min(1).max(80),
});

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Troca a tag pelo valor, sem diferenciar maiúsculas de minúsculas. Tag vazia não troca nada. */
export function trocarTag(texto: string, tag: string, valor: string): string {
  if (!tag.trim()) return texto;
  return texto.replace(new RegExp(escapar(tag.trim()), "gi"), valor);
}

const lista = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function modeloDaLinha(l: Record<string, unknown>): ModeloDeCriativo {
  return {
    ...(l as unknown as ModeloDeCriativo),
    headlines: lista(l.headlines),
    bodies: lista(l.bodies),
    descriptions: lista(l.descriptions),
    position: Number(l.position) || 0,
  };
}

/** Os campos do criativo planejado, com a tag trocada em tudo (nome, textos e links). */
export function criativoDoModelo(m: ModeloDeCriativo, valor: string) {
  const troca = (t: string) => trocarTag(t, m.tag, valor);
  const headlines = m.headlines.map(troca);
  const bodies = m.bodies.map(troca);
  return {
    name: troca(m.name).slice(0, 160),
    status: "planejado" as const,
    format: m.format,
    headline: (headlines[0] ?? "").slice(0, 300),
    caption: (bodies[0] ?? "").slice(0, 4000),
    headlines,
    bodies,
    descriptions: m.descriptions.map(troca),
    link_url: troca(m.link_url),
    design_url: m.design_url,
    notes: troca(m.notes),
  };
}

/** Nome comparável: sem acento, caixa nem espaços sobrando (casar o planejado com o do Meta). */
export const nomeComparavel = (n: string) =>
  n
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
