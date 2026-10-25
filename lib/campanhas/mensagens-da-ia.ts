import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";

import { cerebroDaOrganizacao } from "@/lib/ai/cerebro-da-organizacao";
import { computeCost } from "@/lib/ai/cost";
import { buildModel } from "@/lib/ai/runtime/agent";
import type { PassoDoFluxo } from "@/lib/cadencia/fluxo-da-abordagem";
import { logger } from "@/lib/logger";

import { AVISO_DO_CANAL_OFICIAL, canalDoDisparo } from "./canal-do-disparo";

import {
  CONCORRENCIA_DA_IA,
  SISTEMA_DA_MENSAGEM,
  TETO_DE_LEADS_COM_IA,
  aberturaEhDaIA,
  extrasDoLead,
  limparMensagemDaIA,
  montarPedidoDaMensagem,
} from "./mensagem-da-ia";

/** O mínimo do disparo que este módulo precisa saber. */
export interface DisparoComIA {
  id: string;
  organization_id: string;
  channel_session_id?: string | null;
  approach_id?: string | null;
  demand_campaign_id?: string | null;
  ai_approved_at?: string | null;
}

interface Abertura {
  abordagem: { id: string; name: string; script: string; central_idea: string };
  passos: PassoDoFluxo[];
}

/** A abordagem do disparo e o fluxo dela, ou null se o disparo não tem. */
export async function carregarAbertura(
  admin: SupabaseClient,
  disparo: DisparoComIA,
): Promise<Abertura | null> {
  if (!disparo.approach_id) return null;
  const { data: ab } = await admin
    .from("demand_campaign_approaches")
    .select("id, name, script, central_idea")
    .eq("organization_id", disparo.organization_id)
    .eq("id", disparo.approach_id)
    .maybeSingle();
  if (!ab) return null;
  const { data: passos } = await admin
    .from("demand_approach_steps")
    .select("kind, body, ai_personalize, audio_label, audio_id, wait_hours")
    .eq("organization_id", disparo.organization_id)
    .eq("approach_id", disparo.approach_id)
    .order("position", { ascending: true })
    .limit(50);
  return {
    abordagem: ab as Abertura["abordagem"],
    passos: (passos ?? []) as PassoDoFluxo[],
  };
}

/** O disparo precisa da aprovação das mensagens da IA antes de iniciar? */
export async function exigeAprovacaoDaIA(
  admin: SupabaseClient,
  disparo: DisparoComIA,
): Promise<boolean> {
  const a = await carregarAbertura(admin, disparo);
  return aberturaEhDaIA(a?.passos);
}

async function contarElegiveis(admin: SupabaseClient, disparo: DisparoComIA): Promise<number> {
  const { count } = await admin
    .from("campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", disparo.organization_id)
    .eq("campaign_id", disparo.id)
    .eq("eligibility_status", "eligible");
  return count ?? 0;
}

/** A recusa de iniciar/agendar quando a mensagem da IA não foi aprovada ou o público passa do teto. */
export async function recusaPorMensagensDaIA(
  admin: SupabaseClient,
  disparo: DisparoComIA,
): Promise<{
  codigo:
    | "campanha_mensagens_nao_aprovadas"
    | "campanha_ia_acima_do_teto"
    | "campanha_canal_indisponivel";
  mensagem: string;
  status: number;
} | null> {
  if (!(await exigeAprovacaoDaIA(admin, disparo))) return null;
  // A abertura livre da IA não cabe em número oficial: o canal a recusaria depois do "enviado".
  const canal = await canalDoDisparo(admin, disparo);
  if (!canal.aceitaMensagemLivre) {
    return { codigo: "campanha_canal_indisponivel", mensagem: AVISO_DO_CANAL_OFICIAL, status: 409 };
  }
  const elegiveis = await contarElegiveis(admin, disparo);
  if (elegiveis > TETO_DE_LEADS_COM_IA) {
    return {
      codigo: "campanha_ia_acima_do_teto",
      mensagem: `Com mensagem da IA o disparo vai até ${TETO_DE_LEADS_COM_IA} leads por enquanto (este tem ${elegiveis}). Reduza o público e prepare de novo.`,
      status: 422,
    };
  }
  if (!disparo.ai_approved_at) {
    return {
      codigo: "campanha_mensagens_nao_aprovadas",
      mensagem: "Gere e aprove as mensagens da IA antes de iniciar.",
      status: 409,
    };
  }
  return null;
}

