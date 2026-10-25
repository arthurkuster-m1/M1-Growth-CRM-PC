import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";

import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import { cerebroDaOrganizacao } from "@/lib/ai/cerebro-da-organizacao";
import { buildModel } from "@/lib/ai/runtime/agent";
import type { PassoDoFluxo } from "@/lib/cadencia/fluxo-da-abordagem";
import { beginServiceAtOrigin } from "@/lib/atendimento/origem";
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { aplicarVariaveis } from "@/lib/leads/mensagem-de-prospeccao";
import { logger } from "@/lib/logger";
import { criarTarefaInterna } from "@/lib/tarefas/criar-tarefa";

import { BUCKET_DOS_AUDIOS, caminhoNaConversa } from "./audio-da-abordagem";
import {
  SISTEMA_DA_CONTINUACAO,
  montarPedidoDaContinuacao,
  prazoDaEspera,
  proximoPasso,
  type EstadoDoFluxo,
  type MotivoDeParada,
} from "./continuacao";
import { carregarAbertura } from "./mensagens-da-ia";
import { limparMensagemDaIA } from "./mensagem-da-ia";

/** O destinatário do disparo com o que o fluxo precisa saber dele. */
export interface DestinatarioDoFluxo {
  id: string;
  organization_id: string;
  campaign_id: string;
  contact_id: string;
  conversation_id: string | null;
  channel_session_id: string | null;
  rendered_body: string | null;
  sent_at: string | null;
  flow_state: EstadoDoFluxo | null;
  flow_step: number | null;
  flow_wait_until: string | null;
  proposal_kind: "mensagem" | "audio" | null;
  proposal_body: string | null;
  proposal_ai: boolean;
}

const COLUNAS =
  "id, organization_id, campaign_id, contact_id, conversation_id, channel_session_id, rendered_body, sent_at, " +
  "flow_state, flow_step, flow_wait_until, proposal_kind, proposal_body, proposal_ai";

interface Contexto {
  dest: DestinatarioDoFluxo;
  campanha: { id: string; name: string; approach_id: string | null };
  contato: { name: string | null; display_name: string | null; is_blocked: boolean };
}

async function carregarContexto(
  admin: SupabaseClient,
  organizationId: string,
  recipientId: string,
): Promise<Contexto | null> {
  const { data } = await admin
    .from("campaign_recipients")
    .select(COLUNAS)
    .eq("organization_id", organizationId)
    .eq("id", recipientId)
    .maybeSingle();
  const dest = data as unknown as DestinatarioDoFluxo | null;
  if (!dest) return null;
  const { data: camp } = await admin
    .from("campaigns")
    .select("id, name, approach_id")
    .eq("organization_id", organizationId)
    .eq("id", dest.campaign_id)
    .maybeSingle();
  if (!camp) return null;
  const { data: contato } = await admin
    .from("contacts")
    .select("name, display_name, is_blocked")
    .eq("organization_id", organizationId)
    .eq("id", dest.contact_id)
    .maybeSingle();
  return {
    dest,
    campanha: camp as Contexto["campanha"],
    contato: (contato as Contexto["contato"] | null) ?? {
      name: null,
      display_name: null,
      is_blocked: false,
    },
  };
}

const LIMPAR_PROPOSTA = { proposal_kind: null, proposal_body: null, proposal_ai: false };

async function passosDoDisparo(
  admin: SupabaseClient,
  organizationId: string,
  campanha: Contexto["campanha"],
): Promise<{ passos: PassoDoFluxo[]; ideia: string; nome: string; roteiro: string }> {
  const a = await carregarAbertura(admin, {
    id: campanha.id,
    organization_id: organizationId,
    approach_id: campanha.approach_id,
  });
  return {
    passos: a?.passos ?? [],
    ideia: a?.abordagem.central_idea ?? "",
    nome: a?.abordagem.name ?? "",
    roteiro: a?.abordagem.script ?? "",
  };
}

