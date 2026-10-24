/**
 * AS CONTAS DA PROSPECÇÃO ATIVA — puras (sem banco): a rota lê o CRM e entrega eventos; aqui eles
 * viram números. Tudo vem do que a equipe registrou no CRM:
 *  - lead captado = oportunidade nova no funil da campanha (a FONTE é a origem gravada nela);
 *  - abordagem = ligação, mensagem, e-mail ou disparo, cada um COM resultado;
 *  - contato = o resultado diz que a pessoa atendeu/respondeu; decisor = o resultado diz que era o decisor;
 *  - reunião agendada/feita = os compromissos da ficha; venda/faturamento = parcelas recebidas.
 */
export const TIPOS_DE_CONTATO = [
  "ligacao",
  "whatsapp_oficial",
  "whatsapp_nao_oficial",
  "email",
  "mensagem_manual",
] as const;
export type TipoDeContato = (typeof TIPOS_DE_CONTATO)[number];

export const ROTULO_DO_TIPO: Record<TipoDeContato, string> = {
  ligacao: "Ligação",
  whatsapp_oficial: "Disparo WhatsApp (API Oficial)",
  whatsapp_nao_oficial: "Disparo WhatsApp (API Não Oficial)",
  email: "E-mail",
  mensagem_manual: "Mensagem manual",
};

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * O que um resultado escrito diz. "Atendeu"/"Respondeu" é contato; "decisor" é decisor, a menos
 * que diga que NÃO era. "Não atendeu", "Sem resposta" e afins não são contato.
 */
export function classificarResultado(resultado: string | null | undefined): {
  contato: boolean;
  decisor: boolean;
} {
  const r = semAcento(resultado ?? "").trim();
  if (!r) return { contato: false, decisor: false };
  const contato = /^(atendeu|respondeu|falei|falou|conversou)/.test(r);
  const negado = /(nao (e|era|foi) (o )?decisor|nao decisor|sem decisor)/.test(r);
  return { contato, decisor: contato && /decisor/.test(r) && !negado };
}

/** Uma abordagem feita (ligação, mensagem, e-mail ou disparo), já com o resultado. */
export interface Interacao {
  dia: string;
  leadId: string;
  tipo: TipoDeContato;
  abordagemId: string | null;
  contato: boolean;
  decisor: boolean;
}
export interface ReuniaoDoLead {
  dia: string;
  leadId: string;
  tipo: "agendada" | "feita" | "faltou";
}
export interface LeadCaptado {
  id: string;
  dia: string;
  fonte: string;
  /** A extração (ou importação) de onde o lead veio — o id gravado na origem dele. */
  extracao?: string;
}
export interface VendaDoLead {
  leadId: string;
  /** O dia da 1ª parcela recebida. */
  dia: string;
}
export interface PagamentoDoLead {
  leadId: string;
  dia: string;
  valor: number;
}

/** Quanto custou captar leads de uma fonte, lançado à mão (extração, importação…). */
export interface CustoDeCaptacao {
  dia: string;
  fonte: string;
  valor: number;
  /** Quando o custo é de UMA extração: o id dela. */
  extracao?: string;
}

export const mesmaFonte = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

export interface BaseDaProspeccao {
  leads: readonly LeadCaptado[];
  interacoes: readonly Interacao[];
  reunioes: readonly ReuniaoDoLead[];
  vendas: readonly VendaDoLead[];
  pagamentos: readonly PagamentoDoLead[];
  /** Investimento (orçamento das campanhas) por dia. */
  investimentoPorDia: Readonly<Record<string, number>>;
  /** Custos de captação lançados por fonte. */
  custos: readonly CustoDeCaptacao[];
}

export interface BrutoDeProspeccao {
  leads: number;
  /** Quantidade de abordagens feitas (tentativas). */
  abordagens: number;
  leadsAbordados: number;
  contatos: number;
  decisores: number;
  reunioesAgendadas: number;
  reunioesFeitas: number;
  /** Compromissos em que o lead faltou. */
  noShows: number;
  vendas: number;
  investimento: number;
  recebido: number;
}

export const BRUTO_VAZIO: BrutoDeProspeccao = {
  leads: 0,
  abordagens: 0,
  leadsAbordados: 0,
  contatos: 0,
  decisores: 0,
  reunioesAgendadas: 0,
  reunioesFeitas: 0,
  noShows: 0,
  vendas: 0,
  investimento: 0,
  recebido: 0,
};

export type GrupoDaProspeccao = "dia" | "fonte" | "abordagem" | "tipo";

export interface Recorte {
  de: string;
  ate: string;
}
const dentro = (dia: string, r: Recorte) => dia >= r.de && dia <= r.ate;

