import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * GET   /api/v1/conversations/[id] — single conversation (handler em ../_handler.ts)
 * PATCH /api/v1/conversations/[id] — update status e/ou tags (handler em ../_handler.ts)
 * DELETE /api/v1/conversations/[id] — exclui a conversa e as mensagens dela. Com `apagar_lead`,
 *   exclui o LEAD inteiro (a conversa vai junto, e o resto vai para a Lixeira do CRM por 7 dias).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ApiError } from "@/lib/api/types";
import { ok, fail } from "@/lib/api/wrappers";
import { orgAtivaDaApi, requireRole } from "@/lib/auth/require-role";
import { loadAuthUser } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { patchConversationSchema, validateRequest } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { comNomeDoAtendente } from "@/lib/users/com-nome-do-atendente";

import { deleteContactHandler } from "@/app/api/v1/contacts/_handler";
import { audit } from "@/lib/audit";

import { getConversationHandler, patchConversationHandler } from "../_handler";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/**
 * O `[id]` da rota é INPUT EXTERNO — tanto quanto um body — e por isso passa por
 * Zod antes de virar consulta (doutrina: "Zod valida todo input externo").
 *
 * Sem isto, `/api/v1/conversations/undefined` chegava ao `.eq("id", …)` de uma
 * coluna `uuid`, o Postgres devolvia `22P02` (*invalid input syntax*), e o
 * handler traduzia QUALQUER erro de banco para **500**. Dois estragos:
 *
 *  - um 500 evitável no log do servidor, de um id que nunca teve chance;
 *  - a tela ficava MUDA. `InboxLayout` só acende "Conversa não encontrada ou
 *    fora do seu acesso" quando o erro é 404 (`isNotFound` é `status === 404`),
 *    então o usuário via uma conversa vazia — indistinguível de uma conversa
 *    sem mensagens. Issue #1367.
 *
 * **DEPOIS da autorização, nunca antes.** `rbac-matrix.test.ts` pegou a versão
 * anterior deste conserto: com a guarda no topo, um `viewer` mandando `PATCH`
 * com id malformado recebia 404 em vez de 403. Quem não pode escrever não pode
 * nem chegar à pergunta sobre o id — e o mesmo `agenda/agendamentos/[id]` que
 * serve de precedente aqui valida o uuid DEPOIS do `requireRole`.
 *
 * **404 e não 422**, e o precedente é da casa: `agenda/agendamentos/[id]`
 * responde `fail("not_found", …, 404)` para id malformado. Num GET por id, "não
 * é um uuid" e "não existe" são a mesma resposta para quem pergunta — e devolver
 * 422 aqui só trocaria o 500 por outro código que a tela também não trata.
 */
function idInvalido(id: string): boolean {
  return !z.uuid().safeParse(id).success;
}

export async function GET(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return fail("unauthenticated", "Auth required.", 401, { requestId });
  }

  const authUser = await loadAuthUser();
  const t = (texto: string) => traduzir(texto, authUser?.idioma ?? "pt-BR");
  const ativa = await orgAtivaDaApi(authUser, requestId);
  if (!ativa.ok) return ativa.response;
  const activeOrg = ativa.org;
  if (!activeOrg) {
    return fail("no_active_org", t("No active organization."), 403, { requestId });
  }
  if (idInvalido(id)) {
    return fail("not_found", "Conversa não encontrada.", 404, { requestId });
  }

  try {
    const conv = await getConversationHandler(
      supabase,
      {
        organization_id: activeOrg.orgId,
        actor: { type: "user", id: user.id },
        requestId,
        idioma: authUser?.idioma,
      },
      id,
    );
    // Mesma razão da listagem: o nome entra na borda HTTP, não no handler que o
    // MCP compartilha. Aqui é UM lookup, não N.
    const [comNome] = await comNomeDoAtendente([conv]);
    return ok(comNome ?? conv, { requestId });
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, { requestId });
    }
    throw err;
  }
}

export async function PATCH(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id } = await ctx.params;
  const supabase = await createClient();

  // spec 13 §4: escrita é agent+ (viewer é read-only).
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const user = authz.user;
  const activeOrg = authz.org;
  if (idInvalido(id)) {
    return fail("not_found", "Conversa não encontrada.", 404, { requestId });
  }

  let input;
  try {
    input = await validateRequest(patchConversationSchema, req);
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, {
        details: err.details as Record<string, unknown> | undefined,
        requestId,
      });
    }
    throw err;
  }

  try {
    const conv = await patchConversationHandler(
      supabase,
      {
        organization_id: activeOrg.orgId,
        actor: { type: "user", id: user.id },
        requestId,
        idioma: user.idioma,
      },
      id,
      input,
    );
    return ok(conv, { requestId });
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, { requestId });
    }
    throw err;
  }
}

const excluirSchema = z.object({
  /** Verdadeiro: apaga também o lead (contato, oportunidades, vendas…). Falso: só a conversa. */
  apagar_lead: z.boolean().default(false),
});

export async function DELETE(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { id } = await ctx.params;
  if (idInvalido(id)) return fail("not_found", t("Conversa não encontrada."), 404, { requestId });

  const corpo = excluirSchema.safeParse(await req.json().catch(() => ({})));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });

  const orgId = authz.org.orgId;
  const supabase = await createClient();
  const { data: conversa, error: leitura } = await supabase
    .from("conversations")
    .select("id, contact_id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (leitura) return fail("internal_error", t("Erro ao excluir."), 500, { requestId });
  if (!conversa) return fail("not_found", t("Conversa não encontrada."), 404, { requestId });
  const contactId = (conversa as { contact_id: string | null }).contact_id;

  // O LEAD INTEIRO: o mesmo caminho da exclusão de leads do CRM (a conversa e o histórico saem
  // junto, e uma cópia fica na Lixeira por 7 dias).
  if (corpo.data.apagar_lead) {
    if (!contactId) {
      return fail("validation_failed", t("Esta conversa não tem lead para excluir."), 422, {
        requestId,
      });
    }
    try {
      await deleteContactHandler(
        supabase,
        {
          organization_id: orgId,
          actor: { type: "user", id: authz.user.id },
          requestId,
          idioma: authz.user.idioma,
        },
        contactId,
      );
    } catch (err) {
      if (err instanceof ApiError) {
        return fail("conflict", err.message, err.status, { requestId });
      }
      return fail("internal_error", t("Erro ao excluir."), 500, { requestId });
    }
    return ok({ conversa_apagada: true, lead_apagado: true }, { requestId });
  }

  // SÓ A CONVERSA: as mensagens saem junto (cascata do banco) e o lead continua cadastrado.
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", id)
    .eq("organization_id", orgId);
  const { data: apagada, error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id")
    .maybeSingle();
  if (error) return fail("internal_error", t("Erro ao excluir."), 500, { requestId });
  if (!apagada) return fail("not_found", t("Conversa não encontrada."), 404, { requestId });

  await audit({
    action: "conversation.deleted",
    actorUserId: authz.user.id,
    organizationId: orgId,
    resourceType: "conversation",
    resourceId: id,
    requestId,
    metadata: { contact_id: contactId, mensagens: count ?? 0, lead_mantido: true },
  });
  return ok({ conversa_apagada: true, lead_apagado: false }, { requestId });
}
