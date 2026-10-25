/**
 * GET /api/v1/approach-audios/:id/url — um endereço assinado e de vida curta (10 min) para OUVIR o
 * áudio da biblioteca na tela. O arquivo continua privado: quem não é da empresa não chega nele.
 */
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { BUCKET_DOS_AUDIOS } from "@/lib/campanhas/audio-da-abordagem";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const VALIDADE_EM_SEGUNDOS = 600;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("not_found", a.t("Áudio não encontrado."), 404, { requestId: a.requestId });
  }
  // A leitura passa pela RLS de quem chama: só enxerga a linha quem é da empresa dela.
  const { data } = await a.supabase
    .from("approach_audios")
    .select("storage_path")
    .eq("organization_id", a.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!data)
    return fail("not_found", a.t("Áudio não encontrado."), 404, { requestId: a.requestId });
  const { data: assinado, error } = await createAdminClient()
    .storage.from(BUCKET_DOS_AUDIOS)
    .createSignedUrl((data as { storage_path: string }).storage_path, VALIDADE_EM_SEGUNDOS);
  if (error || !assinado?.signedUrl) {
    return fail("internal_error", a.t("Erro ao abrir o áudio."), 500, { requestId: a.requestId });
  }
  return ok(
    { url: assinado.signedUrl, expira_em_segundos: VALIDADE_EM_SEGUNDOS },
    { requestId: a.requestId },
  );
}
