/**
 * GET /api/v1/anotacoes/estado — as páginas favoritas e as abertas há pouco, DESTA pessoa. É
 * preferência pessoal (a RLS só deixa ver o próprio estado), então não audita.
 */
import { randomUUID } from "node:crypto";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAXIMO_DE_RECENTES = 8;

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", {
    requestId,
    resource: "notes_pages",
    allowPlatformAdmin: "leitura",
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes_user_state")
    .select("page_id, favorite, last_opened_at")
    .eq("user_id", authz.user.id)
    .eq("organization_id", authz.org.orgId)
    .limit(1000);
  if (error) return fail("internal_error", t("Erro ao carregar as anotações."), 500, { requestId });

  const linhas = (data ?? []) as Array<{
    page_id: string;
    favorite: boolean;
    last_opened_at: string | null;
  }>;
  return ok(
    {
      favoritas: linhas.filter((l) => l.favorite).map((l) => l.page_id),
      recentes: linhas
        .filter((l) => l.last_opened_at)
        .sort((a, b) => (b.last_opened_at ?? "").localeCompare(a.last_opened_at ?? ""))
        .slice(0, MAXIMO_DE_RECENTES)
        .map((l) => l.page_id),
    },
    { requestId },
  );
}
