/**
 * O perfil do cliente na G1 vem da URL (sem tabela, sem migration): a tela provisória deixa a
 * agência testar o diagnóstico em cada perfil. A G2 passa a guardar o perfil em `guia_perfil`.
 */
import { z } from "zod";

import { MODELOS_DE_VENDA, NICHOS, type Perfil } from "./tipos";

const lista = z
  .string()
  .max(200)
  .transform((s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.enum(MODELOS_DE_VENDA)).max(MODELOS_DE_VENDA.length));

export const perfilDaUrlSchema = z.object({
  nicho: z.enum(NICHOS),
  modelos: lista.default([]),
  ja_tem_oferta: z
    .enum(["1", "true", "0", "false"])
    .default("0")
    .transform((v) => v === "1" || v === "true"),
});

/** Lê o perfil de `?nicho=&modelos=a,b&ja_tem_oferta=1`. Sem `nicho` não há perfil (`null`); valor inválido é erro. */
export function lerPerfilDaUrl(
  params: URLSearchParams,
): { ok: true; perfil: Perfil | null } | { ok: false; erro: string } {
  if (!params.get("nicho")) return { ok: true, perfil: null };
  const r = perfilDaUrlSchema.safeParse({
    nicho: params.get("nicho"),
    modelos: params.get("modelos") ?? undefined,
    ja_tem_oferta: params.get("ja_tem_oferta") ?? undefined,
  });
  if (!r.success)
    return { ok: false, erro: "Perfil inválido: confira nicho, modelos e ja_tem_oferta." };
  return {
    ok: true,
    perfil: {
      nicho: r.data.nicho,
      modelos: [...new Set(r.data.modelos)],
      jaTemOferta: r.data.ja_tem_oferta,
    },
  };
}
