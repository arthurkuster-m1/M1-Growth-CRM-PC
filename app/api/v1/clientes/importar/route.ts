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
import {
  CAMPANHA_PADRAO_DAS_LPS,
  planejarOrigem,
  semAcento,
  type CatalogoDeOrigem,
  type PlanoDeOrigem,
} from "@/lib/leads/origem-da-importacao";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  celulas: z
    .array(z.array(z.string().max(4000)).max(80))
    .min(2)
    .max(CSV_MAX_DATA_ROWS + 1),
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
  /** Landing pages (e campanhas para abrigá-las) que não existiam e foram cadastradas. */
  lps_criadas: number;
  campanhas_criadas: number;
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

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const inicioDaImportacao = Date.now() - 10_000;
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
        .select("id, name, url, campaign_id")
        .eq("organization_id", orgId)
        .limit(2000),
    ]);
  const criativos = (criativosRows ?? []) as Array<{
    id: string;
    name: string;
    campaign_id: string;
  }>;
  const paginas = (paginasRows ?? []) as CatalogoDeOrigem["paginas"];
  const campanhas = (campanhasRows ?? []) as CatalogoDeOrigem["campanhas"];
  const catalogoDeOrigem: CatalogoDeOrigem = { campanhas, criativos, paginas };

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
    lps_criadas: 0,
    campanhas_criadas: 0,
  };

  // A ORIGEM de cada linha. A landing page que não está cadastrada é cadastrada agora (dentro da
  // campanha da linha, criada se preciso): sem isso o lead guardava só o texto, sem vínculo.
  const planos = new Map<number, PlanoDeOrigem>();
  for (const l of lido.linhas) planos.set(l.linha, planejarOrigem(l, catalogoDeOrigem));
  {
    const admin = createAdminClient();
    const campanhaCriada = new Map<string, string>();
    const lpCriada = new Map<string, string>();
    for (const [linha, plano] of planos) {
      if (!plano.paginaNova) continue;
      try {
        let campanhaId = plano.campanhaId;
        if (!campanhaId && plano.campanhaNova) {
          const chave = semAcento(plano.campanhaNova);
          campanhaId = campanhaCriada.get(chave) ?? null;
          if (!campanhaId) {
            const { data, error } = await admin
              .from("demand_campaigns")
              .insert({
                organization_id: orgId,
                created_by: authz.user.id,
                name: plano.campanhaNova,
                channel: "trafego_pago",
                description:
                  plano.campanhaNova === CAMPANHA_PADRAO_DAS_LPS
                    ? "Criada pela importação de leads para abrigar landing pages sem campanha."
                    : "",
              })
              .select("id")
              .single();
            if (error || !data) throw new Error("campanha");
            campanhaId = (data as { id: string }).id;
            campanhaCriada.set(chave, campanhaId);
            resumo.campanhas_criadas += 1;
          }
        }
        if (!campanhaId) throw new Error("campanha");
        const chaveLp = `${campanhaId}|${semAcento(plano.paginaNova.nome)}`;
        let paginaId = lpCriada.get(chaveLp) ?? null;
        if (!paginaId) {
          const { data, error } = await admin
            .from("demand_campaign_landing_pages")
            .insert({
              organization_id: orgId,
              campaign_id: campanhaId,
              created_by: authz.user.id,
              name: plano.paginaNova.nome,
              url: plano.paginaNova.url.slice(0, 1000),
            })
            .select("id")
            .single();
          if (error || !data) throw new Error("lp");
          paginaId = (data as { id: string }).id;
          lpCriada.set(chaveLp, paginaId);
          resumo.lps_criadas += 1;
        }
        plano.campanhaId = campanhaId;
        plano.paginaId = paginaId;
      } catch {
        resumo.erros.push({
          linha,
          motivo: t("a landing page não pôde ser cadastrada — o lead entrou só com o texto dela"),
        });
      }
    }
  }

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
    const colunas =
      "id, name, email, phone_number, tags, custom_fields, birthdate, source_metadata";
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
    const plano = planos.get(l.linha)!;
    const manual: Record<string, string> = {};
    if (l.origem) manual.origem = l.origem;
    if (l.campanha) manual.campanha = l.campanha;
    if (l.conjunto) manual.conjunto = l.conjunto;
    if (l.anuncio) manual.anuncio = l.anuncio;
    if (l.landing_page) manual.lp = l.landing_page;
    if (l.posicionamento) manual.posicionamento = l.posicionamento;
    if (plano.campanhaId) manual.campanha_id = plano.campanhaId;
    if (plano.criativoId) manual.anuncio_id = plano.criativoId;
    if (plano.paginaId) manual.lp_id = plano.paginaId;
    const tagsDeOrigem = [
      l.campanha ? `Campanha: ${l.campanha}` : "",
      l.conjunto ? `Conjunto: ${l.conjunto}` : "",
      l.anuncio ? `Ad: ${l.anuncio}` : "",
      l.landing_page ? `LP: ${l.landing_page}` : "",
    ].filter(Boolean);
    return {
      manual,
      campanhaId: plano.campanhaId,
      criativoId: plano.criativoId,
      paginaId: plano.paginaId,
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
            await supabase
              .from("contacts")
              .update(patch)
              .eq("id", contactId)
              .eq("organization_id", orgId);
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
              ...(l.entrada_iso ? { created_at: l.entrada_iso } : {}),
              custom_fields: {
                ...(Object.keys(camposDaLinha).length > 0
                  ? { ...camposDaLinha, _rotulos: rotulos }
                  : {}),
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
      if (
        !etapaId &&
        corpo.data.stage_id &&
        etapas.some((e) => e.id === corpo.data.stage_id && e.pipeline_id === funilId)
      ) {
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

      // A data e o horário em que o lead CHEGOU valem para o card novo (um negócio que já existia
      // mantém a data dele).
      if (leadId && l.entrada_iso) {
        const { data: card } = await supabase
          .from("crm_leads")
          .select("created_at")
          .eq("id", leadId)
          .eq("organization_id", orgId)
          .maybeSingle();
        const criadoEm = (card as { created_at: string } | null)?.created_at;
        if (criadoEm && new Date(criadoEm).getTime() >= inicioDaImportacao) {
          await supabase
            .from("crm_leads")
            .update({ created_at: l.entrada_iso })
            .eq("id", leadId)
            .eq("organization_id", orgId);
        }
      }

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
        const metaDoCard = ((
          cardAtual as { source_metadata: Record<string, unknown> | null } | null
        )?.source_metadata ?? {}) as Record<string, unknown>;
        patchDoCard.source_metadata = {
          ...metaDoCard,
          origem_manual: {
            ...((metaDoCard.origem_manual as Record<string, unknown> | undefined) ?? {}),
            ...orig.manual,
          },
        };
        await supabase
          .from("crm_leads")
          .update(patchDoCard)
          .eq("id", leadId)
          .eq("organization_id", orgId);
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
      lps_criadas: resumo.lps_criadas,
      campanhas_criadas: resumo.campanhas_criadas,
      recusadas: resumo.erros.length,
    },
  });
  return ok(resumo, { requestId });
}
