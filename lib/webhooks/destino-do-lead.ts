import type { SupabaseClient } from "@supabase/supabase-js";

import { primeiraEtapaDoFunil } from "@/lib/marketing/origem-da-campanha-servidor";

/**
 * PARA ONDE VAI O LEAD QUE CHEGA POR WEBHOOK.
 *
 * O CRM novo (Oportunidades, Vendas, Clientes — funis das campanhas e o funil de clientes) é o ÚNICO
 * destino. O "kanban antigo" — o funil de entrada que o sistema semeia sozinho em toda empresa
 * ("Pedidos", marcado como padrão) e qualquer funil arquivado — não recebe mais lead de webhook:
 * uma fonte que ainda aponta para ele tem o lead redirecionado para o FUNIL DE CLIENTES (primeira
 * etapa). Se a empresa ainda não tem funil de clientes, o lead entra onde a fonte manda — a captação
 * nunca pode perder lead por causa disto.
 *
 * "Funil antigo" é um funil que NÃO é o de clientes, NÃO é o de nenhuma campanha e é o padrão do
 * sistema ou está arquivado. Um funil que a empresa montou de propósito (nem padrão nem arquivado)
 * não é mexido.
 */
export interface FunilParaDestino {
  is_default: boolean;
  is_client_pipeline: boolean;
  is_archived: boolean;
  /** Alguma campanha usa este funil. */
  ehDeCampanha: boolean;
}

export function ehFunilAntigo(f: FunilParaDestino): boolean {
  return !f.is_client_pipeline && !f.ehDeCampanha && (f.is_default || f.is_archived);
}

export interface FunilDeClientes {
  pipelineId: string;
  stageId: string;
}

/** O funil de clientes da empresa com a primeira etapa utilizável; `null` se não há. */
export async function funilDeClientesComEtapa(
  db: SupabaseClient,
  organizationId: string,
): Promise<FunilDeClientes | null> {
  const { data } = await db
    .from("crm_pipelines")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_client_pipeline", true)
    .eq("is_archived", false)
    .maybeSingle();
  const id = (data as { id: string } | null)?.id;
  if (!id) return null;
  const stageId = await primeiraEtapaDoFunil(db, organizationId, id);
  return stageId ? { pipelineId: id, stageId } : null;
}

/** Lê o que `ehFunilAntigo` precisa de um funil da empresa (`null` se o funil não existe aqui). */
export async function lerFunilParaDestino(
  db: SupabaseClient,
  organizationId: string,
  pipelineId: string,
): Promise<FunilParaDestino | null> {
  const { data: funil } = await db
    .from("crm_pipelines")
    .select("is_default, is_client_pipeline, is_archived")
    .eq("organization_id", organizationId)
    .eq("id", pipelineId)
    .maybeSingle();
  if (!funil) return null;
  const { data: campanha } = await db
    .from("demand_campaigns")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("pipeline_id", pipelineId)
    .limit(1)
    .maybeSingle();
  const f = funil as {
    is_default: boolean;
    is_client_pipeline: boolean | null;
    is_archived: boolean;
  };
  return {
    is_default: f.is_default,
    is_client_pipeline: f.is_client_pipeline === true,
    is_archived: f.is_archived,
    ehDeCampanha: Boolean(campanha),
  };
}

/**
 * O destino do webhook: o da fonte, ou — se ele é o funil antigo e existe funil de clientes — o
 * funil de clientes. `redirecionado` diz que o lead foi desviado do funil antigo.
 */
export async function destinoDoWebhook(
  db: SupabaseClient,
  organizationId: string,
  fonte: { pipelineId: string | null; stageId: string | null },
): Promise<{ pipelineId: string | null; stageId: string | null; redirecionado: boolean }> {
  const mantem = { pipelineId: fonte.pipelineId, stageId: fonte.stageId, redirecionado: false };
  if (!fonte.pipelineId) return mantem;
  const funil = await lerFunilParaDestino(db, organizationId, fonte.pipelineId);
  if (!funil || !ehFunilAntigo(funil)) return mantem;
  const clientes = await funilDeClientesComEtapa(db, organizationId);
  if (!clientes) return mantem;
  return { pipelineId: clientes.pipelineId, stageId: clientes.stageId, redirecionado: true };
}
