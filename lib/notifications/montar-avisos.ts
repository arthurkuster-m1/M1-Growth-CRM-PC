/**
 * QUEM RECEBE CADA NOTIFICAÇÃO, e com quais dados — lido do banco.
 *
 * A regra de destinatário é uma só para tudo:
 *
 *   - tem RESPONSÁVEL (a pessoa atribuída à conversa, ou o dono do lead) → só ela;
 *   - não tem responsável → a EQUIPE QUE DISTRIBUI (gestores e administradores);
 *   - erro de SISTEMA (WhatsApp caiu, IA sem saldo, limite de IA) → só ADMINISTRADORES.
 *
 * Nunca mais "toda a organização": um atendente só recebe o que é dele.
 *
 * ⚠️ O client é service-role (ignora RLS): TODA consulta filtra `organization_id`, que vem do
 * evento (`event_log.organization_id`), nunca de um corpo de requisição.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { phoneForDisplay } from "@/lib/channels/phone-variants";
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { ehAvisoDeEtapa } from "@/lib/leads/aviso-de-etapa";

import {
  LINKS,
  avisoDeLeadAtribuido,
  avisoDeLeadNovo,
  avisoDeMencao,
  avisoDeMensagem,
  avisoDeMensagemDeGrupo,
  avisoDeTarefa,
  limitar,
  nomeComTelefone,
  type AcaoDoAviso,
  type AvisoPessoal,
  type CategoriaDeNotificacao,
  type LeadDoAviso,
  type PessoaDoAviso,
} from "./aviso-pessoal";

type Admin = SupabaseClient;

export interface Entrega {
  destinatarios: string[];
  aviso: AvisoPessoal;
}

/** Lead que nasceu há menos que isto ainda é "novo lead" na primeira mensagem. */
const JANELA_DE_LEAD_NOVO_MS = 10 * 60 * 1000;

// ── Pessoas da organização ──────────────────────────────────────────────────

async function membrosComPapel(admin: Admin, org: string, papeis: string[]): Promise<string[]> {
  const { data } = await admin
    .from("user_organizations")
    .select("user_id")
    .eq("organization_id", org)
    .in("role", papeis)
    .is("revoked_at", null);
  return [...new Set(((data ?? []) as Array<{ user_id: string }>).map((m) => m.user_id))];
}

/** Gestores e administradores: quem distribui o que ainda não tem dono. */
export function equipeQueDistribui(admin: Admin, org: string): Promise<string[]> {
  return membrosComPapel(admin, org, ["manager", "admin"]);
}

export function administradores(admin: Admin, org: string): Promise<string[]> {
  return membrosComPapel(admin, org, ["admin"]);
}

async function membroAtivo(admin: Admin, org: string, userId: string): Promise<boolean> {
  const { data } = await admin
    .from("user_organizations")
    .select("user_id")
    .eq("organization_id", org)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .limit(1);
  return ((data ?? []) as unknown[]).length > 0;
}

/** O primeiro responsável que ainda é da organização; sem nenhum, a equipe que distribui. */
export async function responsavelOuEquipe(
  admin: Admin,
  org: string,
  candidatos: Array<string | null | undefined>,
): Promise<string[]> {
  for (const c of candidatos) {
    if (c && (await membroAtivo(admin, org, c))) return [c];
  }
  return equipeQueDistribui(admin, org);
}

// ── Leituras ────────────────────────────────────────────────────────────────

interface Conversa {
  id: string;
  contact_id: string | null;
  assigned_to_user_id: string | null;
  is_group: boolean | null;
  status: string | null;
}

async function lerConversa(admin: Admin, org: string, id: string): Promise<Conversa | null> {
  const { data } = await admin
    .from("conversations")
    .select("id, contact_id, assigned_to_user_id, is_group, status")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  return (data as Conversa | null) ?? null;
}

interface Contato {
  id: string;
  name: string | null;
  display_name: string | null;
  phone_number: string | null;
  avatar_storage_path: string | null;
  is_anonymized: boolean | null;
  is_personal: boolean | null;
}

