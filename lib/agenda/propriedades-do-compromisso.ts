/**
 * As PROPRIEDADES que a pessoa pode escolher mostrar sob cada compromisso do calendário da
 * Agenda (como as propriedades do calendário das Tarefas). O título e a hora de início aparecem
 * sempre; o resto é escolha, guardada neste navegador.
 *
 * `detalhe: true` = o dado não vem na lista da grade e é buscado em `/api/v1/agenda/detalhes`
 * só para os compromissos do dia aberto.
 */
export const PROPRIEDADES_DO_COMPROMISSO = [
  { id: "data", rotulo: "Data", detalhe: false },
  { id: "horario", rotulo: "Horário e duração", detalhe: false },
  { id: "status", rotulo: "Status", detalhe: false },
  { id: "tipo", rotulo: "Tipo de compromisso", detalhe: true },
  { id: "categoria", rotulo: "Categoria do tipo", detalhe: true },
  { id: "responsavel", rotulo: "Responsável", detalhe: false },
  { id: "observacoes", rotulo: "Observações internas", detalhe: true },
  { id: "link_reuniao", rotulo: "Link da reunião", detalhe: true },
  { id: "tipo_de_local", rotulo: "Tipo de local", detalhe: true },
  { id: "local", rotulo: "Local ou endereço", detalhe: true },
  { id: "status_do_link", rotulo: "Status do link", detalhe: true },
  { id: "cliente", rotulo: "Nome do cliente", detalhe: false },
  { id: "ligar", rotulo: "Ligar para o cliente", detalhe: true },
  { id: "email", rotulo: "E-mail do cliente", detalhe: true },
  { id: "conversa", rotulo: "Abrir a conversa no Inbox", detalhe: true },
  { id: "funil", rotulo: "Funil", detalhe: true },
  { id: "status_do_funil", rotulo: "Status do funil", detalhe: true },
  { id: "status_da_venda", rotulo: "Status da venda", detalhe: true },
  { id: "valor", rotulo: "Valor da oportunidade", detalhe: true },
  { id: "resultado", rotulo: "Resultado registrado", detalhe: true },
  { id: "cancelamento", rotulo: "Cancelamento", detalhe: true },
  { id: "remarcado_de", rotulo: "Remarcado de outro horário", detalhe: true },
  { id: "lembrete", rotulo: "Lembrete enviado", detalhe: true },
  { id: "google", rotulo: "Sincronização com o Google", detalhe: true },
] as const;

export type IdDePropriedade = (typeof PROPRIEDADES_DO_COMPROMISSO)[number]["id"];

/** O que aparece antes de a pessoa escolher: tudo isto já vem na lista, sem busca extra. */
export const PROPRIEDADES_PADRAO: readonly IdDePropriedade[] = ["horario", "cliente", "status"];

const IDS = new Set<string>(PROPRIEDADES_DO_COMPROMISSO.map((p) => p.id));

/** Lê a escolha guardada, descartando o que não existe mais (id velho não quebra a tela). */
export function propriedadesValidas(bruto: unknown): IdDePropriedade[] {
  if (!Array.isArray(bruto)) return [...PROPRIEDADES_PADRAO];
  return bruto.filter((x): x is IdDePropriedade => typeof x === "string" && IDS.has(x));
}

export function precisaDeDetalhe(escolhidas: readonly string[]): boolean {
  return PROPRIEDADES_DO_COMPROMISSO.some((p) => p.detalhe && escolhidas.includes(p.id));
}

/** Os tipos de local do banco, como a pessoa os lê. */
export const ROTULO_DO_LOCAL: Record<string, string> = {
  in_person: "Presencial",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  video_link: "Videochamada",
  google_meet: "Google Meet",
};

export const ROTULO_DA_CATEGORIA: Record<string, string> = {
  consulta: "Consulta",
  procedimento: "Procedimento",
  retorno: "Retorno",
  visita: "Visita",
  vistoria: "Vistoria",
  reuniao: "Reunião",
  call: "Call",
  orcamento: "Orçamento",
  demonstracao: "Demonstração",
  outro: "Outro",
};

export const ROTULO_DO_LINK: Record<string, string> = {
  not_requested: "Sem link",
  pending: "Gerando",
  ready: "Pronto",
  failed: "Falhou",
  cancelled: "Cancelado",
};

/** Os status da venda (`crm_sales.status`) nas palavras do produto. */
export const ROTULO_DA_VENDA_NA_AGENDA: Record<string, string> = {
  interesse: "Em interesse",
  comprometida: "Comprometida",
  concluida: "Paga",
  cancelada: "Não comprou",
};

export interface DetalheDoCompromisso {
  id: string;
  tipo: { nome: string; cor: string | null; categoria: string } | null;
  observacoes: string | null;
  link_reuniao: string | null;
  status_do_link: string | null;
  tipo_de_local: string | null;
  local: string | null;
  telefone: string | null;
  email: string | null;
  conversa_id: string | null;
  funil: string | null;
  etapa: string | null;
  venda: { status: string; valor_cents: number; moeda: string } | null;
  resultado_registrado_em: string | null;
  cancelado_em: string | null;
  motivo_do_cancelamento: string | null;
  remarcado_de: string | null;
  lembrete_enviado_em: string | null;
  google_sincronizado_em: string | null;
  google_erro: string | null;
}
