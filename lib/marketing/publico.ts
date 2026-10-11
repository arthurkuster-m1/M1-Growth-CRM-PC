import {
  COLUNAS_DO_RETRATO,
  RETRATOS_NA_TELA,
  versoesDasLinhas,
  type VersaoDaPagina,
} from "@/lib/marketing/historico";
import { ehOperante } from "@/lib/organizacao/operante";
import { createHash } from "node:crypto";

import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { cssDaMarca, ESCOPO_DA_ORGANIZACAO } from "@/lib/branding/css";
import { marcaDaInstalacao } from "@/lib/branding/instalacao";
import { resolverMarcaDaOrganizacao } from "@/lib/branding/organizacao";
import { env } from "@/lib/env";
import { IDIOMA_PADRAO, type Idioma } from "@/lib/i18n/idiomas";
import { createAdminClient } from "@/lib/supabase/admin";

import { somarDias } from "@/lib/inicio/datas";

import { lerBlocos, type Bloco } from "./blocos";
import {
  COLUNAS_DA_CONFIG,
  COLUNAS_DA_META,
  COLUNAS_DA_TAREFA_NO_CRONOGRAMA,
  COLUNAS_DO_ITEM,
  CONFIG_PADRAO,
  tarefaDoCronograma,
  tarefasDaSemana,
  type ConfigDoCronograma,
  itemDaLinha,
  metaDaLinha,
  type ItemDoCronograma,
  type MetaDoCronograma,
  type TarefaDoCronograma,
} from "./cronograma";
import { linkVigente, tokenSchema } from "./links";
import { lerChaveDePagina } from "./modulos";

/**
 * A LEITURA PÚBLICA do que a agência publicou — o que o link sem login mostra.
 *
 * Roda no servidor com a chave de serviço (quem abre o link não tem sessão, então não há RLS
 * para consultar por ele). Por isso a regra de segurança mora AQUI e é curta:
 *   1. o token tem de ter a forma certa (senão nem toca no banco);
 *   2. o link tem de existir, não estar revogado nem vencido — qualquer falha é "não existe";
 *   3. só sai conteúdo PUBLICADO (`published_blocks`), da empresa dona do link, e do escopo do link.
 * Rascunhos e dados de outras áreas nunca passam por este arquivo.
 */
export interface LinkResolvido {
  linkId: string;
  organizationId: string;
  /** Nulo = o painel inteiro. */
  moduloDoEscopo: string | null;
}

export interface EmpresaDoLink {
  nome: string;
  idioma: Idioma;
  logoUrl: string | null;
  /** O CSS da cor da marca da empresa, escopado em `[data-marca-org]`; nulo = a cor da instalação. */
  cssDaMarca: string | null;
}

export interface PaginaPublicada {
  module_key: string;
  title: string;
  blocos: Bloco[];
  published_at: string | null;
}

/** O IP de quem abre o link, só para o limite de acessos (guardado como hash). */
export function chaveDoLimite(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/** Muitos acessos por minuto vindos do mesmo lugar: recusa (chute de token, ou abuso). */
export async function acessoPermitido(ip: string): Promise<boolean> {
  const r = await checkRateLimit(`mkt-link:${chaveDoLimite(ip)}`, 120, 60);
  return r.allowed;
}

export async function resolverLink(token: string): Promise<LinkResolvido | null> {
  if (!tokenSchema.safeParse(token).success) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("marketing_share_links")
    .select("id, organization_id, module_key, expires_at, revoked_at, last_used_at")
    .eq("token", token)
    .maybeSingle();
  const linha = data as {
    id: string;
    organization_id: string;
    module_key: string | null;
    expires_at: string | null;
    revoked_at: string | null;
    last_used_at: string | null;
  } | null;
  if (!linha || !linkVigente(linha)) return null;

  // Empresa suspensa não mostra nada (mesma régua do resto do produto).
  const { data: org } = await admin
    .from("organizations")
    .select("status")
    .eq("id", linha.organization_id)
    .maybeSingle();
  if (!ehOperante((org as { status?: string } | null)?.status)) return null;

  // Anota o uso no máximo uma vez por minuto (não vira uma escrita por clique).
  const ultimo = linha.last_used_at ? new Date(linha.last_used_at).getTime() : 0;
  if (Date.now() - ultimo > 60_000) {
    void admin
      .from("marketing_share_links")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", linha.id);
  }

  return {
    linkId: linha.id,
    organizationId: linha.organization_id,
    moduloDoEscopo: linha.module_key,
  };
}

/** Só as páginas PUBLICADAS que o escopo do link permite (todas, ou a do módulo do link). */
export async function paginasPublicadas(link: LinkResolvido): Promise<PaginaPublicada[]> {
  const admin = createAdminClient();
  let consulta = admin
    .from("marketing_pages")
    .select("module_key, title, published_blocks, published_at")
    .eq("organization_id", link.organizationId)
    .not("published_blocks", "is", null);
  // Link de um módulo vale também para as subpáginas dele (`<módulo>--…`). A chave do escopo já
  // foi validada na criação (só caracteres de módulo), então entra no filtro sem risco.
  if (link.moduloDoEscopo) {
    consulta = consulta.or(
      `module_key.eq.${link.moduloDoEscopo},module_key.like.${link.moduloDoEscopo}--%`,
    );
  }
  const { data } = await consulta
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(100);
  return (
    (data ?? []) as Array<{
      module_key: string;
      title: string;
      published_blocks: unknown;
      published_at: string | null;
    }>
  )
    .filter((p) => lerChaveDePagina(p.module_key) !== null)
    .map((p) => ({
      module_key: p.module_key,
      title: p.title,
      blocos: lerBlocos(p.published_blocks),
      published_at: p.published_at,
    }));
}

/** O nome, o idioma, o logo e a cor da marca da empresa dona do link. */
export async function empresaDoLink(link: LinkResolvido): Promise<EmpresaDoLink> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("name, locale, settings")
    .eq("id", link.organizationId)
    .maybeSingle();
  const org = data as { name?: string; locale?: string; settings?: unknown } | null;
  const marca = resolverMarcaDaOrganizacao(
    (org?.settings as Record<string, unknown> | null) ?? null,
    await marcaDaInstalacao(),
    env,
  );
  return {
    nome: org?.name?.trim() || marca.name,
    idioma: (org?.locale as Idioma | undefined) ?? IDIOMA_PADRAO,
    logoUrl: marca.origens.logoUrl === "organizacao" ? marca.logoUrl : null,
    cssDaMarca:
      marca.origens.cor === "organizacao" ? cssDaMarca(marca.cor, ESCOPO_DA_ORGANIZACAO).css : null,
  };
}

