/**
 * DELETE /api/v1/approach-audios/:id — tira um áudio da biblioteca (manager+). Os passos que o
 * usavam ficam sem arquivo (a tela avisa); o arquivo sai do bucket.
 */
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { BUCKET_DOS_AUDIOS } from "@/lib/campanhas/audio-da-abordagem";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("not_found", a.t("Áudio não encontrado."), 404, { requestId: a.requestId });
  }
  const admin = createAdminClient();
  const { data: linha } = await admin
    .from("approach_audios")
    .select("id, storage_path")
    .eq("organization_id", a.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!linha)
    return fail("not_found", a.t("Áudio não encontrado."), 404, { requestId: a.requestId });
  const { error } = await admin
    .from("approach_audios")
    .delete()
    .eq("organization_id", a.orgId)
    .eq("id", id);
  if (error) {
    return fail("internal_error", a.t("Erro ao remover o áudio."), 500, { requestId: a.requestId });
  }
  await admin.storage
    .from(BUCKET_DOS_AUDIOS)
    .remove([(linha as { storage_path: string }).storage_path]);
  void audit({
    action: "approach_audio.deleted",
    actorUserId: a.userId,
    organizationId: a.orgId,
    resourceType: "approach_audio",
    resourceId: id,
    requestId: a.requestId,
    metadata: {},
  });
  return ok({ removido: true }, { requestId: a.requestId });
}
