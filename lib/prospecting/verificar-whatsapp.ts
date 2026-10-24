import type pg from "pg";

import { getWahaClient } from "@/lib/waha/client";
import { verificarNumeroNoWhatsapp, type ResultadoDoWhatsapp } from "@/lib/waha/verificar-numero";

import { ProspectingError } from "./provider";

/**
 * VERIFICAR O WHATSAPP das empresas da campanha ANTES de abordar: pergunta ao WhatsApp, pela
 * conexão escolhida, se cada número existe, e grava o resultado na empresa. Número sem WhatsApp
 * é pulado na fila (`triarCandidato`) — reduz mensagem perdida e o risco de banimento.
 *
 * Em lotes pequenos (a tela repete até acabar) e com pausa entre as consultas: consultar centenas
 * de números de uma vez, em rajada, é o padrão que o WhatsApp estranha.
 */
export const LOTE_DA_VERIFICACAO = 40;

export interface ResumoDaVerificacao {
  verificadas: number;
  tem: number;
  nao_tem: number;
  incerto: number;
  /** Empresas selecionadas que ainda não foram verificadas. */
  restantes: number;
}

const STATUS_DO_RESULTADO: Record<ResultadoDoWhatsapp, "exists" | "missing" | "unknown"> = {
  tem: "exists",
  nao_tem: "missing",
  incerto: "unknown",
};

export async function verificarWhatsappDaCampanha(
  pool: pg.Pool,
  org: string,
  campaignId: string,
  sessionId: string,
  opcoes: {
    /** Põe as "incertas" de volta na fila de verificação antes de começar. */
    refazerIncertas?: boolean;
    /** Para o teste: o cliente do WhatsApp e a pausa entre consultas. */
    cliente?: Parameters<typeof verificarNumeroNoWhatsapp>[0] | null;
    esperar?: (ms: number) => Promise<void>;
  } = {},
): Promise<ResumoDaVerificacao> {
  const campanha = await pool.query(
    "select id from prospecting_campaigns where organization_id=$1 and id=$2",
    [org, campaignId],
  );
  if (!campanha.rows.length) throw new ProspectingError("Campanha não encontrada.", 404);

  const sessao = (
    await pool.query<{ provider: string; waha_session_name: string | null }>(
      "select provider, waha_session_name from channel_sessions where organization_id=$1 and id=$2 and archived_at is null",
      [org, sessionId],
    )
  ).rows[0];
  if (!sessao) throw new ProspectingError("Conexão não encontrada nesta organização.", 404);
  if (sessao.provider !== "waha" || !sessao.waha_session_name)
    throw new ProspectingError(
      "A verificação de WhatsApp usa uma conexão WAHA. Escolha uma conexão de WhatsApp comum.",
      422,
    );
  const cliente = opcoes.cliente === undefined ? getWahaClient() : opcoes.cliente;
  if (!cliente) throw new ProspectingError("O serviço de WhatsApp não está configurado.", 503);

  if (opcoes.refazerIncertas) {
    await pool.query(
      "update prospecting_candidates set whatsapp_status=null,whatsapp_checked_at=null where organization_id=$1 and campaign_id=$2 and whatsapp_status='unknown'",
      [org, campaignId],
    );
  }

  const pendentes = (
    await pool.query<{ id: string; phone: string }>(
      `select id, phone from prospecting_candidates
        where organization_id=$1 and campaign_id=$2 and phone is not null
          and status in ('new','queued') and selected is not false and whatsapp_status is null
        order by created_at, id limit $3`,
      [org, campaignId, LOTE_DA_VERIFICACAO],
    )
  ).rows;

  const esperar = opcoes.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const resumo: ResumoDaVerificacao = {
    verificadas: 0,
    tem: 0,
    nao_tem: 0,
    incerto: 0,
    restantes: 0,
  };
  for (const [i, c] of pendentes.entries()) {
    const resultado = await verificarNumeroNoWhatsapp(cliente, sessao.waha_session_name, c.phone);
    await pool.query(
      "update prospecting_candidates set whatsapp_status=$3,whatsapp_checked_at=now(),updated_at=now() where organization_id=$1 and id=$2",
      [org, c.id, STATUS_DO_RESULTADO[resultado]],
    );
    resumo.verificadas += 1;
    resumo[resultado] += 1;
    // Pausa com variação entre as consultas (não depois da última).
    if (i < pendentes.length - 1) await esperar(250 + Math.floor(Math.random() * 400));
  }

  const restantes = await pool.query<{ n: string }>(
    `select count(*)::text as n from prospecting_candidates
      where organization_id=$1 and campaign_id=$2 and phone is not null
        and status in ('new','queued') and selected is not false and whatsapp_status is null`,
    [org, campaignId],
  );
  resumo.restantes = Number(restantes.rows[0]?.n ?? 0);
  return resumo;
}
