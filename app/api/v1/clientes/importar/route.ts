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
    source_metadata: Record<string, unknown>;
  } | null> {
    const colunas = "id, tags, custom_fields, birthdate, source_metadata";
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

  for (const l of lido.linhas) {
    try {
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
      const tags = normalizarTags(l.etiquetas);

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
          if (Object.keys(camposDaLinha).length > 0) {
            patch.custom_fields = {
              ...customAtual,
              ...camposDaLinha,
              _rotulos: { ...rotulosAtuais, ...rotulos },
            };
          }
          if (l.nascimento && !existente.birthdate) patch.birthdate = l.nascimento;
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
              custom_fields:
                Object.keys(camposDaLinha).length > 0
                  ? { ...camposDaLinha, _rotulos: rotulos }
                  : {},
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

      // A venda do card (o banco já criou a de interesse): produto, valor e status da linha.
      if (leadId && (l.produto || l.valor_cents !== null || l.status_da_venda)) {
        const { data: venda } = await supabase
          .from("crm_sales")
          .select("id")
          .eq("organization_id", orgId)
          .eq("lead_id", leadId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (venda) {
          const vendaId = (venda as { id: string }).id;
          const produto = l.produto ? produtoPorNome.get(semAcento(l.produto)) : undefined;
          const patch: Record<string, unknown> = {};
          if (l.produto) patch.product_name = (produto?.title ?? l.produto).slice(0, 200);
          if (l.valor_cents !== null) patch.amount_cents = l.valor_cents;
          if (l.status_da_venda) patch.status = l.status_da_venda;
          if (l.status_da_venda === "comprometida" || l.status_da_venda === "concluida") {
            patch.needs_details = true;
          }
          if (Object.keys(patch).length > 0) {
            await supabase.from("crm_sales").update(patch).eq("id", vendaId).eq("organization_id", orgId);
          }
          if (produto && l.valor_cents !== null) {
            await supabase.from("crm_sale_items").insert({
              organization_id: orgId,
              sale_id: vendaId,
              product_id: produto.id,
              product_name: produto.title.slice(0, 200),
              quantity: 1,
              amount_cents: l.valor_cents,
              position: 0,
            });
          }
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