async function lerContato(admin: Admin, org: string, id: string | null): Promise<Contato | null> {
  if (!id) return null;
  const { data } = await admin
    .from("contacts")
    .select("id, name, display_name, phone_number, avatar_storage_path, is_anonymized, is_personal")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  return (data as Contato | null) ?? null;
}

/** Nome legível (nunca o identificador técnico do WhatsApp) e telefone formatado. */
export function pessoaDoContato(
  c: Pick<Contato, "name" | "display_name" | "phone_number"> | null,
  reserva?: string | null,
): PessoaDoAviso {
  const telefone = phoneForDisplay(c?.phone_number ?? null);
  const nome = nomeDoContato(c) ?? (telefone || (reserva?.trim() ?? "") || "Cliente sem nome");
  return { nome, telefone };
}

interface Lead {
  id: string;
  contact_id: string | null;
  owner_user_id: string | null;
  title: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  source: string | null;
  status: string | null;
  created_at: string | null;
}

const COLUNAS_DO_LEAD =
  "id, contact_id, owner_user_id, title, pipeline_id, stage_id, source, status, created_at";

async function lerLead(admin: Admin, org: string, id: string | null): Promise<Lead | null> {
  if (!id) return null;
  const { data } = await admin
    .from("crm_leads")
    .select(COLUNAS_DO_LEAD)
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  return (data as Lead | null) ?? null;
}

async function leadAbertoDoContato(
  admin: Admin,
  org: string,
  contactId: string | null,
): Promise<Lead | null> {
  if (!contactId) return null;
  const { data } = await admin
    .from("crm_leads")
    .select(COLUNAS_DO_LEAD)
    .eq("organization_id", org)
    .eq("contact_id", contactId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1);
  return ((data ?? []) as Lead[])[0] ?? null;
}

async function conversaDoContato(
  admin: Admin,
  org: string,
  contactId: string | null,
): Promise<string | null> {
  if (!contactId) return null;
  const { data } = await admin
    .from("conversations")
    .select("id")
    .eq("organization_id", org)
    .eq("contact_id", contactId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1);
  return ((data ?? []) as Array<{ id: string }>)[0]?.id ?? null;
}

