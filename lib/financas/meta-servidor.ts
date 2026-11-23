import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

import { logger } from "@/lib/logger";
import {
  avisoDeContaComPagamentoPendente,
  avisoDeCobrancaRecusada,
} from "@/lib/notifications/aviso-pessoal";
import { entregarNotificacao } from "@/lib/notifications/entregar-notificacao";
import { equipeQueDistribui } from "@/lib/notifications/montar-avisos";
import {
  contaLiberada,
  lerCredencialDeLeitura,
} from "@/lib/plataformas-de-anuncio/credenciais-de-leitura";
import { lerCobrancasDaConta } from "@/lib/plataformas-de-anuncio/meta/cobrancas";
import type { CobrancaLida } from "@/lib/plataformas-de-anuncio/meta/cobrancas-interpretar";

import { STATUS_PAGAMENTO_PENDENTE } from "./meta-alerta";

/**
 * A LEITURA DAS COBRANÇAS DA META PARA AS FINANÇAS.
 *
 * Chamada pelo relógio (`/api/v1/cron/financas-meta`) e pelo botão "Atualizar agora". Escreve com o
 * cliente ADMIN (o relógio não tem sessão): por isso a organização vem do chamador confiável e entra
 * em TODA consulta. O gatilho do banco transforma a cobrança em lançamento no cartão; aqui só se
 * guarda a cobrança, o estado da conta e se avisa quem administra quando a cobrança é recusada.
 */

export type MotivoDaFalhaMeta =
  | "sem_cartao"
  | "sem_conexao"
  | "cifra_indisponivel"
  | "sem_conta"
  | "conta_nao_liberada"
  | "token_invalido"
  | "permissao_insuficiente"
  | "app_bloqueado"
  | "limite_de_chamadas"
  | "campo_invalido"
  | "transitorio"
  | "erro_ao_gravar";

export type ResultadoDaLeituraMeta =
  | {
      ok: true;
      lidas: number;
      novas: number;
      alteradas: number;
      avisos: number;
      cortada: boolean;
      statusDaConta: number | null;
    }
  | { ok: false; motivo: MotivoDaFalhaMeta };

const DIA = 86_400_000;
const dia = (d: Date) => d.toISOString().slice(0, 10);