/**
 * Soma os números de um recorte. Pessoas contam UMA vez (o mesmo lead abordado três vezes é um
 * lead abordado); abordagens contam cada tentativa. `fonteDe` diz de qual fonte é cada lead.
 */
export function agregarProspeccao(
  base: BaseDaProspeccao,
  recorte: Recorte,
  filtro: {
    fonte?: string;
    /** Só os leads (e custos) destas extrações/importações. */
    extracoes?: ReadonlySet<string>;
    abordagemId?: string | null;
    tipo?: TipoDeContato;
    dia?: string;
    /** `true` quando o filtro divide o custo de um jeito que não sabemos (fonte, abordagem, tipo). */
  } = {},
): BrutoDeProspeccao {
  const fonteDe = new Map(base.leads.map((l) => [l.id, l.fonte]));
  const extracaoDe = new Map(base.leads.map((l) => [l.id, l.extracao]));
  const okLead = (id: string) =>
    (filtro.fonte === undefined || mesmaFonte(fonteDe.get(id) ?? "", filtro.fonte)) &&
    (filtro.extracoes === undefined || filtro.extracoes.has(extracaoDe.get(id) ?? ""));
  const okDia = (d: string) => (filtro.dia ? d === filtro.dia : dentro(d, recorte));
  const abordados = new Set<string>();
  const contatados = new Set<string>();
  const decisores = new Set<string>();
  let abordagens = 0;
  for (const i of base.interacoes) {
    if (!okDia(i.dia) || !okLead(i.leadId)) continue;
    if (filtro.tipo !== undefined && i.tipo !== filtro.tipo) continue;
    if (filtro.abordagemId !== undefined && i.abordagemId !== filtro.abordagemId) continue;
    abordagens += 1;
    abordados.add(i.leadId);
    if (i.contato) contatados.add(i.leadId);
    if (i.decisor) decisores.add(i.leadId);
  }
  const agendadas = new Set<string>();
  const feitas = new Set<string>();
  const faltaram = new Set<string>();
  const semFiltroDeContato = filtro.tipo === undefined && filtro.abordagemId === undefined;
  if (semFiltroDeContato) {
    for (const r of base.reunioes) {
      if (!okDia(r.dia) || !okLead(r.leadId)) continue;
      (r.tipo === "agendada" ? agendadas : r.tipo === "faltou" ? faltaram : feitas).add(
        `${r.leadId}|${r.dia}`,
      );
    }
  }
  const leads = new Set<string>();
  if (semFiltroDeContato) {
    for (const l of base.leads) if (okDia(l.dia) && okLead(l.id)) leads.add(l.id);
  }
  const vendas = new Set<string>();
  let recebido = 0;
  if (semFiltroDeContato) {
    for (const v of base.vendas) if (okDia(v.dia) && okLead(v.leadId)) vendas.add(v.leadId);
    for (const p of base.pagamentos) if (okDia(p.dia) && okLead(p.leadId)) recebido += p.valor;
  }
  let investimento = 0;
  if (semFiltroDeContato) {
    // O orçamento da campanha não é de nenhuma fonte nem extração; o custo lançado é.
    if (filtro.fonte === undefined && filtro.extracoes === undefined) {
      for (const [d, v] of Object.entries(base.investimentoPorDia)) if (okDia(d)) investimento += v;
    }
    for (const c of base.custos) {
      if (
        okDia(c.dia) &&
        (filtro.fonte === undefined || mesmaFonte(c.fonte, filtro.fonte)) &&
        (filtro.extracoes === undefined || filtro.extracoes.has(c.extracao ?? ""))
      ) {
        investimento += c.valor;
      }
    }
  }
  return {
    leads: leads.size,
    abordagens,
    leadsAbordados: abordados.size,
    contatos: contatados.size,
    decisores: decisores.size,
    reunioesAgendadas: agendadas.size,
    reunioesFeitas: feitas.size,
    noShows: faltaram.size,
    vendas: vendas.size,
    investimento: Math.round(investimento * 100) / 100,
    recebido: Math.round(recebido * 100) / 100,
  };
}

export interface DerivadasDeProspeccao extends BrutoDeProspeccao {
  cpl: number | null;
  custoPorAbordagem: number | null;
  /** Leads abordados ÷ leads captados, em %. */
  taxaDeAbordados: number | null;
  custoPorContato: number | null;
  /** Contatos ÷ leads abordados, em %. */
  taxaDeResposta: number | null;
  custoPorDecisor: number | null;
  /** Decisores ÷ contatos, em %. */
  taxaDeDecisor: number | null;
  custoPorReuniaoAgendada: number | null;
  /** Reuniões agendadas ÷ decisores, em %. */
  taxaDeAgendamento: number | null;
  custoPorReuniaoFeita: number | null;
  /** Reuniões feitas ÷ agendadas, em %. */
  taxaDeComparecimento: number | null;
  /** No-shows ÷ reuniões agendadas, em %. */
  taxaDeNoShow: number | null;
  cac: number | null;
  /** Vendas ÷ reuniões feitas, em %. */
  taxaDeConversao: number | null;
  lucro: number;
  roas: number | null;
}

