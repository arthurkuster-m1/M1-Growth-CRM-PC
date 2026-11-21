/**
 * O TEXTO E OS BOTÕES DE CADA NOTIFICAÇÃO — num lugar só.
 *
 * Toda notificação do produto (push no celular e aviso na tela) nasce de um `AvisoPessoal`
 * montado aqui. As regras de escrita:
 *
 *   1. Diz DE QUEM é: nome da pessoa (e o telefone quando ajuda a reconhecer).
 *   2. Diz O QUE aconteceu numa frase curta.
 *   3. Tem SEMPRE pelo menos um botão que leva ao lugar onde se resolve — a conversa, a
 *      oportunidade no CRM, a tela de conexões. O primeiro botão é também o destino do toque
 *      na notificação inteira.
 *
 * Módulo puro (sem banco): quem lê o banco é `montar-avisos.ts`.
 */
import type { PushPayload } from "./push_payload";

/** Vocabulário fechado — o mesmo do CHECK de `notificacoes.categoria` (migration 0697). */
export const CATEGORIAS_DE_NOTIFICACAO = [
  "mensagem",
  "lead_novo",
  "lead_atribuido",
  "mencao",
  "tarefa",
  "atendimento",
  "crm",
  "sistema",
] as const;
export type CategoriaDeNotificacao = (typeof CATEGORIAS_DE_NOTIFICACAO)[number];

export interface AcaoDoAviso {
  rotulo: string;
  href: string;
}

export interface AvisoPessoal {
  categoria: CategoriaDeNotificacao;
  titulo: string;
  corpo: string;
  /** 1 ou 2 botões. O primeiro é o destino do toque na notificação. */
  acoes: AcaoDoAviso[];
  /** Notificações com a mesma marca se substituem no celular (ex.: a mesma conversa). */
  tag: string;
  /** Foto do contato, quando houver (só no push). */
  icone?: string;
}

/** Os destinos. Um link só por coisa, para todo aviso levar ao mesmo lugar. */
export const LINKS = {
  conversa: (id: string) => `/app/inbox?id=${id}`,
  /** URL estável do lead: resolve o funil na hora e abre o card (`app/app/leads/[id]`). */
  lead: (id: string) => `/app/leads/${id}`,
  contato: (id: string) => `/app/contacts/${id}`,
  proposta: (id: string) => `/app/proposals/${id}`,
  atendimento: (id: string) => `/app/ai/cases?caso=${id}`,
  inbox: "/app/inbox",
  tarefas: "/app/tarefas",
  faturas: "/app/financas/faturas",
  conexoes: "/app/connections",
  credenciaisDeIa: "/app/ai/credentials",
  usoDeIa: "/app/ai/usage",
  central: "/app/ai/inbox",
} as const;

export const TITULO_MAXIMO = 120;
export const CORPO_MAXIMO = 240;

export function limitar(texto: string, maximo: number): string {
  const t = texto.trim().replace(/\s+/g, " ");
  if (t.length <= maximo) return t;
  return `${t.slice(0, maximo - 1)}…`;
}

/** Quem é a pessoa do aviso: o rótulo (nome ou telefone) e o telefone já formatado. */
export interface PessoaDoAviso {
  /** Nome legível; quando não há nome, o próprio telefone. Nunca vazio. */
  nome: string;
  /** Telefone formatado, ou "" quando não há. */
  telefone: string;
}

/** "Maria Souza · (11) 98888-7777" — sem repetir o telefone quando ele já é o nome. */
export function nomeComTelefone(p: PessoaDoAviso): string {
  if (!p.telefone || p.telefone === p.nome) return p.nome;
  return `${p.nome} · ${p.telefone}`;
}

