import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * O caminho do arquivo que `notification_icon_path` guarda, lido À PARTE da marca da instalação.
 *
 * Fora do `select` de `marcaDaInstalacao` de propósito: aquela leitura roda em TODO render, e uma
 * coluna ainda ausente (o app novo sobe antes de a migration 0685 chegar ao banco) derrubaria a
 * marca inteira do banco para o `.env`. Aqui a ausência só significa "sem arquivo" (`null`).
 */
export async function caminhoDoIconeDeNotificacao(): Promise<string | null> {
  try {
    const { data, error } = await createAdminClient()
      .from("platform_branding")
      .select("notification_icon_path")
      .eq("id", 1)
      .maybeSingle();
    if (error) return null;
    return (
      (data as { notification_icon_path?: string | null } | null)?.notification_icon_path ?? null
    );
  } catch {
    return null;
  }
}
