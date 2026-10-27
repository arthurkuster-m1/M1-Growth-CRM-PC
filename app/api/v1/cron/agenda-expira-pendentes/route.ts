/**
 * A EXPIRAÇÃO AUTOMÁTICA DO PEDIDO NÃO CONFIRMADO ESTÁ DESLIGADA.
 *
 * Esta varredura cancelava, depois de um prazo por organização, o compromisso `pending` que ninguém
 * confirmou — soltando o horário reservado. Por decisão do dono do produto, isso não é mais
 * automático: soltar o horário de um pedido não confirmado é ato MANUAL do atendente (cancelar o
 * compromisso pela tela). O campo "Soltar o horário…" saiu de Configurações › Agenda.
 *
 * A rota continua existindo, e agendada, para o agendador não receber 404 nem precisar de migração
 * de configuração em quem já instalou: ela só autentica e responde que não fez nada. Rodada que
 * não faz nada não audita. Religar é trocar `EXPIRACAO_AUTOMATICA_LIGADA` e devolver o corpo da
 * varredura (está no histórico do git).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { autorizaCron } from "@/lib/auth/cron-auth";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  if (!autorizaCron(req)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }

  return ok({ examinados: 0, expirados: 0, mantidos: 0, desativado: true }, { requestId });
}

export const GET = handle;
export const POST = handle;
