/**
 * GET /api/v1/admin/tenants/resumo?de=AAAA-MM-DD&ate=AAAA-MM-DD[&ids=uuid,uuid]
 *
 * A linha de cada empresa para a tabela e os cartões do Modo agência: cadastro + números do
 * período (usuários ativos, campanhas ativas, investimento líquido, leads, vendas, faturamento
 * recebido) + mensalidade vinda do lead da empresa no CRM da agência. Só platform admin (leitura).
 * O service role atravessa as empresas de propósito; o recorte (`ids`) é uma lista de uuids
 * validada, nunca texto livre.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const querySchema = z.object({
  de: dia,
  ate: dia,
  ids: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
        : [],
    )
    .pipe(z.array(z.string().uuid()).max(500)),
});

interface LinhaDoResumo {
  organization_id: string;
  usuarios_ativos: number;
  campanhas_ativas: number;
  investimento_cents: number | string;
  leads: number;
  vendas: number;
  faturamento_cents: number | string;
  entrada: string | null;
  mensalidade: "pago" | "pendente" | null;
  proximo_pagamento: string | null;
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!parsed.success || parsed.data.de > parsed.data.ate) {
    return fail("validation_error", "Invalid query params", 400, { requestId });
  }
  const { de, ate, ids } = parsed.data;

  const admin = createAdminClient();
  const CAMPOS =
    "id, slug, display_name, legal_name, cnpj, status, onboarded_at, created_at, cor_agencia:settings->>agencia_cor, cor_marca:settings->branding->>accent_hex";
  const buscarOrgs = (comLead: boolean) => {
    let q = admin
      .from("organizations")
      .select(comLead ? `${CAMPOS}, agencia_lead_id` : CAMPOS)
      .order("display_name", { ascending: true })
      .limit(500);
    if (ids.length > 0) q = q.in("id", ids);
    return q;
  };

  const [orgsComLead, resumoRes] = await Promise.all([
    buscarOrgs(true),
    admin.rpc("fn_resumo_das_empresas", { p_ids: ids, p_de: de, p_ate: ate }),
  ]);
  // ⚠️ Janela do deploy: o app novo sobe antes de a migration 0684 chegar ao banco da instalação.
  // Coluna (42703) ou função (42883 / PGRST202) ausentes NÃO derrubam a lista: ela abre com o
  // cadastro e os números zerados, e a resposta diz `migration_pendente` para a tela avisar.
  const colunaAusente = orgsComLead.error?.code === "42703";
  const orgsRes = colunaAusente ? await buscarOrgs(false) : orgsComLead;
  const funcaoAusente = resumoRes.error?.code === "42883" || resumoRes.error?.code === "PGRST202";
  const migracaoPendente = colunaAusente || funcaoAusente;
  if (orgsRes.error || (resumoRes.error && !funcaoAusente)) {
    return fail("internal_error", "Não foi possível carregar as empresas", 500, { requestId });
  }

  const orgs = (orgsRes.data ?? []) as unknown as Array<{
    id: string;
    slug: string;
    display_name: string;
    legal_name: string | null;
    cnpj: string | null;
    status: string;
    onboarded_at: string | null;
    created_at: string;
    agencia_lead_id?: string | null;
    cor_agencia: string | null;
    cor_marca: string | null;
  }>;
  const resumos = new Map(
    ((funcaoAusente ? [] : (resumoRes.data ?? [])) as LinhaDoResumo[]).map((r) => [
      r.organization_id,
      r,
    ]),
  );

  // O título do lead da agência, para mostrar a que cliente do CRM a empresa está ligada.
  const leadIds = orgs.map((o) => o.agencia_lead_id ?? null).filter((x): x is string => Boolean(x));
  const titulos = new Map<string, string>();
  if (leadIds.length > 0) {
    const { data } = await admin.from("crm_leads").select("id, title").in("id", leadIds);
    for (const l of (data ?? []) as Array<{ id: string; title: string }>)
      titulos.set(l.id, l.title);
  }

  const linhas = orgs.map((o) => {
    const r = resumos.get(o.id);
    return {
      id: o.id,
      slug: o.slug,
      nome: o.display_name,
      razao_social: o.legal_name,
      cnpj: o.cnpj,
      // 'onboarding' não existe no banco: é derivado (ativa sem onboarding concluído).
      situacao: o.status === "active" && !o.onboarded_at ? "onboarding" : o.status,
      cor: o.cor_marca ?? o.cor_agencia,
      usuarios_ativos: r?.usuarios_ativos ?? 0,
      campanhas_ativas: r?.campanhas_ativas ?? 0,
      investimento_cents: Number(r?.investimento_cents ?? 0),
      leads: r?.leads ?? 0,
      vendas: r?.vendas ?? 0,
      faturamento_cents: Number(r?.faturamento_cents ?? 0),
      entrada: r?.entrada ?? o.created_at.slice(0, 10),
      mensalidade: r?.mensalidade ?? null,
      proximo_pagamento: r?.proximo_pagamento ?? null,
      lead_id: o.agencia_lead_id ?? null,
      lead_titulo: o.agencia_lead_id ? (titulos.get(o.agencia_lead_id) ?? null) : null,
    };
  });

  return ok({ linhas, de, ate, migracao_pendente: migracaoPendente }, { requestId });
}
