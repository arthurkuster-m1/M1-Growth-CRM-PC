import { NextResponse, type NextRequest } from "next/server";
import { rodarVoltaDoGoogle } from "@/lib/agenda/google/rodar-volta";
import { createAdminClient } from "@/lib/supabase/admin";
import { autorizaCron } from "@/lib/auth/cron-auth";
export const dynamic = "force-dynamic";
async function executar(req: NextRequest) {
  if (!autorizaCron(req))
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "cron secret inválido" } },
      { status: 401 },
    );
  const r = await rodarVoltaDoGoogle(createAdminClient());
  if (!r.ok)
    return NextResponse.json(
      { error: { code: "internal_error", message: "Não foi possível ler as conexões Google." } },
      { status: 500 },
    );
  return NextResponse.json({ data: { conexoes: r.conexoes, organizacoes: r.organizacoes } });
}
export const GET = executar;
export const POST = executar;
