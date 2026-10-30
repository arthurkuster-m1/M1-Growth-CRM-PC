/**
 * GET/PUT /api/v1/contacts/[id]/organizacao-vinculada — liga o contato (o cliente no CRM da agência) à
 * ORGANIZAÇÃO dele. Ligado, as tarefas da agência desse contato ficam espelhadas na empresa do cliente
 * (e as marcadas "da agência" lá aparecem aqui). SÓ o super-admin pleno vê e muda; o gatilho do banco
 * (`fn_contacts_vinculo_so_do_super_admin`) recusa qualquer outro.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { clientesDaAgencia, ehSuperAdminPleno } from "@/lib/agencia/acesso";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid();
const corpoSchema = z.object({ organization_id: uuid.nullable() });

async function porta(id: string) {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "contacts" });
  if (!authz.ok) return { erro: authz.response };
  if (!uuid.safeParse(id).success) return { erro: fail("not_found", "Contato não encontrado.", 404, { requestId }) };
  if (!ehSuperAdminPleno(authz.user)) {
    return { erro: ok({ permitido: false }, { requestId }) };
  }
  return { requestId, authz };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const p = await porta(id);
  if ("erro" in p) return p.erro as Response;
  const db = createAdminClient();
  const { data: contato } = await db
    .from("contacts")
    .select("linked_organization_id")
    .eq("id", id)
    .eq("organization_id", p.authz.org.orgId)
    .maybeSingle();
  if (!contato) return fail("not_found", "Contato não encontrado.", 404, { requestId: p.requestId });
  const clientes = await clientesDaAgencia(p.authz.user);
  return ok(
    {
      permitido: true,
      vinculada: (contato as { linked_organization_id: string | null }).linked_organization_id,
      opcoes: clientes.filter((c) => c.id !== p.authz.org.orgId).map((c) => ({ id: c.id, nome: c.name })),
    },
    { requestId: p.requestId },
  );
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const { id } = await ctx.params;
  const p = await porta(id);
  if ("erro" in p) return p.erro as Response;
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", "Dados inválidos.", 422, { requestId: p.requestId });
  const alvo = corpo.data.organization_id;
  if (alvo) {
    const clientes = await clientesDaAgencia(p.authz.user);
    if (alvo === p.authz.org.orgId || !clientes.some((c) => c.id === alvo)) {
      return fail("forbidden", "Organização não permitida.", 403, { requestId: p.requestId });
    }
  }
  const { error } = await createAdminClient()
    .from("contacts")
    .update({ linked_organization_id: alvo })
    .eq("id", id)
    .eq("organization_id", p.authz.org.orgId);
  if (error) {
    const duplicado = error.code === "23505";
    return fail(
      duplicado ? "state_conflict" : "internal_error",
      duplicado ? "Esta organização já está ligada a outro contato." : "Erro ao salvar o vínculo.",
      duplicado ? 409 : 500,
      { requestId: p.requestId },
    );
  }
  return ok({ vinculada: alvo }, { requestId: p.requestId });
}