/** As últimas respostas do lead nesta conversa, da mais antiga para a mais nova. */
async function respostasDoLead(admin: SupabaseClient, ctx: Contexto): Promise<string[]> {
  if (!ctx.dest.conversation_id) return [];
  let consulta = admin
    .from("messages")
    .select("body, created_at")
    .eq("organization_id", ctx.dest.organization_id)
    .eq("conversation_id", ctx.dest.conversation_id)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(3);
  if (ctx.dest.sent_at) consulta = consulta.gte("created_at", ctx.dest.sent_at);
  const { data } = await consulta;
  return ((data ?? []) as Array<{ body: string | null }>)
    .map((m) => (m.body ?? "").trim())
    .filter(Boolean)
    .reverse();
}

/** A IA escreve a continuação a partir da resposta do lead. Devolve null se não conseguiu. */
async function escreverContinuacao(
  admin: SupabaseClient,
  ctx: Contexto,
  passo: PassoDoFluxo,
): Promise<string | null> {
  try {
    const cerebro = await cerebroDaOrganizacao(admin, ctx.dest.organization_id);
    if ("erro" in cerebro) return null;
    const abordagem = await passosDoDisparo(admin, ctx.dest.organization_id, ctx.campanha);
    const r = await generateText({
      model: buildModel(cerebro.provider, cerebro.apiKey, cerebro.model),
      system: SISTEMA_DA_CONTINUACAO,
      prompt: montarPedidoDaContinuacao({
        ideiaCentral: abordagem.ideia,
        instrucao: passo.body,
        nomeDaAbordagem: abordagem.nome,
        nomeDoLead: nomeDoContato(ctx.contato) ?? "",
        abertura: ctx.dest.rendered_body ?? "",
        respostasDoLead: await respostasDoLead(admin, ctx),
      }),
      maxOutputTokens: 300,
    });
    return limparMensagemDaIA(r.text) || null;
  } catch (e) {
    logger.warn("[campanha] a IA não escreveu a continuação", {
      recipient_id: ctx.dest.id,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

/**
 * Anda o fluxo a partir do passo `deIndice`: espera, propõe a próxima mensagem/áudio, encaminha
 * ou termina. A escrita só vale se o destinatário ainda está no estado `esperado` — assim um
 * evento repetido ou um duplo clique não anda o fluxo duas vezes.
 */
async function avancar(
  admin: SupabaseClient,
  ctx: Contexto,
  deIndice: number,
  esperado: EstadoDoFluxo,
  agora: Date,
): Promise<void> {
  const org = ctx.dest.organization_id;
  const gravar = async (campos: Record<string, unknown>) => {
    const { data } = await admin
      .from("campaign_recipients")
      .update(campos)
      .eq("organization_id", org)
      .eq("id", ctx.dest.id)
      .eq("flow_state", esperado)
      .select("id");
    return (data ?? []).length > 0;
  };

  const { passos } = await passosDoDisparo(admin, org, ctx.campanha);
  const d = proximoPasso(passos, deIndice);

  if (d.tipo === "fim") {
    await gravar({ flow_state: "concluido", flow_wait_until: null, ...LIMPAR_PROPOSTA });
    return;
  }
  if (d.tipo === "aguardar") {
    const ate = prazoDaEspera(d.horas, agora);
    await gravar({
      flow_state: "aguardando_resposta",
      flow_step: d.indice,
      flow_wait_until: ate ? ate.toISOString() : null,
      flow_stop_reason: null,
      ...LIMPAR_PROPOSTA,
    });
    return;
  }
  if (d.tipo === "mensagem") {
    const nome = nomeDoContato(ctx.contato) ?? "";
    const daIA = d.passo.ai_personalize ? await escreverContinuacao(admin, ctx, d.passo) : null;
    const fixa = d.passo.body.trim() ? aplicarVariaveis(d.passo.body, { nome }).trim() : "";
    await gravar({
      flow_state: "proposta_pendente",
      flow_step: d.indice,
      flow_wait_until: null,
      flow_stop_reason: null,
      proposal_kind: "mensagem",
      // Se a IA não conseguiu, o texto do passo (se houver) é o ponto de partida; vazio, a pessoa escreve.
      proposal_body: daIA ?? fixa,
      proposal_ai: daIA !== null,
    });
    return;
  }
  if (d.tipo === "audio") {
    await gravar({
      flow_state: "proposta_pendente",
      flow_step: d.indice,
      flow_wait_until: null,
      flow_stop_reason: null,
      proposal_kind: "audio",
      proposal_body: d.passo.audio_label.trim(),
      proposal_ai: false,
    });
    return;
  }
  // Encaminhar: reivindica o estado ANTES de criar a tarefa, para ela nascer uma vez só.
  const reivindicou = await gravar({
    flow_state: "encaminhado",
    flow_step: d.indice,
    flow_wait_until: null,
    ...LIMPAR_PROPOSTA,
  });
  if (!reivindicou) return;
  const lead = await leadDoDisparo(admin, org, ctx);
  const tarefa = await criarTarefaInterna(admin, {
    organizationId: org,
    titulo: "Continuar a conversa com {{contact.name}} (veio da prospecção)",
    venceEmDias: 0,
    atribuirA: "dono_do_lead",
    prioridade: "high",
    leadId: lead,
    contactId: ctx.dest.contact_id,
    descricao:
      "O lead respondeu ao disparo e o fluxo da abordagem manda a conversa para uma pessoa.",
    origem: `campaign_flow:${ctx.campanha.id}`,
  });
  if (!tarefa.ok) {
    await admin
      .from("campaign_recipients")
      .update({ flow_stop_reason: tarefa.codigo === "sem_dono" ? "sem_dono" : null })
      .eq("organization_id", org)
      .eq("id", ctx.dest.id);
  }
}

async function leadDoDisparo(
  admin: SupabaseClient,
  organizationId: string,
  ctx: Contexto,
): Promise<string | null> {
  const { data: camp } = await admin
    .from("campaigns")
    .select("demand_campaign_id")
    .eq("organization_id", organizationId)
    .eq("id", ctx.campanha.id)
    .maybeSingle();
  const demanda = (camp as { demand_campaign_id?: string | null } | null)?.demand_campaign_id;
  if (!demanda) return null;
  const { data: lead } = await admin
    .from("crm_leads")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("demand_campaign_id", demanda)
    .eq("contact_id", ctx.dest.contact_id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (lead as { id?: string } | null)?.id ?? null;
}

/**
 * A abertura do disparo saiu: o fluxo da abordagem passa a esperar (ou a propor) o passo seguinte.
 * Abordagem sem passos além da abertura não liga o fluxo. Nunca lança — o envio já aconteceu.
 */
export async function iniciarFluxoAposAbertura(
  admin: SupabaseClient,
  input: { organizationId: string; recipientId: string; agora?: Date },
): Promise<void> {
  try {
    const ctx = await carregarContexto(admin, input.organizationId, input.recipientId);
    if (!ctx || !ctx.campanha.approach_id || ctx.dest.flow_state) return;
    const { passos } = await passosDoDisparo(admin, input.organizationId, ctx.campanha);
    if (passos.length <= 1) return;
    // O estado de partida existe só para a escrita condicional de `avancar` valer.
    const { data } = await admin
      .from("campaign_recipients")
      .update({ flow_state: "aguardando_resposta", flow_step: 0 })
      .eq("organization_id", input.organizationId)
      .eq("id", input.recipientId)
      .is("flow_state", null)
      .select("id");
    if ((data ?? []).length === 0) return;
    await avancar(admin, ctx, 1, "aguardando_resposta", input.agora ?? new Date());
  } catch (e) {
    logger.warn("[campanha] falha ao iniciar o fluxo da conversa", {
      recipient_id: input.recipientId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

async function parar(
  admin: SupabaseClient,
  organizationId: string,
  recipientId: string,
  motivo: MotivoDeParada,
  deEstados: EstadoDoFluxo[],
): Promise<boolean> {
  const { data } = await admin
    .from("campaign_recipients")
    .update({
      flow_state: "parado",
      flow_stop_reason: motivo,
      flow_wait_until: null,
      ...LIMPAR_PROPOSTA,
    })
    .eq("organization_id", organizationId)
    .eq("id", recipientId)
    .in("flow_state", deEstados)
    .select("id");
  return (data ?? []).length > 0;
}

/**
 * O lead respondeu: os destinatários dele que esperavam resposta andam para o passo seguinte.
 * Contato bloqueado (pediu para parar) encerra o fluxo. Nunca lança.
 */
export async function continuarFluxoAoResponder(
  admin: SupabaseClient,
  input: { organizationId: string; contactId: string; recebidoEm: Date },
): Promise<number> {
  try {
    const { data } = await admin
      .from("campaign_recipients")
      .select("id, flow_step, sent_at")
      .eq("organization_id", input.organizationId)
      .eq("contact_id", input.contactId)
      .eq("flow_state", "aguardando_resposta")
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(3);
    let andou = 0;
    for (const r of (data ?? []) as Array<{
      id: string;
      flow_step: number | null;
      sent_at: string;
    }>) {
      if (new Date(r.sent_at).getTime() > input.recebidoEm.getTime()) continue;
      const ctx = await carregarContexto(admin, input.organizationId, r.id);
      if (!ctx) continue;
      if (ctx.contato.is_blocked) {
        await parar(admin, input.organizationId, r.id, "opt_out", ["aguardando_resposta"]);
        continue;
      }
      await avancar(admin, ctx, (r.flow_step ?? 0) + 1, "aguardando_resposta", input.recebidoEm);
      andou += 1;
    }
    return andou;
  } catch (e) {
    logger.warn("[campanha] falha ao continuar o fluxo da conversa", {
      contact_id: input.contactId,
      error: e instanceof Error ? e.message : String(e),
    });
    return 0;
  }
}

export type ResultadoDaProposta = { ok: true } | { ok: false; mensagem: string; status: number };

const NAO_ACHEI: ResultadoDaProposta = {
  ok: false,
  mensagem: "Não há mensagem proposta para este lead.",
  status: 409,
};

async function propostaPendente(
  admin: SupabaseClient,
  organizationId: string,
  campaignId: string,
  recipientId: string,
): Promise<Contexto | null> {
  const ctx = await carregarContexto(admin, organizationId, recipientId);
  if (!ctx || ctx.dest.campaign_id !== campaignId) return null;
  return ctx.dest.flow_state === "proposta_pendente" ? ctx : null;
}

/**
 * O arquivo de voz do passo, copiado da biblioteca para a pasta da conversa — é lá que o envio de
 * mídia o aceita. Devolve null se o passo não tem arquivo ou ele sumiu da biblioteca.
 */
async function copiarAudioParaAConversa(
  admin: SupabaseClient,
  ctx: Contexto,
  conversationId: string,
  mensagemId: string,
): Promise<{ caminho: string; mime: string } | null> {
  const { passos } = await passosDoDisparo(admin, ctx.dest.organization_id, ctx.campanha);
  const audioId = passos[ctx.dest.flow_step ?? -1]?.audio_id;
  if (!audioId) return null;
  const { data } = await admin
    .from("approach_audios")
    .select("storage_path, mime")
    .eq("organization_id", ctx.dest.organization_id)
    .eq("id", audioId)
    .maybeSingle();
  const arquivo = data as { storage_path: string; mime: string } | null;
  if (!arquivo) return null;
  const destino = caminhoNaConversa(
    ctx.dest.organization_id,
    conversationId,
    mensagemId,
    arquivo.mime,
  );
  const { error } = await admin.storage.from(BUCKET_DOS_AUDIOS).copy(arquivo.storage_path, destino);
  if (error) throw new Error(`áudio da abordagem: cópia falhou — ${error.message}`);
  return { caminho: destino, mime: arquivo.mime };
}

/** A pessoa aprovou (com o texto que viu, editado ou não): a mensagem sai e o fluxo segue. */
export async function enviarProposta(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    campaignId: string;
    recipientId: string;
    corpo?: string;
    agora?: Date;
  },
): Promise<ResultadoDaProposta> {
  const ctx = await propostaPendente(
    admin,
    input.organizationId,
    input.campaignId,
    input.recipientId,
  );
  if (!ctx) return NAO_ACHEI;
  const audio = ctx.dest.proposal_kind === "audio";
  const corpo = audio ? "" : limparMensagemDaIA(input.corpo ?? ctx.dest.proposal_body ?? "");
  if (!audio && !corpo)
    return { ok: false, mensagem: "Escreva a mensagem antes de enviar.", status: 422 };
  if (ctx.contato.is_blocked) {
    await parar(admin, input.organizationId, input.recipientId, "opt_out", ["proposta_pendente"]);
    return { ok: false, mensagem: "Este contato pediu para não receber mensagens.", status: 409 };
  }
  if (!ctx.dest.channel_session_id) {
    return { ok: false, mensagem: "Este lead não tem número de envio definido.", status: 409 };
  }
  const passo = ctx.dest.flow_step ?? 0;
  try {
    const boundary = await beginServiceAtOrigin(
      admin,
      input.organizationId,
      ctx.dest.contact_id,
      ctx.dest.channel_session_id,
    );
    const mensagemId = randomUUID();
    const midia = audio
      ? await copiarAudioParaAConversa(admin, ctx, boundary.conversation_id, mensagemId)
      : null;
    if (audio && !midia) {
      return {
        ok: false,
        mensagem:
          "Este passo não tem um arquivo de voz na biblioteca. Escolha o áudio no fluxo da abordagem, ou mande à mão e use “Já mandei”.",
        status: 422,
      };
    }
    const mensagem = await sendMessageHandler(
      admin,
      {
        organization_id: input.organizationId,
        serviceBoundary: boundary,
        proactiveContext: { organizationId: input.organizationId, contactId: ctx.dest.contact_id },
        actor: { type: "webhook_source", id: `campaign:${ctx.campanha.id}` },
        requestId: `campaign-flow:${ctx.dest.id}:${passo}`,
        internalMessageId: mensagemId,
      } as Parameters<typeof sendMessageHandler>[1],
      {
        conversation_id: boundary.conversation_id,
        type: midia ? "audio" : "text",
        ...(midia
          ? { media_storage_path: midia.caminho, media_mime: midia.mime }
          : { body: corpo }),
        metadata: {
          source: "campaign_flow",
          campaign_id: ctx.campanha.id,
          campaign_recipient_id: ctx.dest.id,
          flow_step: passo,
          idempotency_key: `campaign_flow:${ctx.dest.id}:${passo}`,
        },
      } as Parameters<typeof sendMessageHandler>[2],
    );
    if ((mensagem as { status?: string }).status === "failed") {
      return {
        ok: false,
        mensagem: "A mensagem não saiu. Tente de novo em instantes.",
        status: 502,
      };
    }
  } catch (e) {
    logger.warn("[campanha] o envio da continuação falhou", {
      recipient_id: ctx.dest.id,
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, mensagem: "A mensagem não saiu. Tente de novo em instantes.", status: 502 };
  }
  await avancar(admin, ctx, passo + 1, "proposta_pendente", input.agora ?? new Date());
  return { ok: true };
}

/** A pessoa pulou este passo (ou mandou o áudio à mão): o fluxo segue sem enviar nada. */
export async function pularProposta(
  admin: SupabaseClient,
  input: { organizationId: string; campaignId: string; recipientId: string; agora?: Date },
): Promise<ResultadoDaProposta> {
  const ctx = await propostaPendente(
    admin,
    input.organizationId,
    input.campaignId,
    input.recipientId,
  );
  if (!ctx) return NAO_ACHEI;
  await avancar(
    admin,
    ctx,
    (ctx.dest.flow_step ?? 0) + 1,
    "proposta_pendente",
    input.agora ?? new Date(),
  );
  return { ok: true };
}

/** A pessoa encerrou o fluxo deste lead. */
export async function pararFluxo(
  admin: SupabaseClient,
  input: { organizationId: string; campaignId: string; recipientId: string },
): Promise<ResultadoDaProposta> {
  const ctx = await carregarContexto(admin, input.organizationId, input.recipientId);
  if (!ctx || ctx.dest.campaign_id !== input.campaignId) return NAO_ACHEI;
  const parou = await parar(admin, input.organizationId, input.recipientId, "descartado", [
    "aguardando_resposta",
    "proposta_pendente",
  ]);
  return parou ? { ok: true } : { ok: false, mensagem: "Este fluxo já terminou.", status: 409 };
}

/** Pede à IA uma nova versão da mensagem proposta. */
export async function reescreverProposta(
  admin: SupabaseClient,
  input: { organizationId: string; campaignId: string; recipientId: string },
): Promise<ResultadoDaProposta> {
  const ctx = await propostaPendente(
    admin,
    input.organizationId,
    input.campaignId,
    input.recipientId,
  );
  if (!ctx || ctx.dest.proposal_kind !== "mensagem") return NAO_ACHEI;
  const { passos } = await passosDoDisparo(admin, input.organizationId, ctx.campanha);
  const passo = passos[ctx.dest.flow_step ?? -1];
  if (!passo || passo.kind !== "mensagem") return NAO_ACHEI;
  const texto = await escreverContinuacao(admin, ctx, passo);
  if (!texto) {
    return {
      ok: false,
      mensagem: "A IA não conseguiu escrever agora. Escreva à mão.",
      status: 503,
    };
  }
  await admin
    .from("campaign_recipients")
    .update({ proposal_body: texto, proposal_ai: true })
    .eq("organization_id", input.organizationId)
    .eq("id", input.recipientId)
    .eq("flow_state", "proposta_pendente");
  return { ok: true };
}

export interface ItemDaContinuacao {
  id: string;
  nome: string;
  estado: EstadoDoFluxo;
  passo: number | null;
  tipo: "mensagem" | "audio" | null;
  corpo: string;
  ia: boolean;
  /** O que o lead respondeu (só nas propostas), para a pessoa decidir com o contexto. */
  respostas: string[];
  aguardaAte: string | null;
  motivo: string | null;
}

export interface ContinuacoesDoDisparo {
  resumo: Record<EstadoDoFluxo, number>;
  itens: ItemDaContinuacao[];
}

const ORDEM_DOS_ESTADOS: Record<EstadoDoFluxo, number> = {
  proposta_pendente: 0,
  aguardando_resposta: 1,
  encaminhado: 2,
  parado: 3,
  concluido: 4,
};

/** Onde está o fluxo da conversa de cada lead do disparo: o que pede decisão vem primeiro. */
export async function listarContinuacoes(
  admin: SupabaseClient,
  disparo: { id: string; organization_id: string },
): Promise<ContinuacoesDoDisparo> {
  const { data } = await admin
    .from("campaign_recipients")
    .select(`${COLUNAS}, flow_stop_reason, contacts(name, display_name)`)
    .eq("organization_id", disparo.organization_id)
    .eq("campaign_id", disparo.id)
    .not("flow_state", "is", null)
    .order("sent_at", { ascending: true })
    .limit(200);
  const linhas = (data ?? []) as unknown as Array<
    DestinatarioDoFluxo & {
      flow_stop_reason: string | null;
      contacts: { name: string | null; display_name: string | null } | null;
    }
  >;
  const resumo: Record<EstadoDoFluxo, number> = {
    aguardando_resposta: 0,
    proposta_pendente: 0,
    concluido: 0,
    encaminhado: 0,
    parado: 0,
  };
  for (const l of linhas) if (l.flow_state) resumo[l.flow_state] += 1;

  linhas.sort(
    (a, b) =>
      ORDEM_DOS_ESTADOS[a.flow_state ?? "concluido"] -
      ORDEM_DOS_ESTADOS[b.flow_state ?? "concluido"],
  );
  const itens: ItemDaContinuacao[] = [];
  for (const l of linhas.slice(0, 100)) {
    const estado = l.flow_state!;
    const respostas =
      estado === "proposta_pendente"
        ? await respostasDoLead(admin, {
            dest: l,
            campanha: { id: disparo.id, name: "", approach_id: null },
            contato: { name: null, display_name: null, is_blocked: false },
          })
        : [];
    itens.push({
      id: l.id,
      nome: nomeDoContato(l.contacts) ?? "Sem nome",
      estado,
      passo: l.flow_step,
      tipo: l.proposal_kind,
      corpo: l.proposal_body ?? "",
      ia: l.proposal_ai,
      respostas,
      aguardaAte: l.flow_wait_until,
      motivo: l.flow_stop_reason,
    });
  }
  return { resumo, itens };
}