/** Os retratos (histórico) de UMA página publicada, os mais recentes primeiro. */
export async function retratosDaPagina(
  link: LinkResolvido,
  moduleKey: string,
): Promise<VersaoDaPagina[]> {
  const { data } = await createAdminClient()
    .from("marketing_page_snapshots")
    .select(COLUNAS_DO_RETRATO)
    .eq("organization_id", link.organizationId)
    .eq("module_key", moduleKey)
    .order("taken_at", { ascending: false })
    .limit(RETRATOS_NA_TELA);
  return versoesDasLinhas(
    (data ?? []) as Array<{ id: string; taken_at: string; note: string; blocks: unknown }>,
  );
}

/** O que o link mostra do cronograma: config, metas, ações e as tarefas da semana escolhida. */
export interface CronogramaPublico {
  config: ConfigDoCronograma;
  itens: ItemDoCronograma[];
  metas: MetaDoCronograma[];
  tarefas: TarefaDoCronograma[];
}

export async function cronogramaPublico(
  link: LinkResolvido,
  domingo: string,
): Promise<CronogramaPublico> {
  const admin = createAdminClient();
  const org = link.organizationId;
  const de = new Date(`${somarDias(domingo, -120)}T00:00:00Z`).toISOString();
  const ate = new Date(`${somarDias(domingo, 8)}T00:00:00Z`).toISOString();
  const [cfg, itens, metas, tarefas] = await Promise.all([
    admin
      .from("marketing_cronograma_config")
      .select(COLUNAS_DA_CONFIG)
      .eq("organization_id", org)
      .maybeSingle(),
    admin
      .from("marketing_cronograma_itens")
      .select(COLUNAS_DO_ITEM)
      .eq("organization_id", org)
      .eq("arquivado", false)
      .order("ordem", { ascending: true })
      .limit(520),
    admin
      .from("marketing_cronograma_metas")
      .select(COLUNAS_DA_META)
      .eq("organization_id", org)
      .order("ordem", { ascending: true })
      .limit(12),
    admin
      .from("crm_tasks")
      .select(COLUNAS_DA_TAREFA_NO_CRONOGRAMA)
      .eq("organization_id", org)
      .not("cronograma_lado", "is", null)
      .gte("due_date", de)
      .lte("due_date", ate)
      .order("due_date", { ascending: true })
      .limit(500),
  ]);
  const todas = ((tarefas.data ?? []) as Array<Parameters<typeof tarefaDoCronograma>[0]>).map(
    tarefaDoCronograma,
  );
  return {
    config: (cfg.data as ConfigDoCronograma | null) ?? CONFIG_PADRAO,
    itens: ((itens.data ?? []) as Array<Record<string, unknown>>).map(itemDaLinha),
    metas: ((metas.data ?? []) as Array<Record<string, unknown>>).map(metaDaLinha),
    tarefas: tarefasDaSemana(todas, domingo),
  };
}