export interface ItemDaRevisao {
  id: string;
  nome: string;
  corpo: string;
  status: "gerada" | "editada" | "falhou" | "pendente";
  erro: string | null;
}

export interface RevisaoDasMensagens {
  precisa_ia: boolean;
  aprovada_em: string | null;
  elegiveis: number;
  teto: number;
  /** O canal aceita a abertura livre? Se não, a frase que explica (número da API oficial). */
  canal: { aceita_mensagem_livre: boolean; aviso: string | null };
  resumo: { geradas: number; editadas: number; falhas: number; pendentes: number };
  custo_cents: number;
  itens: ItemDaRevisao[];
}

const nomeDoContato = (c: { name?: string | null; display_name?: string | null } | null) =>
  (c?.display_name || c?.name || "").trim() || "Sem nome";

/** O que a tela de revisão mostra: o estado das mensagens da IA dos primeiros leads elegíveis. */
export async function revisaoDasMensagens(
  admin: SupabaseClient,
  disparo: DisparoComIA,
): Promise<RevisaoDasMensagens> {
  const precisa = await exigeAprovacaoDaIA(admin, disparo);
  const vazio: RevisaoDasMensagens = {
    precisa_ia: precisa,
    aprovada_em: disparo.ai_approved_at ?? null,
    elegiveis: 0,
    teto: TETO_DE_LEADS_COM_IA,
    canal: { aceita_mensagem_livre: true, aviso: null },
    resumo: { geradas: 0, editadas: 0, falhas: 0, pendentes: 0 },
    custo_cents: 0,
    itens: [],
  };
  if (!precisa) return vazio;
  const canal = await canalDoDisparo(admin, disparo);
  vazio.canal = {
    aceita_mensagem_livre: canal.aceitaMensagemLivre,
    aviso: canal.aceitaMensagemLivre ? null : AVISO_DO_CANAL_OFICIAL,
  };
  const { data } = await admin
    .from("campaign_recipients")
    .select("id, rendered_body, ai_status, ai_error, ai_cost_cents, contacts(name, display_name)")
    .eq("organization_id", disparo.organization_id)
    .eq("campaign_id", disparo.id)
    .eq("eligibility_status", "eligible")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(TETO_DE_LEADS_COM_IA + 1);
  const linhas = (data ?? []) as unknown as Array<{
    id: string;
    rendered_body: string | null;
    ai_status: "gerada" | "editada" | "falhou" | null;
    ai_error: string | null;
    ai_cost_cents: number | null;
    contacts: { name: string | null; display_name: string | null } | null;
  }>;
  const elegiveis = await contarElegiveis(admin, disparo);
  const resumo = { geradas: 0, editadas: 0, falhas: 0, pendentes: 0 };
  let custo = 0;
  const itens = linhas.slice(0, TETO_DE_LEADS_COM_IA).map((l): ItemDaRevisao => {
    const status = l.ai_status ?? "pendente";
    if (status === "gerada") resumo.geradas += 1;
    else if (status === "editada") resumo.editadas += 1;
    else if (status === "falhou") resumo.falhas += 1;
    else resumo.pendentes += 1;
    custo += Number(l.ai_cost_cents ?? 0);
    return {
      id: l.id,
      nome: nomeDoContato(l.contacts),
      corpo: l.ai_status ? (l.rendered_body ?? "") : "",
      status,
      erro: l.ai_error,
    };
  });
  return { ...vazio, elegiveis, resumo, custo_cents: custo, itens };
}

/** A aprovação cai sempre que as mensagens mudam: ela vale para o texto que a pessoa viu. */
async function derrubarAprovacao(admin: SupabaseClient, disparo: DisparoComIA) {
  await admin
    .from("campaigns")
    .update({ ai_approved_at: null, ai_approved_by: null })
    .eq("organization_id", disparo.organization_id)
    .eq("id", disparo.id);
}

export type ResultadoDaGeracao =
  | { ok: true; geradas: number; falhas: number; custo_cents: number }
  | {
      ok: false;
      codigo: "campanha_conteudo_invalido" | "campanha_ia_acima_do_teto" | "unavailable";
      mensagem: string;
      status: number;
    };

