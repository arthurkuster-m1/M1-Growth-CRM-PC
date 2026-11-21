/**
 * O PERFIL DO CLIENTE: o formato que a rota aceita (Zod) e a conversão entre a linha de
 * `guia_perfil` (snake_case) e o objeto do código.
 */
import { z } from "zod";

import { MODELOS_DE_VENDA, NICHOS, OBJETIVOS, type Perfil, type PerfilGravado } from "./tipos";

/** Link opcional: vazio vira "sem link"; o resto precisa ser um endereço http(s). */
const link = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), { message: "Endereço inválido." });

export const perfilSchema = z.object({
  nicho: z.enum(NICHOS),
  modelos: z
    .array(z.enum(MODELOS_DE_VENDA))
    .max(MODELOS_DE_VENDA.length)
    .transform((m) => [...new Set(m)]),
  jaTemOferta: z.boolean().default(false),
  objetivo: z
    .enum(OBJETIVOS)
    .nullish()
    .transform((v) => v ?? null),
  ticketMedioCents: z
    .number()
    .int()
    .min(0)
    .max(100_000_000_000)
    .nullish()
    .transform((v) => v ?? null),
  metaLeadsMes: z
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .nullish()
    .transform((v) => v ?? null),
  siteUrl: link,
  instagramUrl: link,
  googleNegocioUrl: link,
});

export type PerfilDeEntrada = z.infer<typeof perfilSchema>;

/** A linha do banco → o perfil gravado. */
export function perfilDaLinha(l: Record<string, unknown>): PerfilGravado {
  return {
    nicho: l.nicho as PerfilGravado["nicho"],
    modelos: (l.modelos as PerfilGravado["modelos"]) ?? [],
    jaTemOferta: l.ja_tem_oferta === true,
    objetivo: (l.objetivo as PerfilGravado["objetivo"]) ?? null,
    ticketMedioCents:
      l.ticket_medio_cents === null || l.ticket_medio_cents === undefined
        ? null
        : Number(l.ticket_medio_cents),
    metaLeadsMes:
      l.meta_leads_mes === null || l.meta_leads_mes === undefined ? null : Number(l.meta_leads_mes),
    siteUrl: (l.site_url as string | null) ?? null,
    instagramUrl: (l.instagram_url as string | null) ?? null,
    googleNegocioUrl: (l.google_negocio_url as string | null) ?? null,
  };
}

/** O perfil gravado → a linha a gravar (a org e o autor entram na rota, de fonte confiável). */
export function linhaDoPerfil(p: PerfilDeEntrada): Record<string, unknown> {
  return {
    nicho: p.nicho,
    modelos: p.modelos,
    ja_tem_oferta: p.jaTemOferta,
    objetivo: p.objetivo,
    ticket_medio_cents: p.ticketMedioCents,
    meta_leads_mes: p.metaLeadsMes,
    site_url: p.siteUrl,
    instagram_url: p.instagramUrl,
    google_negocio_url: p.googleNegocioUrl,
  };
}

/** O que o diagnóstico precisa do perfil gravado. */
export function perfilParaDiagnostico(p: PerfilGravado): Perfil {
  return {
    nicho: p.nicho,
    modelos: p.modelos,
    jaTemOferta: p.jaTemOferta,
    canaisOnline: [p.siteUrl, p.instagramUrl, p.googleNegocioUrl].filter(Boolean).length,
  };
}

/** Reais digitados ("350" ou "1.250,50") → centavos; vazio → null; ilegível → `undefined`. */
export function centavosDoTexto(texto: string): number | null | undefined {
  const limpo = texto.trim();
  if (limpo === "") return null;
  const n = Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
}
