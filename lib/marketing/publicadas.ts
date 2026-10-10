import "server-only";

import { lerChaveDePagina } from "@/lib/marketing/modulos";
import { createClient } from "@/lib/supabase/server";

/**
 * Quais MÓDULOS da empresa têm página publicada. É o que decide se o cartão ainda diz
 * "Em breve": publicou, o "Em breve" some. (Subpáginas contam para o módulo-mãe só se a
 * própria página do módulo estiver publicada — aqui entram apenas as páginas de módulo.)
 */
export async function modulosPublicados(orgId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("marketing_pages")
    .select("module_key")
    .eq("organization_id", orgId)
    .not("published_blocks", "is", null)
    .limit(300);
  const publicados = new Set<string>();
  for (const l of (data ?? []) as Array<{ module_key: string }>) {
    if (lerChaveDePagina(l.module_key)?.tipo === null) publicados.add(l.module_key);
  }
  return publicados;
}