/**
 * Escreve com a IA a abertura de cada lead elegível (ou só do `apenas`), grava em `rendered_body`
 * e derruba a aprovação. Falha de UM lead não derruba a lista: o lead fica "falhou", sem texto, e
 * não sai. Usa a IA da própria empresa (o agente principal).
 */
export async function gerarMensagensDaIA(
  admin: SupabaseClient,
  disparo: DisparoComIA,
  opcoes: { apenas?: string } = {},
): Promise<ResultadoDaGeracao> {
  const abertura = await carregarAbertura(admin, disparo);
  if (!abertura || !aberturaEhDaIA(abertura.passos)) {
    return {
      ok: false,
      codigo: "campanha_conteudo_invalido",
      mensagem: "A abordagem deste disparo não tem mensagem da IA na abertura.",
      status: 422,
    };
  }
  const elegiveis = await contarElegiveis(admin, disparo);
  if (elegiveis > TETO_DE_LEADS_COM_IA) {
    return {
      ok: false,
      codigo: "campanha_ia_acima_do_teto",
      mensagem: `Com mensagem da IA o disparo vai até ${TETO_DE_LEADS_COM_IA} leads por enquanto (este tem ${elegiveis}). Reduza o público e prepare de novo.`,
      status: 422,
    };
  }
  const cerebro = await cerebroDaOrganizacao(admin, disparo.organization_id);
  if ("erro" in cerebro) {
    return { ok: false, codigo: "unavailable", mensagem: cerebro.erro, status: 503 };
  }

  let consulta = admin
    .from("campaign_recipients")
    .select("id, contact_id, contacts(name, display_name)")
    .eq("organization_id", disparo.organization_id)
    .eq("campaign_id", disparo.id)
    .eq("eligibility_status", "eligible")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(TETO_DE_LEADS_COM_IA);
  if (opcoes.apenas) consulta = consulta.eq("id", opcoes.apenas);
  const { data } = await consulta;
  const alvos = (data ?? []) as unknown as Array<{
    id: string;
    contact_id: string;
    contacts: { name: string | null; display_name: string | null } | null;
  }>;

  // Os dados do lead na campanha de prospecção: o título e os campos curtos do cartão.
  const leadsPorContato = new Map<string, { title: string; extras: Record<string, string> }>();
  if (disparo.demand_campaign_id && alvos.length > 0) {
    const { data: leads } = await admin
      .from("crm_leads")
      .select("contact_id, title, custom_fields")
      .eq("organization_id", disparo.organization_id)
      .eq("demand_campaign_id", disparo.demand_campaign_id)
      .in(
        "contact_id",
        alvos.map((a) => a.contact_id),
      );
    for (const l of (leads ?? []) as Array<{
      contact_id: string;
      title: string | null;
      custom_fields: Record<string, unknown> | null;
    }>) {
      leadsPorContato.set(l.contact_id, {
        title: l.title ?? "",
        extras: extrasDoLead(l.custom_fields),
      });
    }
  }

  const modeloId = cerebro.model;
  const modelo = buildModel(cerebro.provider, cerebro.apiKey, modeloId);
  const passoDeAbertura = abertura.passos[0]!;
  const resultado = { geradas: 0, falhas: 0, custo_cents: 0 };

  async function escreverUma(alvo: (typeof alvos)[number]) {
    const nome = nomeDoContato(alvo.contacts);
    const lead = leadsPorContato.get(alvo.contact_id);
    try {
      const r = await generateText({
        model: modelo,
        system: SISTEMA_DA_MENSAGEM,
        prompt: montarPedidoDaMensagem({
          ideiaCentral: abertura!.abordagem.central_idea,
          instrucao: passoDeAbertura.body,
          nomeDaAbordagem: abertura!.abordagem.name,
          roteiroDeApoio: abertura!.abordagem.script,
          lead: { nome, titulo: lead?.title ?? "", extras: lead?.extras ?? {} },
        }),
        maxOutputTokens: 300,
      });
      const texto = limparMensagemDaIA(r.text);
      if (!texto) throw new Error("a IA devolveu vazio");
      const tokens = (r.usage?.inputTokens ?? 0) + (r.usage?.outputTokens ?? 0);
      const custo = await computeCost({
        model: modeloId,
        promptTokens: r.usage?.inputTokens ?? 0,
        completionTokens: r.usage?.outputTokens ?? 0,
      }).catch(() => 0);
      await admin
        .from("campaign_recipients")
        .update({
          rendered_body: texto,
          ai_status: "gerada",
          ai_error: null,
          ai_cost_cents: custo,
          ai_tokens: tokens,
        })
        .eq("organization_id", disparo.organization_id)
        .eq("id", alvo.id);
      resultado.geradas += 1;
      resultado.custo_cents += custo;
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      logger.warn("[campanha] a IA não escreveu a mensagem de um lead", {
        recipient_id: alvo.id,
        error: motivo,
      });
      await admin
        .from("campaign_recipients")
        .update({ ai_status: "falhou", ai_error: motivo.slice(0, 300) })
        .eq("organization_id", disparo.organization_id)
        .eq("id", alvo.id);
      resultado.falhas += 1;
    }
  }

  for (let i = 0; i < alvos.length; i += CONCORRENCIA_DA_IA) {
    await Promise.all(alvos.slice(i, i + CONCORRENCIA_DA_IA).map(escreverUma));
  }
  await derrubarAprovacao(admin, disparo);
  return { ok: true, ...resultado };
}