const razao = (a: number, b: number): number | null => (b > 0 ? a / b : null);

/** `semCusto`: a linha não tem investimento próprio (fonte, abordagem): custos e ROAS ficam em branco. */
export function derivarProspeccao(b: BrutoDeProspeccao, semCusto = false): DerivadasDeProspeccao {
  const c = (v: number | null) => (semCusto ? null : v);
  return {
    ...b,
    cpl: c(razao(b.investimento, b.leads)),
    custoPorAbordagem: c(razao(b.investimento, b.abordagens)),
    taxaDeAbordados: razao(b.leadsAbordados * 100, b.leads),
    custoPorContato: c(razao(b.investimento, b.contatos)),
    taxaDeResposta: razao(b.contatos * 100, b.leadsAbordados),
    custoPorDecisor: c(razao(b.investimento, b.decisores)),
    taxaDeDecisor: razao(b.decisores * 100, b.contatos),
    custoPorReuniaoAgendada: c(razao(b.investimento, b.reunioesAgendadas)),
    taxaDeAgendamento: razao(b.reunioesAgendadas * 100, b.decisores),
    custoPorReuniaoFeita: c(razao(b.investimento, b.reunioesFeitas)),
    taxaDeComparecimento: razao(b.reunioesFeitas * 100, b.reunioesAgendadas),
    taxaDeNoShow: razao(b.noShows * 100, b.reunioesAgendadas),
    cac: c(razao(b.investimento, b.vendas)),
    taxaDeConversao: razao(b.vendas * 100, b.reunioesFeitas),
    lucro: b.recebido - (semCusto ? 0 : b.investimento),
    roas: c(razao(b.recebido, b.investimento)),
  };
}

/** Os dias do recorte, em ordem. */
export function diasDoRecorte(r: Recorte, limite = 400): string[] {
  const dias: string[] = [];
  for (
    let d = r.de;
    d <= r.ate && dias.length < limite;
    d = new Date(Date.parse(`${d}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  ) {
    dias.push(d);
  }
  return dias;
}

/** O período anterior, do mesmo tamanho, terminando na véspera. */
export function recorteAnterior(r: Recorte): Recorte {
  const n = diasDoRecorte(r).length;
  const soma = (d: string, k: number) =>
    new Date(Date.parse(`${d}T12:00:00Z`) + k * 86_400_000).toISOString().slice(0, 10);
  return { de: soma(r.de, -n), ate: soma(r.de, -1) };
}

/** O que o painel sabe de cada extração ou importação da campanha. */
export interface ExtracaoDoPainel {
  id: string;
  nome: string;
  tipo: "extracao" | "importacao";
  /** O segmento buscado (só extração). */
  termo: string | null;
  /** A cidade ou região buscada (só extração). */
  cidade: string | null;
  /** `volume` ou `completo` (só extração). */
  modo: "completo" | "volume" | null;
}

export interface GrupoDeExtracoes {
  /** A chave estável do grupo (minúscula, para juntar "Clínicas" e "clínicas"). */
  chave: string;
  /** Como o grupo aparece na tela. */
  nome: string;
  ids: ReadonlySet<string>;
}

/**
 * Agrupa as extrações para o painel: cada uma sozinha (`extracao`), pelo termo buscado (`termo`)
 * ou pela cidade (`cidade`). Importação não tem termo nem cidade, então só aparece no primeiro.
 * É por aqui que se vê qual termo ou cidade rende mais: cada grupo é medido com `agregarProspeccao`
 * e o filtro `extracoes`, que soma só os leads e os custos daquele conjunto.
 */
export function agruparExtracoes(
  extracoes: readonly ExtracaoDoPainel[],
  por: "extracao" | "termo" | "cidade",
): GrupoDeExtracoes[] {
  const grupos = new Map<string, { nome: string; ids: Set<string> }>();
  for (const e of extracoes) {
    const nome = por === "extracao" ? e.nome : por === "termo" ? e.termo : e.cidade;
    if (!nome?.trim()) continue;
    const chave = por === "extracao" ? e.id : nome.trim().toLowerCase();
    const atual = grupos.get(chave);
    if (atual) atual.ids.add(e.id);
    else grupos.set(chave, { nome: nome.trim(), ids: new Set([e.id]) });
  }
  return [...grupos.entries()]
    .map(([chave, g]) => ({ chave, nome: g.nome, ids: g.ids }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
