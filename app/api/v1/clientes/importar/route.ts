import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * POST /api/v1/clientes/importar — põe pessoas (leads) no CRM, de um formulário ou de uma
 * planilha (as células já separadas; a 1ª linha é o cabeçalho). Atendente em diante.
 *
 * Um lead é a PESSOA: basta nome e telefone ou e-mail, e ele pode ficar guardado SEM funil e
 * SEM venda (base de contatos, lista para uma campanha futura). Tudo o mais é opcional — origem,
 * funil, etapa, produto, valor, status e previsão da venda, descrição, etiquetas, nascimento e
 * qualquer coluna a mais (vira campo personalizado).
 *
 * Quem não tem funil fica só como contato. Quem tem funil entra como card na etapa pedida e,
 * por regra do banco, com uma venda atrelada (de interesse); se a planilha trouxe produto, valor
 * ou status, a venda sai preenchida. A mesma pessoa (telefone ou e-mail) nunca vira dois leads:
 * o que já existe é completado.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { emitLeadActivity } from "@/lib/leads/activity-emitter";
import { createLeadHandler } from "@/app/api/v1/leads/_handler";
import { ApiError } from "@/lib/api/types";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { phoneLookupVariants } from "@/lib/channels/phone-variants";
import { CSV_MAX_DATA_ROWS } from "@/lib/contacts/csv";
import { normalizarTags } from "@/lib/contacts/tag-normalizada";
import { traduzir } from "@/lib/i18n/dicionario";
import {
  lerLinhasDeClientes,
  type ErroDaLinha,
  type LinhaDeCliente,
} from "@/lib/leads/planilha-de-clientes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  celulas: z.array(z.array(z.string().max(4000)).max(80)).min(2).max(CSV_MAX_DATA_ROWS + 1),
  /** Funil para quem não trouxe o próprio; vazio = só guardar os contatos. */
  pipeline_id: z.string().uuid().nullable().optional(),
  stage_id: z.string().uuid().nullable().optional(),
});

interface Resumo {
  total_linhas: number;
  contatos_criados: number;
  contatos_atualizados: number;
  cards_criados: number;
  sem_funil: number;
  erros: ErroDaLinha[];
  colunas_personalizadas: string[];
}

const chaveDoCampo = (rotulo: string) => {
  const base = rotulo
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36);
  return /^[a-z]/.test(base) ? base : `campo_${base}`;
};