/** Um uuid estável a partir de um texto — a chave de "este aviso já foi entregue" (`origem_evento`). */
export function uuidDoTexto(texto: string): string {
  const h = createHash("sha256").update(texto).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const reais = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const diaMes = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

async function gravarEstado(
  admin: SupabaseClient,
  orgId: string,
  campos: { ultimo_erro: string | null; conta_status?: number | null; leituraOk: boolean },
): Promise<void> {
  const agora = new Date().toISOString();
  const linha: Record<string, unknown> = {
    organization_id: orgId,
    ultimo_erro: campos.ultimo_erro,
    updated_at: agora,
  };
  if (campos.leituraOk) linha.ultima_leitura_em = agora;
  if (campos.conta_status !== undefined) {
    linha.conta_status = campos.conta_status;
    linha.conta_status_em = agora;
  }
  const { error } = await admin
    .from("fin_meta_estado")
    .upsert(linha, { onConflict: "organization_id" });
  if (error) logger.warn("[financas.meta] estado não gravado", { orgId, detail: error.message });
}

export async function lerCobrancasDaMeta(
  admin: SupabaseClient,
  orgId: string,
  opcoes: { dias?: number } = {},
): Promise<ResultadoDaLeituraMeta> {
  const falhar = async (motivo: MotivoDaFalhaMeta): Promise<ResultadoDaLeituraMeta> => {
    await gravarEstado(admin, orgId, { ultimo_erro: motivo, leituraOk: false });
    return { ok: false, motivo };
  };

  const { data: cfg } = await admin
    .from("fin_orcamento_config")
    .select("conta_meta_id")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!cfg?.conta_meta_id) return { ok: false, motivo: "sem_cartao" };

  const cred = await lerCredencialDeLeitura(admin, orgId, "meta_ads");
  if (!cred.ok) return falhar(cred.motivo);
  const conta = cred.credencial.contaPadrao;
  if (!conta) return falhar("sem_conta");
  if (!contaLiberada(cred.credencial, conta)) return falhar("conta_nao_liberada");

  const ate = new Date();
  const de = new Date(ate.getTime() - Math.min(Math.max(opcoes.dias ?? 40, 1), 180) * DIA);
  const leitura = await lerCobrancasDaConta(cred.credencial.accessToken, conta, dia(de), dia(ate));
  if (!leitura.ok) return falhar(leitura.falha);

  // O que já temos: só grava o que é novo ou mudou (cada gravação roda o gatilho do lançamento).
  const { data: existentes, error: erroLeitura } = await admin
    .from("fin_cobrancas_meta")
    .select("meta_id,estado,valor_cents,cobrada_em")
    .eq("organization_id", orgId)
    .gte("cobrada_em", de.toISOString());
  if (erroLeitura) return falhar("erro_ao_gravar");
  const porId = new Map(
    (existentes ?? []).map((e) => [
      e.meta_id as string,
      e as { estado: string; valor_cents: number | null; cobrada_em: string },
    ]),
  );

  const novas: CobrancaLida[] = [];
  const alteradas: CobrancaLida[] = [];
  for (const c of leitura.cobrancas) {
    const antes = porId.get(c.metaId);
    if (!antes) novas.push(c);
    else if (
      antes.estado !== c.estado ||
      antes.valor_cents !== c.valorCents ||
      new Date(antes.cobrada_em).getTime() !== new Date(c.cobradaEm).getTime()
    )
      alteradas.push(c);
  }
  const paraGravar = [...novas, ...alteradas].map((c) => ({
    organization_id: orgId,
    meta_id: c.metaId,
    conta_anuncio: conta,
    cobrada_em: c.cobradaEm,
    valor_cents: c.valorCents,
    moeda: c.moeda,
    estado: c.estado,
    tipo_evento: c.tipoEvento,
    bruto: c.bruto,
    updated_at: new Date().toISOString(),
  }));
  if (paraGravar.length > 0) {
    const { error } = await admin
      .from("fin_cobrancas_meta")
      .upsert(paraGravar, { onConflict: "organization_id,meta_id" });
    if (error) {
      logger.error("[financas.meta] cobranças não gravadas", { orgId, detail: error.message });
      return falhar("erro_ao_gravar");
    }
  }

  await gravarEstado(admin, orgId, {
    ultimo_erro: null,
    conta_status: leitura.statusDaConta,
    leituraOk: true,
  });

  // Avisos: cobrança recusada nova (ou que acabou de virar recusada) e conta com pagamento pendente.
  let avisos = 0;
  const equipe = await equipeQueDistribui(admin, orgId);
  const limite = Date.now() - 7 * DIA;
  for (const c of [...novas, ...alteradas]) {
    if (c.estado !== "recusada" || new Date(c.cobradaEm).getTime() < limite) continue;
    const r = await entregarNotificacao(
      admin,
      orgId,
      {
        destinatarios: equipe,
        aviso: avisoDeCobrancaRecusada({
          chave: uuidDoTexto(`${orgId}:${c.metaId}`).slice(0, 8),
          dia: diaMes(c.cobradaEm),
          valor: c.valorCents ? reais(c.valorCents) : null,
        }),
      },
      uuidDoTexto(`fin-meta-recusada:${orgId}:${c.metaId}`),
    );
    avisos += r.gravadas;
  }
  if (leitura.statusDaConta === STATUS_PAGAMENTO_PENDENTE) {
    // no máximo um por dia enquanto durar o problema
    const r = await entregarNotificacao(
      admin,
      orgId,
      { destinatarios: equipe, aviso: avisoDeContaComPagamentoPendente() },
      uuidDoTexto(`fin-meta-pendente:${orgId}:${dia(ate)}`),
    );
    avisos += r.gravadas;
  }

  return {
    ok: true,
    lidas: leitura.cobrancas.length,
    novas: novas.length,
    alteradas: alteradas.length,
    avisos,
    cortada: leitura.cortada,
    statusDaConta: leitura.statusDaConta,
  };
}
