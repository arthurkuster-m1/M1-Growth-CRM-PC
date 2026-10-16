import { NextResponse, type NextRequest } from "next/server";
import { rodarIdaDoGoogle } from "@/lib/agenda/google/rodar-ida";
import { createAdminClient } from "@/lib/supabase/admin";
import { autorizaCron } from "@/lib/auth/cron-auth";
export const dynamic = "force-dynamic";
async function executar(req: NextRequest) {
  if (!autorizaCron(req))
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "cron secret inválido" } },
      { status: 401 },
    );
  const r = await rodarIdaDoGoogle(createAdminClient());
  if (!r.ok)
    return NextResponse.json(
      { error: { code: "internal_error", message: "Não foi possível ler a pendência Google." } },
      { status: 500 },
    );
  return NextResponse.json({ data: { candidatos: r.candidatos, organizacoes: r.organizacoes } });
}
export const GET = executar;
export const POST = executar;