const semAcento = (x: string) =>
  x
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const orgId = authz.org.orgId;

  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });

  const lido = lerLinhasDeClientes(corpo.data.celulas, t);
  if ("erro" in lido) return fail("validation_failed", lido.erro, 422, { requestId });

  const supabase = await createClient();

  // Funis e etapas da organização (por nome, sem diferenciar caixa nem acento).
  const [{ data: funisRows }, { data: etapasRows }] = await Promise.all([
    supabase
      .from("crm_pipelines")
      .select("id, name")
      .eq("organization_id", orgId)
      .eq("is_archived", false),
    supabase
      .from("crm_stages")
      .select("id, pipeline_id, name, is_won, is_lost, is_archived, position")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .order("position", { ascending: true }),
  ]);
  const funis = (funisRows ?? []) as Array<{ id: string; name: string }>;
  const etapas = (etapasRows ?? []) as Array<{
    id: string;
    pipeline_id: string;
    name: string;
    is_won: boolean;
    is_lost: boolean;
  }>;
  const funilPorNome = new Map(funis.map((f) => [semAcento(f.name), f.id]));
  const funilPadrao = corpo.data.pipeline_id ?? null;
  if (funilPadrao && !funis.some((f) => f.id === funilPadrao)) {
    return fail("validation_failed", t("Funil não encontrado."), 404, { requestId });
  }
  const etapasAbertas = (funilId: string) =>
    etapas.filter((e) => e.pipeline_id === funilId && !e.is_won && !e.is_lost);

  // A cascata de origem: campanha → anúncio → página, pelo nome (para ligar o card pelos ids).
  const [{ data: campanhasRows }, { data: criativosRows }, { data: paginasRows }] =
    await Promise.all([
      supabase.from("demand_campaigns").select("id, name").eq("organization_id", orgId).limit(500),
      supabase
        .from("demand_campaign_creatives")
        .select("id, name, campaign_id")
        .eq("organization_id", orgId)
        .limit(3000),
      supabase
        .from("demand_campaign_landing_pages")
        .select("id, name, campaign_id")
        .eq("organization_id", orgId)
        .limit(2000),
    ]);
  const campanhaPorNome = new Map(
    ((campanhasRows ?? []) as Array<{ id: string; name: string }>).map((c) => [semAcento(c.name), c.id]),
  );
  const criativos = (criativosRows ?? []) as Array<{ id: string; name: string; campaign_id: string }>;
  const paginas = (paginasRows ?? []) as Array<{ id: string; name: string; campaign_id: string }>;

  // O catálogo de produtos (para casar o nome do produto com o cadastro).
  const { data: catalogo } = await supabase
    .from("marketing_pages")
    .select("id, title")
    .eq("organization_id", orgId)
    .like("module_key", "produtos-e-ofertas--%")
    .limit(500);
  const produtoPorNome = new Map(
    ((catalogo ?? []) as Array<{ id: string; title: string }>).map((p) => [semAcento(p.title), p]),
  );

  const resumo: Resumo = {
    total_linhas: lido.linhas.length + lido.erros.length,
    contatos_criados: 0,
    contatos_atualizados: 0,
    cards_criados: 0,
    sem_funil: 0,
    erros: [...lido.erros],
    colunas_personalizadas: lido.colunasPersonalizadas,
  };

  // A mesma pessoa repetida na planilha vira UMA.
  const jaVistos = new Map<string, string>();

  async function acharContato(l: LinhaDeCliente): Promise<{
    id: string;
    tags: string[];
    custom_fields: Record<string, unknown>;
    birthdate: string | null;
    name: string | null;
    email: string | null;
    phone_number: string | null;
    source_metadata: Record<string, unknown>;
  } | null> {
    const colunas = "id, name, email, phone_number, tags, custom_fields, birthdate, source_metadata";
    if (l.telefone) {
      const { data } = await supabase
        .from("contacts")
        .select(colunas)
        .eq("organization_id", orgId)
        .in("phone_number", phoneLookupVariants(l.telefone))
        .is("is_merged_into", null)
        .limit(1)
        .maybeSingle();
      if (data) return data as never;
    }
    if (l.email) {
      const { data } = await supabase
        .from("contacts")
        .select(colunas)
        .eq("organization_id", orgId)
        .eq("email_normalized", l.email.trim().toLowerCase())
        .is("is_merged_into", null)
        .limit(1)
        .maybeSingle();
      if (data) return data as never;
    }
    return null;
  }

  /** A origem digitada na linha, no modelo do cadastro do lead (nomes + ids por trás). */
  function origemDaLinha(l: LinhaDeCliente) {
    const campanhaId = l.campanha ? (campanhaPorNome.get(semAcento(l.campanha)) ?? null) : null;
    const criativo = l.anuncio
      ? criativos.find(
          (c) =>
            semAcento(c.name) === semAcento(l.anuncio!) &&
            (!campanhaId || c.campaign_id === campanhaId),
        )
      : undefined;
    const pagina = l.landing_page
      ? paginas.find(
          (p) =>
            semAcento(p.name) === semAcento(l.landing_page!) &&
            (!campanhaId || p.campaign_id === campanhaId),
        )
      : undefined;
    const manual: Record<string, string> = {};
    if (l.origem) manual.origem = l.origem;
    if (l.campanha) manual.campanha = l.campanha;
    if (l.conjunto) manual.conjunto = l.conjunto;
    if (l.anuncio) manual.anuncio = l.anuncio;
    if (l.landing_page) manual.lp = l.landing_page;
    if (l.posicionamento) manual.posicionamento = l.posicionamento;
    if (campanhaId) manual.campanha_id = campanhaId;
    if (criativo) manual.anuncio_id = criativo.id;
    if (pagina) manual.lp_id = pagina.id;
    const tagsDeOrigem = [
      l.campanha ? `Campanha: ${l.campanha}` : "",
      l.conjunto ? `Conjunto: ${l.conjunto}` : "",
      l.anuncio ? `Ad: ${l.anuncio}` : "",
      l.landing_page ? `LP: ${l.landing_page}` : "",
    ].filter(Boolean);
    return {
      manual,
      campanhaId: campanhaId ?? criativo?.campaign_id ?? pagina?.campaign_id ?? null,
      criativoId: criativo?.id ?? null,
      paginaId: pagina?.id ?? null,
      tagsDeOrigem,
      temOrigem: Object.keys(manual).length > 0,
    };
  }

  for (const l of lido.linhas) {
    try {
      const orig = origemDaLinha(l);
      const chaveDaLinha = l.telefone ?? `email:${(l.email ?? "").toLowerCase()}`;
      let contactId = jaVistos.get(chaveDaLinha) ?? null;

      // Os campos personalizados da linha: rótulo → chave estável, com o nome guardado.
      const camposDaLinha: Record<string, string> = {};
      const rotulos: Record<string, string> = {};
      for (const [rotulo, v] of Object.entries(l.campos)) {
        const k = chaveDoCampo(rotulo);
        camposDaLinha[k] = v;
        rotulos[k] = rotulo;
      }
      const tags = normalizarTags([...l.etiquetas, ...orig.tagsDeOrigem]);

      if (!contactId) {
        const existente = await acharContato(l);
        if (existente) {
          contactId = existente.id;
          const customAtual = existente.custom_fields ?? {};
          const rotulosAtuais =
            customAtual._rotulos && typeof customAtual._rotulos === "object"
              ? (customAtual._rotulos as Record<string, string>)
              : {};
          const patch: Record<string, unknown> = {};
          const novasTags = normalizarTags([...(existente.tags ?? []), ...tags]);
          if (novasTags.length !== (existente.tags ?? []).length) patch.tags = novasTags;
          const linksDaLinha = l.links ?? {};
          if (Object.keys(camposDaLinha).length > 0 || Object.keys(linksDaLinha).length > 0) {
            patch.custom_fields = {
              ...customAtual,
              ...camposDaLinha,
              ...linksDaLinha,
              ...(Object.keys(camposDaLinha).length > 0
                ? { _rotulos: { ...rotulosAtuais, ...rotulos } }
                : {}),
            };
          }
          // Completa o que faltava no cadastro (nunca sobrescreve o que já está preenchido).
          if (!existente.name && l.nome) patch.name = l.nome;
          if (!existente.email && l.email) patch.email = l.email;
          if (!existente.phone_number && l.telefone) patch.phone_number = l.telefone;
          if (l.nascimento && !existente.birthdate) patch.birthdate = l.nascimento;
          if (orig.temOrigem) {
            const meta = existente.source_metadata ?? {};
            const atual =
              meta.origem_manual && typeof meta.origem_manual === "object"
                ? (meta.origem_manual as Record<string, unknown>)
                : {};
            patch.source_metadata = { ...meta, origem_manual: { ...atual, ...orig.manual } };
          }
          if (Object.keys(patch).length > 0) {
            await supabase.from("contacts").update(patch).eq("id", contactId).eq("organization_id", orgId);
          }
          resumo.contatos_atualizados += 1;
        } else {
          const { data: criado, error } = await supabase
            .from("contacts")
            .insert({
              organization_id: orgId,
              name: l.nome,
              phone_number: l.telefone,
              email: l.email,
              source: l.origem ?? "importacao_planilha",
              tags,
              birthdate: l.nascimento,
              custom_fields: {
                ...(Object.keys(camposDaLinha).length > 0 ? { ...camposDaLinha, _rotulos: rotulos } : {}),
                ...(l.links ?? {}),
              },
              ...(orig.temOrigem ? { source_metadata: { origem_manual: orig.manual } } : {}),
            })
            .select("id")
            .single();
          if (error || !criado) {
            resumo.erros.push({
              linha: l.linha,
              motivo: t("o contato não pôde ser criado"),
            });
            continue;
          }
          contactId = (criado as { id: string }).id;
          resumo.contatos_criados += 1;
        }
        jaVistos.set(chaveDaLinha, contactId);
      }

      // Funil: o da linha (pelo nome) ou o padrão; nenhum = só o contato.
      let funilId: string | null = null;
      if (l.funil) {
        funilId = funilPorNome.get(semAcento(l.funil)) ?? null;
        if (!funilId) {
          resumo.erros.push({
            linha: l.linha,
            motivo: `${t("funil")} "${l.funil}" ${t("não existe — o lead foi guardado sem funil")}`,
          });
        }
      } else {
        funilId = funilPadrao;
      }
      if (!funilId) {
        resumo.sem_funil += 1;
        continue;
      }

      // Etapa: a da linha (pelo nome), a padrão ou a primeira aberta do funil.
      const abertas = etapasAbertas(funilId);
      let etapaId: string | null = null;
      if (l.etapa) {
        etapaId = abertas.find((e) => semAcento(e.name) === semAcento(l.etapa!))?.id ?? null;
        if (!etapaId) {
          resumo.erros.push({
            linha: l.linha,
            motivo: `${t("etapa")} "${l.etapa}" ${t("não existe neste funil — entrou na etapa inicial")}`,
          });
        }
      }
      if (!etapaId && corpo.data.stage_id && etapas.some((e) => e.id === corpo.data.stage_id && e.pipeline_id === funilId)) {
        etapaId = corpo.data.stage_id;
      }
      etapaId = etapaId ?? abertas[0]?.id ?? null;
      if (!etapaId) {
        resumo.erros.push({ linha: l.linha, motivo: t("o funil não tem etapa aberta") });
        continue;
      }

      const lead = (await createLeadHandler(
        supabase,
        { organization_id: orgId, actor: { type: "user", id: authz.user.id }, requestId },
        {
          pipeline_id: funilId,
          stage_id: etapaId,
          title: l.nome,
          contact_id: contactId,
          ...(l.valor_cents !== null ? { value_cents: l.valor_cents } : {}),
          ...(l.descricao ? { description: l.descricao } : {}),
          ...(l.previsao ? { expected_close_date: l.previsao } : {}),
          tags: [],
          source: l.origem ?? "importacao_planilha",
          via_planilha: true,
        },
        { quandoJaExiste: "reaproveitar" },
      )) as unknown as { id?: string; lead?: { id: string }; data?: { id: string } };
      const leadId = lead?.id ?? lead?.lead?.id ?? lead?.data?.id ?? null;
      resumo.cards_criados += 1;

      // A origem do card: campanha, anúncio e página pelos ids (o banco cria as tags de origem) e
      // conjunto e posicionamento no próprio card.
      if (leadId && orig.temOrigem) {
        const patchDoCard: Record<string, unknown> = {};
        if (orig.campanhaId) patchDoCard.demand_campaign_id = orig.campanhaId;
        if (orig.criativoId) patchDoCard.demand_creative_id = orig.criativoId;
        if (orig.paginaId) patchDoCard.demand_landing_page_id = orig.paginaId;
        if (l.origem) patchDoCard.source = l.origem;
        const { data: cardAtual } = await supabase
          .from("crm_leads")
          .select("source_metadata")
          .eq("id", leadId)
          .eq("organization_id", orgId)
          .maybeSingle();
        const metaDoCard = ((cardAtual as { source_metadata: Record<string, unknown> | null } | null)
          ?.source_metadata ?? {}) as Record<string, unknown>;
        patchDoCard.source_metadata = {
          ...metaDoCard,
          origem_manual: {
            ...((metaDoCard.origem_manual as Record<string, unknown> | undefined) ?? {}),
            ...orig.manual,
          },
        };
        await supabase.from("crm_leads").update(patchDoCard).eq("id", leadId).eq("organization_id", orgId);
        const partes = [
          orig.manual.campanha && `campanha ${orig.manual.campanha}`,
          orig.manual.conjunto && `conjunto ${orig.manual.conjunto}`,
          orig.manual.anuncio && `anúncio ${orig.manual.anuncio}`,
          orig.manual.lp && `página ${orig.manual.lp}`,
        ].filter(Boolean);
        if (partes.length > 0) {
          void emitLeadActivity(supabase, {
            organizationId: orgId,
            leadId,
            contactId,
            type: "lead_edited",
            sourceModule: "crm",
            sourceId: leadId,
            actor: { type: "user", id: authz.user.id },
            reason: `Origem registrada: ${partes.join(" · ")}`,
            payload: { origem: orig.manual },
          });
        }
      }

      // A oportunidade (o card): produto, valor e situação da linha. O dinheiro vira parcela:
      // "concluída" = recebida hoje; "comprometida" = prevista para hoje (o time ajusta a data).
      if (leadId && (l.produto || l.valor_cents !== null || l.status_da_venda)) {
        const produto = l.produto ? produtoPorNome.get(semAcento(l.produto)) : undefined;
        if (l.valor_cents !== null) {
          await supabase
            .from("crm_leads")
            .update({ value_cents: l.valor_cents > 0 ? l.valor_cents : null })
            .eq("id", leadId)
            .eq("organization_id", orgId);
        }
        if (produto && l.valor_cents !== null) {
          await supabase.from("crm_sale_items").insert({
            organization_id: orgId,
            lead_id: leadId,
            product_id: produto.id,
            product_name: produto.title.slice(0, 200),
            quantity: 1,
            amount_cents: l.valor_cents,
            position: 0,
          });
        }
        if (
          (l.status_da_venda === "comprometida" || l.status_da_venda === "concluida") &&
          (l.valor_cents ?? 0) > 0
        ) {
          const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
          await supabase.from("crm_sale_payments").insert({
            organization_id: orgId,
            lead_id: leadId,
            number: 1,
            due_on: hoje,
            paid_on: l.status_da_venda === "concluida" ? hoje : null,
            amount_cents: l.valor_cents,
            status: l.status_da_venda === "concluida" ? "recebida" : "prevista",
          });
        }
      }
    } catch (err) {
      resumo.erros.push({
        linha: l.linha,
        motivo:
          err instanceof ApiError || err instanceof Error
            ? err.message.slice(0, 160)
            : t("linha recusada pelo banco"),
      });
    }
  }

  void audit({
    organizationId: orgId,
    actorUserId: authz.user.id,
    action: "lead.imported",
    resourceType: "contacts",
    requestId,
    metadata: {
      total_linhas: resumo.total_linhas,
      contatos_criados: resumo.contatos_criados,
      contatos_atualizados: resumo.contatos_atualizados,
      cards_criados: resumo.cards_criados,
      sem_funil: resumo.sem_funil,
      recusadas: resumo.erros.length,
    },
  });
  return ok(resumo, { requestId });
}