function juntar(...partes: Array<string | null | undefined>): string {
  return partes
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

function acoesDoLead(input: {
  conversaId: string | null;
  leadId: string | null;
  contatoId: string | null;
}): AcaoDoAviso[] {
  const acoes: AcaoDoAviso[] = [];
  if (input.conversaId)
    acoes.push({ rotulo: "Abrir conversa", href: LINKS.conversa(input.conversaId) });
  if (input.leadId) acoes.push({ rotulo: "Abrir no CRM", href: LINKS.lead(input.leadId) });
  if (acoes.length < 2 && input.contatoId)
    acoes.push({ rotulo: "Ver contato", href: LINKS.contato(input.contatoId) });
  return acoes.slice(0, 2);
}

function fechar(aviso: AvisoPessoal): AvisoPessoal {
  return {
    ...aviso,
    titulo: limitar(aviso.titulo, TITULO_MAXIMO) || "Notificação",
    corpo: limitar(aviso.corpo, CORPO_MAXIMO),
    acoes:
      aviso.acoes.length > 0
        ? aviso.acoes.slice(0, 2)
        : [{ rotulo: "Abrir a Central", href: LINKS.central }],
  };
}

// ── Mensagens ────────────────────────────────────────────────────────────────

export function avisoDeMensagem(input: {
  pessoa: PessoaDoAviso;
  preview: string;
  midia: boolean;
  conversaId: string;
  leadId: string | null;
  /** O lead nasceu há pouco (desta conversa): o título anuncia o lead novo. */
  leadNovo: boolean;
  icone?: string | null;
}): AvisoPessoal {
  const texto = input.midia
    ? "Enviou uma foto, áudio ou arquivo"
    : input.preview.trim() || "Nova mensagem";
  const acoes: AcaoDoAviso[] = [{ rotulo: "Responder", href: LINKS.conversa(input.conversaId) }];
  if (input.leadId) acoes.push({ rotulo: "Abrir no CRM", href: LINKS.lead(input.leadId) });
  return fechar({
    categoria: "mensagem",
    titulo: input.leadNovo ? `Novo lead: ${nomeComTelefone(input.pessoa)}` : input.pessoa.nome,
    corpo: texto,
    acoes,
    tag: `conversa:${input.conversaId}`,
    icone: input.icone ?? undefined,
  });
}

export function avisoDeMensagemDeGrupo(input: {
  grupo: string | null;
  preview: string;
  midia: boolean;
  conversaId: string;
}): AvisoPessoal {
  const texto = input.midia
    ? "Enviou uma foto, áudio ou arquivo"
    : input.preview.trim() || "Nova mensagem";
  return fechar({
    categoria: "mensagem",
    titulo: input.grupo ? `Grupo ${input.grupo}` : "Nova mensagem no grupo",
    corpo: texto,
    acoes: [{ rotulo: "Abrir conversa", href: LINKS.conversa(input.conversaId) }],
    tag: `conversa:${input.conversaId}`,
  });
}

// ── Leads ────────────────────────────────────────────────────────────────────

export interface LeadDoAviso {
  pessoa: PessoaDoAviso;
  leadId: string;
  contatoId: string | null;
  conversaId: string | null;
  funil: string | null;
  etapa: string | null;
  origem: string | null;
}

function ondeEsta(l: LeadDoAviso): string {
  if (l.funil && l.etapa) return `${l.funil} › ${l.etapa}`;
  return l.funil ?? l.etapa ?? "";
}

export function avisoDeLeadNovo(l: LeadDoAviso): AvisoPessoal {
  return fechar({
    categoria: "lead_novo",
    titulo: `Novo lead: ${l.pessoa.nome}`,
    corpo: juntar(
      l.pessoa.telefone !== l.pessoa.nome ? l.pessoa.telefone : "",
      ondeEsta(l),
      l.origem ? `Origem: ${l.origem}` : "",
    ),
    acoes: acoesDoLead(l),
    // Mesma marca da conversa quando há uma: o "novo lead" e a primeira mensagem não viram dois.
    tag: l.conversaId ? `conversa:${l.conversaId}` : `lead:${l.leadId}`,
  });
}

export function avisoDeLeadAtribuido(l: LeadDoAviso): AvisoPessoal {
  return fechar({
    categoria: "lead_atribuido",
    titulo: `Lead atribuído a você: ${l.pessoa.nome}`,
    corpo: juntar(l.pessoa.telefone !== l.pessoa.nome ? l.pessoa.telefone : "", ondeEsta(l)),
    acoes: acoesDoLead(l),
    tag: `lead:${l.leadId}`,
  });
}

// ── Menção e tarefa ──────────────────────────────────────────────────────────

export function avisoDeMencao(input: {
  quem: string | null;
  pessoa: PessoaDoAviso | null;
  preview: string;
  conversaId: string | null;
}): AvisoPessoal {
  const titulo = input.quem ? `${input.quem} mencionou você` : "Você foi mencionado";
  return fechar({
    categoria: "mencao",
    titulo: input.pessoa ? `${titulo} · ${input.pessoa.nome}` : titulo,
    corpo: input.preview || "Abra a conversa para ver a nota.",
    acoes: [
      input.conversaId
        ? { rotulo: "Abrir conversa", href: LINKS.conversa(input.conversaId) }
        : { rotulo: "Abrir o Inbox", href: LINKS.inbox },
    ],
    tag: input.conversaId ? `mencao:${input.conversaId}` : "mencao",
  });
}

export function avisoDeTarefa(input: {
  titulo: string;
  tarefaId: string;
  pessoa: PessoaDoAviso | null;
  leadId: string | null;
}): AvisoPessoal {
  const acoes: AcaoDoAviso[] = [{ rotulo: "Abrir tarefas", href: LINKS.tarefas }];
  if (input.leadId) acoes.push({ rotulo: "Abrir no CRM", href: LINKS.lead(input.leadId) });
  return fechar({
    categoria: "tarefa",
    titulo: `Nova tarefa para você: ${input.titulo}`,
    corpo: input.pessoa ? `Cliente: ${nomeComTelefone(input.pessoa)}` : "",
    acoes,
    tag: `tarefa:${input.tarefaId}`,
  });
}

/** A cobrança da Meta no cartão foi recusada: sem pagamento, os anúncios podem parar. */
export function avisoDeCobrancaRecusada(input: {
  /** Chave estável da cobrança (a mesma notificação não se repete no celular). */
  chave: string;
  /** "10/11" — o dia da tentativa. */
  dia: string;
  /** "R$ 1.234,56" ou null quando a plataforma não informou o valor. */
  valor: string | null;
}): AvisoPessoal {
  return fechar({
    categoria: "sistema",
    titulo: "Cobrança da Meta recusada",
    corpo:
      `A cobrança de ${input.dia}${input.valor ? ` (${input.valor})` : ""} não passou no cartão. ` +
      "Atualize a forma de pagamento no Meta para os anúncios não pararem.",
    acoes: [{ rotulo: "Ver faturas", href: LINKS.faturas }],
    tag: `fin-meta-recusada:${input.chave}`,
  });
}

/** A conta de anúncio está com pagamento pendente (situação 3 da plataforma). */
export function avisoDeContaComPagamentoPendente(): AvisoPessoal {
  return fechar({
    categoria: "sistema",
    titulo: "Conta de anúncios da Meta com pagamento pendente",
    corpo:
      "A Meta não conseguiu cobrar o cartão. Regularize o pagamento para os anúncios voltarem.",
    acoes: [{ rotulo: "Ver faturas", href: LINKS.faturas }],
    tag: "fin-meta-pagamento-pendente",
  });
}

// ── Saída para o push ───────────────────────────────────────────────────────

/** O mesmo aviso, no formato que o service worker do celular desenha. */
export function paraPush(aviso: AvisoPessoal): PushPayload {
  return {
    title: aviso.titulo,
    body: aviso.corpo,
    tag: aviso.tag,
    href: aviso.acoes[0]?.href ?? LINKS.central,
    acoes: aviso.acoes.slice(0, 2),
    ...(aviso.icone ? { icon: aviso.icone } : {}),
  };
}
