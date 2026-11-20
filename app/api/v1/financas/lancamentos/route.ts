/**
 * /api/v1/financas/lancamentos
 *   GET  ?modo=periodo&de=AAAA-MM-DD&ate=AAAA-MM-DD   lançamentos com data em [de, ate)
 *        ?modo=recentes&n=20                          os últimos criados
 *        ?modo=fatura&conta=<id>&mes=AAAA-MM          compras de uma fatura de cartão
 *        ?modo=por_fatura&mes=AAAA-MM                 tudo que cai na fatura daquele mês (qualquer cartão)
 *        ?modo=cartoes&ids=<id,id>&desde=AAAA-MM      movimento dos cartões (compras pela fatura + pagamentos)
 *        ?modo=historico&de=AAAA-MM&ate=AAAA-MM       o que conta nos meses [de, ate): contas pela data, cartões pela fatura
 *        ?modo=importacao&de=AAAA-MM-DD&ate=AAAA-MM-DD  só o que a importação precisa para achar duplicata
 *   POST { lancamentos: [...] }   cria 1..120 de uma vez (todos ou nenhum): compra parcelada usa várias
 *
 * Piso `manager`; org e usuário da SESSÃO. `origem` nasce `manual` e não vem do corpo (o que entra das
 * vendas e da Meta é do servidor, com `ref_externa`).
 */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { criarLancamentosSchema, dataIso, mesIso } from "@/lib/financas/validacao";
import {
  COLUNAS_DO_LANCAMENTO,
  autorizarFinancas,
  lerCorpo,
  lerTodas,
  respostaDeErroDoBanco,
} from "@/lib/financas/servidor";

export const dynamic = "force-dynamic";

const diaUm = (mes: string) => `${mes}-01`;
const consultaSchema = z.discriminatedUnion("modo", [
  z.object({ modo: z.literal("periodo"), de: dataIso, ate: dataIso }),
  z.object({ modo: z.literal("recentes"), n: z.coerce.number().int().min(1).max(100).default(20) }),
  z.object({ modo: z.literal("fatura"), conta: z.string().uuid(), mes: mesIso }),
  z.object({ modo: z.literal("por_fatura"), mes: mesIso }),
  z.object({ modo: z.literal("cartoes"), ids: z.string().min(1).max(2000), desde: mesIso }),
  z.object({ modo: z.literal("historico"), de: mesIso, ate: mesIso }),
  z.object({ modo: z.literal("importacao"), de: dataIso, ate: dataIso }),
]);

export async function GET(req: NextRequest): Promise<Response> {
  const a = await autorizarFinancas(false);
  if (!a.ok) return a.response;
  const { ctx } = a;
  const { supabase, orgId, requestId } = ctx;

  const lido = consultaSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!lido.success) {
    return fail("validation_failed", lido.error.issues[0]?.message ?? "Consulta inválida.", 422, {
      requestId,
    });
  }
  const q = lido.data;
  const base = () =>
    supabase.from("fin_transactions").select(COLUNAS_DO_LANCAMENTO).eq("organization_id", orgId);

  let resultado: { data: unknown[]; error: { code?: string; message?: string } | null };
  switch (q.modo) {
    case "periodo":
      resultado = await lerTodas((de, ate) =>
        base()
          .gte("data", q.de)
          .lt("data", q.ate)
          .order("data", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id")
          .range(de, ate),
      );
      break;
    case "recentes": {
      const r = await base().order("created_at", { ascending: false }).limit(q.n);
      resultado = { data: r.data ?? [], error: r.error };
      break;
    }
    case "fatura":
      resultado = await lerTodas((de, ate) =>
        base()
          .eq("account_id", q.conta)
          .eq("fatura_mes", diaUm(q.mes))
          .order("data", { ascending: false })
          .order("id")
          .range(de, ate),
      );
      break;
    case "por_fatura":
      resultado = await lerTodas((de, ate) =>
        base()
          .eq("fatura_mes", diaUm(q.mes))
          .order("data", { ascending: false })
          .order("id")
          .range(de, ate),
      );
      break;
    case "cartoes": {
      const ids = q.ids.split(",").filter((i) => z.string().uuid().safeParse(i).success);
      if (ids.length === 0) {
        resultado = { data: [], error: null };
        break;
      }
      const [x, y] = await Promise.all([
        lerTodas((de, ate) =>
          base()
            .in("account_id", ids)
            .gte("fatura_mes", diaUm(q.desde))
            .order("data", { ascending: false })
            .order("id")
            .range(de, ate),
        ),
        lerTodas((de, ate) =>
          base()
            .in("account_destino_id", ids)
            .gte("data", diaUm(q.desde))
            .order("data", { ascending: false })
            .order("id")
            .range(de, ate),
        ),
      ]);
      resultado = { data: [...x.data, ...y.data], error: x.error ?? y.error };
      break;
    }
    case "historico": {
      const [porData, porFatura] = await Promise.all([
        lerTodas((de, ate) =>
          base()
            .gte("data", diaUm(q.de))
            .lt("data", diaUm(q.ate))
            .order("data", { ascending: false })
            .order("id")
            .range(de, ate),
        ),
        lerTodas((de, ate) =>
          base()
            .gte("fatura_mes", diaUm(q.de))
            .lt("fatura_mes", diaUm(q.ate))
            .order("data", { ascending: false })
            .order("id")
            .range(de, ate),
        ),
      ]);
      resultado = {
        data: [...porData.data, ...porFatura.data],
        error: porData.error ?? porFatura.error,
      };
      break;
    }
    case "importacao":
      resultado = await lerTodas((de, ate) =>
        supabase
          .from("fin_transactions")
          .select("data,valor_cents,account_id,tipo,import_hash")
          .eq("organization_id", orgId)
          .gte("data", q.de)
          .lt("data", q.ate)
          .order("data")
          .order("id")
          .range(de, ate),
      );
      break;
  }
  if (resultado.error) return respostaDeErroDoBanco(resultado.error, requestId, "lancamentos.ler");
  return ok(resultado.data, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const a = await autorizarFinancas(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, userId, requestId } = a.ctx;

  const corpo = await lerCorpo(req, criarLancamentosSchema, requestId);
  if (!corpo.ok) return corpo.response;

  const linhas = corpo.dados.lancamentos.map((l) => ({
    ...l,
    organization_id: orgId,
    origem: "manual" as const,
    created_by: userId,
  }));
  const { data, error } = await supabase
    .from("fin_transactions")
    .insert(linhas)
    .select(COLUNAS_DO_LANCAMENTO);
  if (error) return respostaDeErroDoBanco(error, requestId, "lancamentos.criar");

  await audit({
    action: "financas.lancamento_criado",
    resourceType: "fin_transaction",
    resourceId: (data?.[0] as { id?: string } | undefined)?.id,
    requestId,
    metadata: {
      quantidade: linhas.length,
      tipo: linhas[0]?.tipo,
      total_cents: linhas.reduce((s, l) => s + l.valor_cents, 0),
    },
  });
  return ok(data ?? [], { requestId, status: 201 });
}
