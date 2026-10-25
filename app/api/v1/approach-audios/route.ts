/**
 * GET  /api/v1/approach-audios — a biblioteca de áudios gravados da empresa (viewer+).
 * POST /api/v1/approach-audios — sobe um arquivo de voz (multipart: `file`, `name?`) (manager+).
 * O arquivo é farejado pelos bytes e vai para o bucket privado; só o servidor escreve.
 */
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import {
  BUCKET_DOS_AUDIOS,
  TAMANHO_MAXIMO_DO_AUDIO,
  caminhoDoAudio,
  aceitoNoCanalOficial,
  farejarAudio,
  nomeDoAudio,
} from "@/lib/campanhas/audio-da-abordagem";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const COLUNAS = "id, name, mime, size_bytes, created_at";

export async function GET(): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const { data } = await a.supabase
    .from("approach_audios")
    .select(COLUNAS)
    .eq("organization_id", a.orgId)
    .order("created_at", { ascending: false })
    .limit(200);
  const audios = ((data ?? []) as Array<{ mime: string }>).map((x) => ({
    ...x,
    aceito_no_oficial: aceitoNoCanalOficial(x.mime),
  }));
  return ok({ audios }, { requestId: a.requestId });
}

export async function POST(req: Request): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("file");
  if (!(arquivo instanceof File)) {
    return fail("validation_failed", a.t("Escolha um arquivo de áudio."), 422, {
      requestId: a.requestId,
    });
  }
  if (arquivo.size === 0 || arquivo.size > TAMANHO_MAXIMO_DO_AUDIO) {
    return fail("validation_failed", a.t("O áudio precisa ter até 8 MB."), 422, {
      requestId: a.requestId,
    });
  }
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const mime = farejarAudio(bytes);
  if (!mime) {
    return fail(
      "validation_failed",
      a.t(
        "Esse arquivo não é um áudio que o WhatsApp aceite (use ogg, mp3, m4a, wav, aac ou amr).",
      ),
      422,
      { requestId: a.requestId },
    );
  }
  const nomeEnviado = form?.get("name");
  const nome = nomeDoAudio(
    typeof nomeEnviado === "string" && nomeEnviado ? nomeEnviado : arquivo.name,
  );
  if (!nome) {
    return fail("validation_failed", a.t("Dê um nome ao áudio."), 422, { requestId: a.requestId });
  }

  const admin = createAdminClient();
  const id = randomUUID();
  const caminho = caminhoDoAudio(a.orgId, id, mime);
  const { error: erroDoArquivo } = await admin.storage
    .from(BUCKET_DOS_AUDIOS)
    .upload(caminho, bytes, { contentType: mime, upsert: false });
  if (erroDoArquivo) {
    return fail("internal_error", a.t("Erro ao guardar o áudio."), 500, { requestId: a.requestId });
  }
  const { data, error } = await admin
    .from("approach_audios")
    .insert({
      id,
      organization_id: a.orgId,
      name: nome,
      storage_path: caminho,
      mime,
      size_bytes: arquivo.size,
      created_by: a.userId,
    })
    .select(COLUNAS)
    .maybeSingle();
  if (error || !data) {
    // O registro não nasceu: o arquivo não pode ficar órfão no bucket.
    await admin.storage.from(BUCKET_DOS_AUDIOS).remove([caminho]);
    return fail("internal_error", a.t("Erro ao guardar o áudio."), 500, { requestId: a.requestId });
  }
  void audit({
    action: "approach_audio.uploaded",
    actorUserId: a.userId,
    organizationId: a.orgId,
    resourceType: "approach_audio",
    resourceId: id,
    requestId: a.requestId,
    metadata: { mime, size_bytes: arquivo.size },
  });
  return ok({ audio: data }, { requestId: a.requestId, status: 201 });
}
