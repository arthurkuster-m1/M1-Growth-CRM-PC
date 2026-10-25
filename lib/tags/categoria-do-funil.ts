import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import { lerConfigDeCategorias } from "@/lib/tags/categorias";
import { PALETA_DE_ETIQUETAS, chaveDaEtiqueta } from "@/lib/tags/cor-da-etiqueta";

/** O id da categoria de tags de UM funil (cabe nos 40 caracteres que a leitura aceita). */
export const idDaCategoriaDoFunil = (pipelineId: string) => `f-${pipelineId}`;

/** Uma cor da paleta, sempre a mesma para o mesmo funil. */
export function corDoFunil(pipelineId: string): string {
  let h = 0;
  for (const c of pipelineId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETA_DE_ETIQUETAS[h % PALETA_DE_ETIQUETAS.length]!;
}

/**
 * Garante a CATEGORIA DE TAGS do funil (nome do funil, cor própria) e põe nela as tags dadas.
 * Mora em `organizations.settings.categorias_de_tags`, como as demais categorias.
 *
 * ⚠️ Só serve para tag cujo NOME já é próprio do funil (como "Abordagem: <nome>"): a categoria de
 * uma tag é da organização inteira, pelo texto — "Contato" usado em dois funis cairia numa só
 * categoria. Nunca lança: é só a cor e o agrupamento da tag.
 */
export async function garantirCategoriaDoFunil(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    pipelineId: string;
    nomeDoFunil: string;
    tags: readonly string[];
  },
): Promise<void> {
  try {
    const tags = input.tags.map((t) => t.trim()).filter(Boolean);
    if (tags.length === 0) return;
    const { data: org } = await admin
      .from("organizations")
      .select("settings")
      .eq("id", input.organizationId)
      .maybeSingle();
    const settings = (org?.settings as Record<string, unknown> | null) ?? {};
    const config = lerConfigDeCategorias(settings);
    const id = idDaCategoriaDoFunil(input.pipelineId);
    const jaTem = config.categorias.some((c) => c.id === id);
    const faltam = tags.filter((t) => config.tags[chaveDaEtiqueta(t)] !== id);
    if (jaTem && faltam.length === 0) return;
    const categorias = jaTem
      ? config.categorias
      : [
          ...config.categorias,
          {
            id,
            nome: input.nomeDoFunil.trim().slice(0, 40) || "Funil",
            cor: corDoFunil(input.pipelineId),
          },
        ];
    const mapa = { ...config.tags };
    for (const t of tags) mapa[chaveDaEtiqueta(t)] = id;
    await admin
      .from("organizations")
      .update({
        settings: {
          ...settings,
          categorias_de_tags: {
            categorias: categorias.map((c) => ({ id: c.id, nome: c.nome, cor: c.cor })),
            tags: mapa,
          },
        },
      })
      .eq("id", input.organizationId);
  } catch (e) {
    logger.warn("[tags] falha ao garantir a categoria do funil", {
      pipeline_id: input.pipelineId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
