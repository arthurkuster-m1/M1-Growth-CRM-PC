"use server";
import { supportWriteError } from "@/lib/impersonate/support";
import { z } from "zod";

import { clientesDaAgencia, ehSuperAdminPleno } from "@/lib/agencia/acesso";
import { deixariaSemAdmin, mudancaDeAcesso, PAPEIS_DELEGAVEIS } from "@/lib/agencia/delegacao";
import { audit } from "@/lib/audit";
import { loadAuthUser, mfaEmDivida, resolveActiveOrg } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Resultado = { ok: true } | { ok: false; error: string };

const pedidoSchema = z.object({
  userId: z.string().uuid(),
  orgId: z.string().uuid(),
  papel: z.enum(PAPEIS_DELEGAVEIS).nullable(),
});

/**
 * Define quais clientes uma pessoa da equipe gere: cria, troca ou revoga a associação dela com a
 * organização do cliente (manager ou admin). SÓ o super-admin pleno delega. A pessoa precisa ser da
 * equipe (membro ativo da empresa onde o super-admin está) e o cliente precisa ser um dos clientes
 * da agência; ninguém delega a si mesmo, e o último admin de um cliente nunca é tirado.
 */
export async function definirAcessoDoCliente(
  userId: string,
  orgId: string,
  papel: string | null,
): Promise<Resultado> {
  const parsed = pedidoSchema.safeParse({ userId, orgId, papel });
  if (!parsed.success) return { ok: false, error: "invalid_request" };
  const user = await loadAuthUser();
  if (!user) return { ok: false, error: "auth_required" };
  if (!ehSuperAdminPleno(user)) return { ok: false, error: "forbidden" };
  const erroDeSuporte = supportWriteError(user.support);
  if (erroDeSuporte) return { ok: false, error: erroDeSuporte };
  if (await mfaEmDivida()) return { ok: false, error: "mfa_required" };
  if (parsed.data.userId === user.id) return { ok: false, error: "forbidden" };

  const agencia = await resolveActiveOrg(user);
  if (!agencia) return { ok: false, error: "no_active_org" };
  const clientes = await clientesDaAgencia(user);
  if (!clientes.some((c) => c.id === parsed.data.orgId)) return { ok: false, error: "forbidden" };

  const db = createAdminClient();
  // A pessoa tem de ser da equipe da agência (membro ativo da empresa ativa).
  const { data: equipe } = await db
    .from("user_organizations")
    .select("id")
    .eq("organization_id", agencia.orgId)
    .eq("user_id", parsed.data.userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!equipe) return { ok: false, error: "not_team_member" };

  const { data: atualRow } = await db
    .from("user_organizations")
    .select("id, role, revoked_at")
    .eq("organization_id", parsed.data.orgId)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();
  const atual = atualRow && !atualRow.revoked_at ? (atualRow.role as string) : null;
  const mudanca = mudancaDeAcesso(atual, parsed.data.papel);
  if (mudanca.tipo === "nada") return { ok: true };

  if (atual === "admin") {
    const { count } = await db
      .from("user_organizations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", parsed.data.orgId)
      .eq("role", "admin")
      .is("revoked_at", null);
    if (deixariaSemAdmin(atual, parsed.data.papel, count ?? 0)) {
      return { ok: false, error: "last_admin" };
    }
  }

  const agora = new Date().toISOString();
  if (mudanca.tipo === "revogar") {
    const { error } = await db
      .from("user_organizations")
      .update({ revoked_at: agora, updated_at: agora })
      .eq("id", atualRow!.id);
    if (error) return { ok: false, error: error.message };
  } else if (atualRow) {
    const { error } = await db
      .from("user_organizations")
      .update({
        role: mudanca.papel,
        revoked_at: null,
        accepted_at: agora,
        updated_at: agora,
      })
      .eq("id", atualRow.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await db.from("user_organizations").insert({
      user_id: parsed.data.userId,
      organization_id: parsed.data.orgId,
      role: mudanca.papel,
      invited_by: user.id,
      invited_at: agora,
      accepted_at: agora,
    });
    if (error) return { ok: false, error: error.message };
  }

  await audit({
    action: mudanca.tipo === "revogar" ? "member.revoked" : "member.role_changed",
    actorUserId: user.id,
    organizationId: parsed.data.orgId,
    resourceType: "membership",
    resourceId: atualRow?.id ?? parsed.data.userId,
    metadata: {
      origem: "modo_agencia",
      target_user_id: parsed.data.userId,
      de: atual,
      para: parsed.data.papel,
    },
  });
  return { ok: true };
}
