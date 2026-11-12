/**
 * GET /api/v1/anotacoes/busca?q=… — procura nos títulos e no texto de todas as páginas que a pessoa
 * pode ler (a RLS esconde o resto), sem diferenciar maiúsculas nem acentos. Lixeira fica de fora.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { termoDeBusca, trechoDaBusca } from "@/lib/anotacoes/busca";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAXIMO_DE_RESULTADOS = 20;

export interface ResultadoDeBusca {
  id: string;
  title: string;
  icon: string | null;
  /** Um trecho do texto onde o termo aparece (vazio se só o título casou). */
  trecho: string;
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", {
    requestId,
    resource: "notes_pages",
    allowPlatformAdmin: "leitura",
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const termo = termoDeBusca(req.nextUrl.searchParams.get("q") ?? "");
  if (termo.length < 2) return ok({ resultados: [] as ResultadoDeBusca[] }, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes_pages")
    .select("id, title, icon, search_text, title_fold")
    .eq("organization_id", authz.org.orgId)
    .is("deleted_at", null)
    .or(`title_fold.ilike.%${termo}%,search_fold.ilike.%${termo}%`)
    .order("updated_at", { ascending: false })
    .limit(MAXIMO_DE_RESULTADOS);
  if (error) return fail("internal_error", t("Erro ao buscar nas anotações."), 500, { requestId });

  const linhas = (data ?? []) as Array<{
    id: string;
    title: string;
    icon: string | null;
    search_text: string;
    title_fold: string;
  }>;
  const resultados: ResultadoDeBusca[] = linhas.map((l) => ({
    id: l.id,
    title: l.title,
    icon: l.icon,
    trecho: l.search_text ? trechoDaBusca(l.search_text, termo) : "",
  }));
  return ok({ resultados }, { requestId });
}