async function nomesDoFunil(
  admin: Admin,
  org: string,
  pipelineId: string | null,
  stageId: string | null,
): Promise<{ funil: string | null; etapa: string | null }> {
  const [funil, etapa] = await Promise.all([
    pipelineId
      ? admin
          .from("crm_pipelines")
          .select("name")
          .eq("organization_id", org)
          .eq("id", pipelineId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    stageId
      ? admin
          .from("crm_stages")
          .select("name")
          .eq("organization_id", org)
          .eq("id", stageId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    funil: (funil.data as { name?: string | null } | null)?.name?.trim() || null,
    etapa: (etapa.data as { name?: string | null } | null)?.name?.trim() || null,
  };
}

/** A origem do lead em palavras; códigos internos não vão para a notificação. */
export function origemLegivel(source: string | null): string | null {
  const s = (source ?? "").trim();
  if (!s) return null;
  const conhecidas: Record<string, string | null> = {
    whatsapp: "WhatsApp",
    manual: "Cadastro manual",
    webhook: "Formulário",
    api: "Integração",
    importacao_planilha: null,
    retomada: null,
  };
  if (Object.hasOwn(conhecidas, s.toLowerCase())) return conhecidas[s.toLowerCase()] ?? null;
  return limitar(s, 40);
}

async function fotoDoContato(admin: Admin, c: Contato | null): Promise<string | null> {
  if (!c?.avatar_storage_path || c.is_anonymized) return null;
  const { data } = await admin.storage
    .from("whatsapp-media")
    .createSignedUrl(c.avatar_storage_path, 300);
  return data?.signedUrl ?? null;
}

async function dadosDoLead(
  admin: Admin,
  org: string,
  lead: Lead,
): Promise<{ l: LeadDoAviso; contato: Contato | null }> {
  const [contato, conversaId, nomes] = await Promise.all([
    lerContato(admin, org, lead.contact_id),
    conversaDoContato(admin, org, lead.contact_id),
    nomesDoFunil(admin, org, lead.pipeline_id, lead.stage_id),
  ]);
  return {
    contato,
    l: {
      pessoa: pessoaDoContato(contato, lead.title),
      leadId: lead.id,
      contatoId: lead.contact_id,
      conversaId,
      funil: nomes.funil,
      etapa: nomes.etapa,
      origem: origemLegivel(lead.source),
    },
  };
}

// ── Eventos ─────────────────────────────────────────────────────────────────

/** Mensagem 1:1 que chegou (`message.received`). `null` = ninguém deve ser avisado. */
export async function montarAvisoDeMensagem(
  admin: Admin,
  org: string,
  payload: Record<string, unknown>,
): Promise<Entrega | null> {
  const conversaId = typeof payload.conversation_id === "string" ? payload.conversation_id : null;
  if (!conversaId) return null;
  const conversa = await lerConversa(admin, org, conversaId);
  if (!conversa) return null;
  // A IA está atendendo e ninguém assumiu: quem avisa é a passagem para pessoa, não cada mensagem.
  if (!conversa.assigned_to_user_id && conversa.status === "ai_handling") return null;

  const contactId =
    (typeof payload.contact_id === "string" ? payload.contact_id : null) ?? conversa.contact_id;
  const contato = await lerContato(admin, org, contactId);
  // Contato pessoal não avisa ninguém (spec 21, caminho 3).
  if (contato?.is_personal === true) return null;
  const lead = await leadAbertoDoContato(admin, org, contactId);

  const destinatarios = await responsavelOuEquipe(admin, org, [
    conversa.assigned_to_user_id,
    lead?.owner_user_id,
  ]);
  const leadNovo =
    !!lead?.created_at && Date.now() - Date.parse(lead.created_at) < JANELA_DE_LEAD_NOVO_MS;
  const preview = typeof payload.body_preview === "string" ? payload.body_preview : "";
  const tipo = typeof payload.type === "string" ? payload.type : "text";

  return {
    destinatarios,
    aviso: avisoDeMensagem({
      pessoa: pessoaDoContato(contato),
      preview,
      midia: tipo !== "text",
      conversaId,
      leadId: lead?.id ?? null,
      leadNovo,
      icone: await fotoDoContato(admin, contato),
    }),
  };
}

/** Mensagem num grupo ligado (`message.group_received`). */
export async function montarAvisoDeGrupo(
  admin: Admin,
  org: string,
  payload: Record<string, unknown>,
): Promise<Entrega | null> {
  const conversaId = typeof payload.conversation_id === "string" ? payload.conversation_id : null;
  if (!conversaId) return null;
  const conversa = await lerConversa(admin, org, conversaId);
  if (!conversa) return null;
  const grupo = await lerContato(admin, org, conversa.contact_id);
  const preview = typeof payload.body_preview === "string" ? payload.body_preview : "";
  const tipo = typeof payload.type === "string" ? payload.type : "text";
  return {
    destinatarios: await responsavelOuEquipe(admin, org, [conversa.assigned_to_user_id]),
    aviso: avisoDeMensagemDeGrupo({
      grupo: nomeDoContato(grupo),
      preview,
      midia: tipo !== "text",
      conversaId,
    }),
  };
}

/** Lead que nasceu (`lead.created`). Importação de planilha não avisa (seriam centenas). */
export async function montarAvisoDeLeadNovo(
  admin: Admin,
  org: string,
  leadId: string,
  metadata: Record<string, unknown>,
): Promise<Entrega | null> {
  if (metadata.via) return null;
  const lead = await lerLead(admin, org, leadId);
  if (!lead) return null;
  const { l, contato } = await dadosDoLead(admin, org, lead);
  if (contato?.is_personal === true) return null;
  return {
    destinatarios: await responsavelOuEquipe(admin, org, [lead.owner_user_id]),
    aviso: avisoDeLeadNovo(l),
  };
}

/** O lead passou a ser de uma pessoa (`lead.assigned`). Só ela é avisada. */
export async function montarAvisoDeLeadAtribuido(
  admin: Admin,
  org: string,
  leadId: string,
  paraUserId: string | null,
): Promise<Entrega | null> {
  if (!paraUserId || !(await membroAtivo(admin, org, paraUserId))) return null;
  const lead = await lerLead(admin, org, leadId);
  if (!lead) return null;
  const { l } = await dadosDoLead(admin, org, lead);
  return { destinatarios: [paraUserId], aviso: avisoDeLeadAtribuido(l) };
}

async function nomeDeQuemEscreveu(admin: Admin, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    const meta = (data?.user?.user_metadata ?? {}) as { full_name?: string; name?: string };
    const nome = (meta.full_name ?? meta.name ?? "").trim();
    if (nome) return nome.split(/\s+/)[0] ?? nome;
    const email = data?.user?.email ?? "";
    return email ? email.split("@")[0]! : null;
  } catch {
    return null;
  }
}

/** Alguém mencionou uma pessoa numa nota interna (`user.mentioned`). */
export async function montarAvisoDeMencao(
  admin: Admin,
  org: string,
  payload: Record<string, unknown>,
): Promise<Entrega | null> {
  const para = typeof payload.to_user_id === "string" ? payload.to_user_id : null;
  if (!para) return null;
  const conversaId = typeof payload.conversation_id === "string" ? payload.conversation_id : null;
  const conversa = conversaId ? await lerConversa(admin, org, conversaId) : null;
  const contato = conversa ? await lerContato(admin, org, conversa.contact_id) : null;
  const quem = await nomeDeQuemEscreveu(
    admin,
    typeof payload.from_user_id === "string" ? payload.from_user_id : null,
  );
  return {
    destinatarios: [para],
    aviso: avisoDeMencao({
      quem,
      pessoa: contato ? pessoaDoContato(contato) : null,
      preview: typeof payload.body_preview === "string" ? payload.body_preview : "",
      conversaId: conversa?.id ?? null,
    }),
  };
}

/** Tarefa criada para alguém (automação/webhook). */
export async function montarAvisoDeTarefa(
  admin: Admin,
  org: string,
  input: {
    tarefaId: string;
    titulo: string;
    paraUserId: string;
    leadId: string | null;
    contatoId: string | null;
  },
): Promise<Entrega> {
  const contato = await lerContato(admin, org, input.contatoId);
  return {
    destinatarios: [input.paraUserId],
    aviso: avisoDeTarefa({
      titulo: input.titulo,
      tarefaId: input.tarefaId,
      pessoa: contato ? pessoaDoContato(contato) : null,
      leadId: input.leadId,
    }),
  };
}

// ── Avisos da Central que viram notificação ─────────────────────────────────

interface ItemDaCentral {
  id: string;
  kind: string;
  severity: string | null;
  ref_kind: string | null;
  ref_id: string | null;
  title: string;
  body: string | null;
}

function montar(
  categoria: CategoriaDeNotificacao,
  item: ItemDaCentral,
  titulo: string,
  corpo: string,
  acoes: AcaoDoAviso[],
): AvisoPessoal {
  return {
    categoria,
    titulo: limitar(titulo, 120),
    corpo: limitar(corpo, 240),
    acoes: (acoes.length > 0 ? acoes : [{ rotulo: "Abrir a Central", href: LINKS.central }]).slice(
      0,
      2,
    ),
    tag: `aviso:${item.id}`,
  };
}

/** O contexto de uma conversa: quem é o cliente, o lead aberto e o responsável. */
async function contextoDaConversa(admin: Admin, org: string, conversaId: string | null) {
  const conversa = conversaId ? await lerConversa(admin, org, conversaId) : null;
  const contato = conversa ? await lerContato(admin, org, conversa.contact_id) : null;
  const lead = conversa ? await leadAbertoDoContato(admin, org, conversa.contact_id) : null;
  return { conversa, contato, lead, pessoa: pessoaDoContato(contato) };
}

function acoesDaConversa(
  conversaId: string | null,
  leadId: string | null,
  primeiro = "Abrir conversa",
): AcaoDoAviso[] {
  const acoes: AcaoDoAviso[] = [];
  if (conversaId) acoes.push({ rotulo: primeiro, href: LINKS.conversa(conversaId) });
  if (leadId) acoes.push({ rotulo: "Abrir no CRM", href: LINKS.lead(leadId) });
  return acoes;
}

/**
 * Os avisos da Central que vão ao celular e à tela de alguém. O resto (configuração, rotinas
 * técnicas, relatórios) continua só na Central, sem tirar ninguém do que está fazendo.
 */
export async function montarAvisoDaCentral(
  admin: Admin,
  org: string,
  itemId: string,
): Promise<Entrega | null> {
  const { data } = await admin
    .from("agent_inbox_items")
    .select("id, kind, severity, ref_kind, ref_id, title, body")
    .eq("organization_id", org)
    .eq("id", itemId)
    .maybeSingle();
  const item = data as ItemDaCentral | null;
  if (!item) return null;
  const refConversa = item.ref_kind === "conversation" ? item.ref_id : null;

  switch (item.kind) {
    case "handoff":
    case "jev_pedido_de_humano":
    case "jev_parar_de_receber":
    case "snooze_expired":
    case "message_send_stuck": {
      const c = await contextoDaConversa(admin, org, refConversa);
      const destinatarios = await responsavelOuEquipe(admin, org, [
        c.conversa?.assigned_to_user_id,
        c.lead?.owner_user_id,
      ]);
      const conversaId = c.conversa?.id ?? null;
      const leadId = c.lead?.id ?? null;
      const textos: Record<string, [string, string, string]> = {
        handoff: [
          `${c.pessoa.nome} precisa de atendimento`,
          "A IA passou a conversa para a equipe. Assuma para responder.",
          "Assumir conversa",
        ],
        jev_pedido_de_humano: [
          `${c.pessoa.nome} quer falar com uma pessoa`,
          "Abra a conversa e assuma o atendimento.",
          "Abrir conversa",
        ],
        jev_parar_de_receber: [
          `${c.pessoa.nome} pediu para parar de receber mensagens`,
          "Abra a conversa e confirme o pedido.",
          "Abrir conversa",
        ],
        snooze_expired: [
          `${c.pessoa.nome} não respondeu no prazo`,
          "O prazo que você definiu para a resposta venceu. Decida o próximo passo.",
          "Abrir conversa",
        ],
        message_send_stuck: [
          `Mensagem não entregue a ${c.pessoa.nome}`,
          "Uma resposta ficou presa e não chegou ao cliente. Confira antes de reenviar.",
          "Abrir conversa",
        ],
      };
      const [titulo, corpo, botao] = textos[item.kind]!;
      return {
        destinatarios,
        aviso: montar(
          "atendimento",
          item,
          titulo,
          corpo,
          acoesDaConversa(conversaId, leadId, botao),
        ),
      };
    }

    case "routing_unassigned": {
      const c = await contextoDaConversa(admin, org, refConversa);
      return {
        destinatarios: await equipeQueDistribui(admin, org),
        aviso: montar(
          "atendimento",
          item,
          `Conversa sem responsável: ${c.pessoa.nome}`,
          item.body ?? "Ninguém da equipe foi atribuído a esta conversa.",
          acoesDaConversa(c.conversa?.id ?? null, c.lead?.id ?? null),
        ),
      };
    }

    case "voice_call_missed": {
      const contato =
        item.ref_kind === "contact" ? await lerContato(admin, org, item.ref_id) : null;
      const lead = await leadAbertoDoContato(admin, org, contato?.id ?? null);
      const conversaId = await conversaDoContato(admin, org, contato?.id ?? null);
      const acoes: AcaoDoAviso[] = [];
      if (contato) acoes.push({ rotulo: "Ligar de volta", href: LINKS.contato(contato.id) });
      if (conversaId) acoes.push({ rotulo: "Abrir conversa", href: LINKS.conversa(conversaId) });
      return {
        destinatarios: await responsavelOuEquipe(admin, org, [lead?.owner_user_id]),
        aviso: montar(
          "atendimento",
          item,
          contato ? `Ligação perdida: ${nomeComTelefone(pessoaDoContato(contato))}` : item.title,
          item.body ?? "Alguém ligou e ninguém atendeu.",
          acoes,
        ),
      };
    }

    case "case_stale":
    case "aviso_de_caso_nao_entregue": {
      const acoes =
        item.ref_kind === "agent_case" && item.ref_id
          ? [{ rotulo: "Abrir atendimento", href: LINKS.atendimento(item.ref_id) }]
          : [];
      return {
        destinatarios: await equipeQueDistribui(admin, org),
        aviso: montar("atendimento", item, item.title, item.body ?? "", acoes),
      };
    }

    case "proposta_pronta_para_revisao": {
      const { data: prop } = item.ref_id
        ? await admin
            .from("crm_proposals")
            .select("lead_id")
            .eq("organization_id", org)
            .eq("id", item.ref_id)
            .maybeSingle()
        : { data: null };
      const lead = await lerLead(
        admin,
        org,
        (prop as { lead_id?: string | null } | null)?.lead_id ?? null,
      );
      const acoes: AcaoDoAviso[] = [];
      if (item.ref_id)
        acoes.push({ rotulo: "Revisar proposta", href: LINKS.proposta(item.ref_id) });
      if (lead) acoes.push({ rotulo: "Abrir no CRM", href: LINKS.lead(lead.id) });
      return {
        destinatarios: await responsavelOuEquipe(admin, org, [lead?.owner_user_id]),
        aviso: montar(
          "crm",
          item,
          item.title,
          "A IA preparou a proposta. Confira os itens e os preços antes de enviar.",
          acoes,
        ),
      };
    }

    case "qr_rescan":
      return {
        destinatarios: await administradores(admin, org),
        aviso: montar(
          "sistema",
          item,
          item.title,
          "Nenhuma mensagem entra nem sai por este número até reconectar. Toque para escanear o QR.",
          [{ rotulo: "Reconectar WhatsApp", href: LINKS.conexoes }],
        ),
      };

    case "channel_number_alert":
    case "canal_mudo_sem_numero":
      // Só o que derruba o atendimento vai ao celular; "não consegui verificar" fica na Central.
      if (item.kind === "channel_number_alert" && item.severity !== "critical") return null;
      return {
        destinatarios: await administradores(admin, org),
        aviso: montar("sistema", item, item.title, item.body ?? "", [
          { rotulo: "Abrir Conexões", href: LINKS.conexoes },
        ]),
      };

    case "budget_exceeded":
      return {
        destinatarios: await administradores(admin, org),
        aviso: montar(
          "sistema",
          item,
          "O limite de gasto com IA foi atingido",
          "A IA parou de responder até o limite ser ajustado.",
          [{ rotulo: "Ver uso de IA", href: LINKS.usoDeIa }],
        ),
      };

    case "other": {
      // A IA sem saldo no provedor (`espera-de-saldo.ts`).
      if (item.ref_kind === "ai_provider_credential") {
        return {
          destinatarios: await administradores(admin, org),
          aviso: montar(
            "sistema",
            item,
            "A IA está sem saldo no provedor",
            "As respostas aos clientes estão esperando. Recarregue o saldo e elas saem sozinhas.",
            [{ rotulo: "Ver credenciais de IA", href: LINKS.credenciaisDeIa }],
          ),
        };
      }
      // Um negócio entrou numa etapa marcada "avisar" (migration 0440).
      if (ehAvisoDeEtapa(item) && item.ref_id) {
        const lead = await lerLead(admin, org, item.ref_id);
        if (!lead) return null;
        const { l } = await dadosDoLead(admin, org, lead);
        const acoes: AcaoDoAviso[] = [{ rotulo: "Abrir no CRM", href: LINKS.lead(lead.id) }];
        if (l.conversaId)
          acoes.push({ rotulo: "Abrir conversa", href: LINKS.conversa(l.conversaId) });
        return {
          destinatarios: await responsavelOuEquipe(admin, org, [lead.owner_user_id]),
          aviso: montar(
            "crm",
            item,
            l.etapa ? `${l.pessoa.nome} entrou em «${l.etapa}»` : `${l.pessoa.nome}: ${item.title}`,
            [l.pessoa.telefone !== l.pessoa.nome ? l.pessoa.telefone : "", l.funil ?? ""]
              .filter(Boolean)
              .join(" · "),
            acoes,
          ),
        };
      }
      return null;
    }

    default:
      return null;
  }
}