export type ResultadoDaEdicao = { ok: true } | { ok: false; mensagem: string; status: number };

/** A pessoa mexeu numa mensagem (ou tirou o lead da lista): vale o que ela escreveu, e a aprovação cai. */
export async function editarMensagemDaIA(
  admin: SupabaseClient,
  disparo: DisparoComIA,
  recipientId: string,
  mudanca: { corpo?: string; excluir?: boolean },
): Promise<ResultadoDaEdicao> {
  const { data: r } = await admin
    .from("campaign_recipients")
    .select("id, eligibility_status")
    .eq("organization_id", disparo.organization_id)
    .eq("campaign_id", disparo.id)
    .eq("id", recipientId)
    .maybeSingle();
  if (!r) return { ok: false, mensagem: "Destinatário não encontrado.", status: 404 };
  if (mudanca.excluir) {
    await admin
      .from("campaign_recipients")
      .update({
        eligibility_status: "excluded",
        exclusion_reason: "removido_na_revisao",
        status: "skipped",
        recipient_address: null,
      })
      .eq("organization_id", disparo.organization_id)
      .eq("id", recipientId);
  } else if (typeof mudanca.corpo === "string") {
    const corpo = limparMensagemDaIA(mudanca.corpo);
    if (!corpo) return { ok: false, mensagem: "A mensagem não pode ficar vazia.", status: 422 };
    await admin
      .from("campaign_recipients")
      .update({ rendered_body: corpo, ai_status: "editada", ai_error: null })
      .eq("organization_id", disparo.organization_id)
      .eq("id", recipientId);
  }
  await derrubarAprovacao(admin, disparo);
  return { ok: true };
}

export type ResultadoDaAprovacao = { ok: true } | { ok: false; mensagem: string; status: number };

/** Aprova: só com todas as mensagens prontas (nenhuma falhou nem está pendente) e dentro do teto. */
export async function aprovarMensagensDaIA(
  admin: SupabaseClient,
  disparo: DisparoComIA,
  quem: string,
  agora: Date,
): Promise<ResultadoDaAprovacao> {
  const r = await revisaoDasMensagens(admin, disparo);
  if (!r.precisa_ia) {
    return { ok: false, mensagem: "Este disparo não usa mensagem da IA.", status: 422 };
  }
  if (r.elegiveis === 0) return { ok: false, mensagem: "Não há leads elegíveis.", status: 422 };
  if (r.elegiveis > TETO_DE_LEADS_COM_IA) {
    return { ok: false, mensagem: `O teto inicial é ${TETO_DE_LEADS_COM_IA} leads.`, status: 422 };
  }
  if (r.resumo.pendentes > 0 || r.resumo.falhas > 0) {
    return {
      ok: false,
      mensagem: "Há leads sem mensagem pronta: gere de novo, escreva à mão ou tire-os da lista.",
      status: 409,
    };
  }
  await admin
    .from("campaigns")
    .update({ ai_approved_at: agora.toISOString(), ai_approved_by: quem })
    .eq("organization_id", disparo.organization_id)
    .eq("id", disparo.id);
  return { ok: true };
}
