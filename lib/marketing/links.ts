import { randomBytes } from "node:crypto";

import { z } from "zod";

import { chaveDeModuloSchema } from "./paginas";

/** A "página" do cronograma, que também tem link sem login (não é um módulo da estratégia). */
export const CHAVE_DO_CRONOGRAMA = "cronograma";

/**
 * O LINK SEM LOGIN que a agência entrega ao cliente (migration 0587).
 *
 * O token é um segredo ao portador: 32 bytes aleatórios em base64url (43 caracteres, 256 bits)
 * — impossível de adivinhar. Quem tem o link vê o que foi PUBLICADO da empresa dona dele,
 * somente leitura; nada mais. Revogar (ou vencer) responde 404, igual a um link que nunca
 * existiu, para o endereço não confirmar nada a quem tenta chutar.
 */
export const BYTES_DO_TOKEN = 32;
export const MAXIMO_DE_LINKS_VIGENTES = 20;

export const gerarToken = (): string => randomBytes(BYTES_DO_TOKEN).toString("base64url");

/** A forma de um token válido (a rota pública descarta o resto sem tocar no banco). */
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32,64}$/);

export const criacaoDeLinkSchema = z.object({
  /** `null`/ausente = o painel inteiro (todas as páginas publicadas). */
  module_key: z
    .union([chaveDeModuloSchema, z.literal(CHAVE_DO_CRONOGRAMA)])
    .nullable()
    .optional(),
  /** `null`/ausente = não vence. */
  expires_in_days: z.number().int().min(1).max(365).nullable().optional(),
});

export interface LinkDeMarketing {
  id: string;
  module_key: string | null;
  token: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  last_used_at: string | null;
  /** O título da página do link (para a agência saber qual é qual); vem da listagem. */
  page_title?: string | null;
}

export const COLUNAS_DO_LINK =
  "id, module_key, token, expires_at, revoked_at, created_at, last_used_at";

/** O link está valendo? (não revogado e não vencido) */
export function linkVigente(
  link: Pick<LinkDeMarketing, "expires_at" | "revoked_at">,
  agora: Date = new Date(),
): boolean {
  if (link.revoked_at) return false;
  if (link.expires_at && new Date(link.expires_at).getTime() <= agora.getTime()) return false;
  return true;
}

/** O endereço que a agência copia. */
export const enderecoDoLink = (origem: string, token: string): string =>
  `${origem.replace(/\/$/, "")}/p/${token}`;
