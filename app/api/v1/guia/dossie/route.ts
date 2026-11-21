/**
 * GET /api/v1/guia/dossie?tamanho=completo|resumido&pergunta=… — o Dossiê do projeto em Markdown,
 * para a pessoa colar numa IA dela (docs/PLANO-GUIA-M1.md §9).
 *
 * Piso `manager`. Org da org ativa (cookie validado), NUNCA do query/body. Só leitura, pelo client
 * de SESSÃO. Só dados agregados e de estratégia: nenhum dado pessoal de lead. Gerar o dossiê é
 * tirar informação do sistema, então deixa rastro (`guia.dossie_gerado`), sem gravar o conteúdo.
 */
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { coletarSinais } from "@/lib/guia/coletar-sinais";
import {
  lerAprendizadosDoDossie,
  lerCampanhasDoDossie,
  lerCriativosDoDossie,
  lerPaginasDoDossie,
  nomeDaEmpresa,
} from "@/lib/guia/dados-do-dossie";
import { diagnosticar } from "@/lib/guia/diagnostico";
import { MAXIMO_DA_PERGUNTA, montarDossie } from "@/lib/guia/dossie";
import { GuiaSemMigration, lerGuardado } from "@/lib/guia/guardado";
import { perfilParaDiagnostico } from "@/lib/guia/perfil";
import { SEM_MIGRATION, autorizarGuia } from "@/lib/guia/servidor";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const consultaSchema = z.object({
  tamanho: z.enum(["completo", "resumido"]).default("completo"),
  pergunta: z.string().trim().max(MAXIMO_DA_PERGUNTA).optional(),
});

export async function GET(req: Request): Promise<Response> {
  const a = await autorizarGuia(false);
  if (!a.ok) return a.response;
  const { supabase, orgId, userId, requestId } = a;

  const params = new URL(req.url).searchParams;
  const consulta = consultaSchema.safeParse({
    tamanho: params.get("tamanho") ?? undefined,
    pergunta: params.get("pergunta") ?? undefined,
  });
  if (!consulta.success) return fail("validation_failed", "Pedido inválido.", 422, { requestId });

  try {
    const [guardado, sinais, empresa, paginas, campanhas, criativos, aprendizados] =
      await Promise.all([
        lerGuardado(supabase, orgId),
        coletarSinais(supabase, orgId),
        nomeDaEmpresa(supabase, orgId),
        lerPaginasDoDossie(supabase, orgId),
        lerCampanhasDoDossie(supabase, orgId),
        lerCriativosDoDossie(supabase, orgId),
        lerAprendizadosDoDossie(supabase, orgId),
      ]);
    const agora = new Date();
    const diagnostico = diagnosticar({
      perfil: guardado.perfil ? perfilParaDiagnostico(guardado.perfil) : null,
      sinais,
      manuais: guardado.manuais,
      tarefas: guardado.tarefas,
      agora,
    });
    const dossie = montarDossie(
      {
        empresa,
        perfil: guardado.perfil,
        diagnostico,
        paginas,
        campanhas,
        criativos,
        aprendizados,
        geradoEm: agora,
      },
      consulta.data,
    );

    await audit({
      organizationId: orgId,
      actorUserId: userId,
      action: "guia.dossie_gerado",
      resourceType: "guia_dossie",
      resourceId: orgId,
      requestId,
      metadata: { tamanho: consulta.data.tamanho, caracteres: dossie.caracteres },
    });
    return ok(
      { ...dossie, tamanho: consulta.data.tamanho, geradoEm: agora.toISOString(), empresa },
      { requestId },
    );
  } catch (e) {
    if (e instanceof GuiaSemMigration)
      return fail("guia_sem_migration", SEM_MIGRATION, 503, { requestId });
    logger.error("[guia.dossie] falhou", {
      orgId,
      erro: e instanceof Error ? e.message : String(e),
    });
    return fail("internal_error", "Não foi possível gerar o dossiê agora.", 500, { requestId });
  }
}
