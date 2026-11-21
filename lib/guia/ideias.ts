/**
 * O MOTOR DE IDEIAS — funções PURAS: os números das campanhas e o diagnóstico viram sugestões do
 * que fazer (docs/MAPA-DO-PROCESSO-M1.md §4). Sem banco, sem IA, sem relógio global.
 *
 * Cada ideia traz a EVIDÊNCIA (os números que a fizeram disparar) e uma ação. O motor só SUGERE:
 * quem aceita, dispensa ou dá o veredito é uma pessoa. As ideias de regra R05 (no-show) e R08
 * (qualidade do lead) ainda não existem: o sistema não mede esses dois dados. R09 (orçamento) já
 * vive em "O que fazer agora" da campanha e não é repetida aqui.
 */
import type { Diagnostico } from "./tipos";

/** Limiares iniciais (chute calibrável — ver o mapa §4). Aparecem na tela, só para leitura. */
export const LIMIARES = {
  /** R01: custo por lead acima da meta em tantas vezes. */
  cplAcimaDaMeta: 1.3,
  /** R01/R02/R11: o mínimo de leads/impressões para a regra valer (evita falso alarme com pouco dado). */
  leadsMinimosParaCpl: 5,
  ctrMinimo: 0.008,
  impressoesMinimasParaCtr: 5000,
  /** R03: impressões por pessoa alcançada. */
  frequenciaMaxima: 3,
  /** R04: agendamentos por lead (últimos 30 dias, com pelo menos `amostraDeLeads`). */
  agendamentoMinimo: 0.15,
  amostraDeLeads: 20,
  /** R06: vendas por reunião feita (com pelo menos `amostraDeReunioes`). */
  vendaMinima: 0.15,
  amostraDeReunioes: 8,
  /** R07: gasto mínimo (R$) em 14 dias sem venda registrada, com pelo menos `leadsParaSemVenda` leads. */
  gastoSemVenda: 100,
  leadsParaSemVenda: 10,
  /** R10: até quantos dias depois do fim a campanha ainda pede o registro do aprendizado. */
  diasParaAprender: 30,
  /** Dias até medir de novo uma ideia aceita. */
  diasParaMedir: 14,
  /** No máximo, ideias abertas (novas + aceitas) por empresa. */
  maximoDeAbertas: 5,
} as const;

export const REGRAS_DE_IDEIA = [
  { id: "R01", nome: "Custo por lead acima da meta" },
  { id: "R02", nome: "Clique baixo para a quantidade de gente que viu" },
  { id: "R03", nome: "Frequência alta (o público já cansou)" },
  { id: "R04", nome: "Muitos leads e poucos agendamentos" },
  { id: "R06", nome: "Reuniões acontecem, mas poucas viram venda" },
  { id: "R07", nome: "Verba gasta e nenhuma venda registrada" },
  { id: "R10", nome: "Campanha encerrada sem aprendizado registrado" },
  { id: "R11", nome: "Gasto sem nenhum lead" },
  { id: "R12", nome: "Análise de concorrência vencida" },
] as const;

export interface CampanhaParaIdeias {
  id: string;
  nome: string;
  status: string;
  /** YYYY-MM-DD */
  fim: string | null;
  metaCpl: number | null;
  /** Últimos 7 dias lançados. */
  semana: { gasto: number; leads: number; impressoes: number; alcance: number; cliques: number };
  /** Gasto dos últimos 14 dias e vendas registradas nesse período. */
  gasto14: number;
  vendas14: number;
  /** O funil dos últimos 30 dias (leads → agendamentos → reuniões → vendas), se calculado. */
  coorte30: { leads: number; agendados: number; feitas: number; vendas: number } | null;
  /** Dias desde o fim (0 = terminou hoje), ou nulo se não terminou. */
  diasDesdeOFim: number | null;
  temAprendizado: boolean;
}

export interface IdeiaCandidata {
  regra: string;
  alvoTipo: "campanha" | "passo" | "geral";
  alvoId: string;
  /** A janela em que a regra vale; a mesma ideia não volta dentro dela. */
  janela: string;
  titulo: string;
  /** Os números, em frases curtas. */
  evidencia: string[];
  passoRelacionado: string | null;
  acaoHref: string;
  /** 1 = alta · 2 = média · 3 = baixa. */
  prioridade: 1 | 2 | 3;
}

const CAMPANHAS = "/app/marketing/geracao-de-demanda";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const pct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;
const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

/** A quinzena de uma data (YYYY-MM-Q1 ou Q2): é a janela de silêncio das regras de número. */
export function quinzenaDe(agora: Date): string {
  const d = agora.toISOString();
  return `${d.slice(0, 7)}-Q${Number(d.slice(8, 10)) <= 15 ? 1 : 2}`;
}

/** O semestre de uma data (YYYY-S1 ou S2): é a janela da regra de concorrência. */
export function semestreDe(agora: Date): string {
  const d = agora.toISOString();
  return `${d.slice(0, 4)}-S${Number(d.slice(5, 7)) <= 6 ? 1 : 2}`;
}

export function avaliarRegras(e: {
  campanhas: readonly CampanhaParaIdeias[];
  diagnostico: Diagnostico;
  agora: Date;
  limiares?: typeof LIMIARES;
}): IdeiaCandidata[] {
  const L = e.limiares ?? LIMIARES;
  const janela = quinzenaDe(e.agora);
  const saida: IdeiaCandidata[] = [];
  const nova = (
    i: Omit<IdeiaCandidata, "alvoTipo" | "acaoHref"> & {
      acaoHref?: string;
      alvoTipo?: IdeiaCandidata["alvoTipo"];
    },
  ) => saida.push({ alvoTipo: "campanha", acaoHref: CAMPANHAS, ...i });

  const ativas = e.campanhas.filter((c) => c.status === "ativa");
  for (const c of ativas) {
    const s = c.semana;

    // R11 — gasto e nenhum lead: algo quebrou (LP, formulário, conexão) antes de qualquer otimização.
    if (s.gasto > 0 && s.leads === 0) {
      nova({
        regra: "R11",
        alvoId: c.id,
        janela,
        titulo: `Gasto sem nenhum lead em «${c.nome}»`,
        evidencia: [`Últimos 7 dias: ${brl(s.gasto)} gastos e 0 leads.`],
        passoRelacionado: "P33",
        acaoHref: "/app/connections",
        prioridade: 1,
      });
      continue; // sem lead, as regras de custo e clique não dizem nada útil
    }

    // R01 — custo por lead acima da meta.
    if (c.metaCpl && c.metaCpl > 0 && s.leads >= L.leadsMinimosParaCpl) {
      const cpl = s.gasto / s.leads;
      const razao = cpl / c.metaCpl;
      if (razao >= L.cplAcimaDaMeta) {
        nova({
          regra: "R01",
          alvoId: c.id,
          janela,
          titulo: `Custo por lead acima da meta em «${c.nome}»`,
          evidencia: [
            `Custo por lead dos últimos 7 dias: ${brl(cpl)} (meta ${brl(c.metaCpl)}, ${pct(razao - 1)} acima).`,
            `${brl(s.gasto)} gastos e ${plural(s.leads, "lead", "leads")} na semana.`,
          ],
          passoRelacionado: "P51",
          prioridade: razao >= 1.6 ? 1 : 2,
        });
      }
    }

    // R02 — clique baixo.
    if (s.impressoes >= L.impressoesMinimasParaCtr) {
      const ctr = s.cliques / s.impressoes;
      if (ctr < L.ctrMinimo) {
        nova({
          regra: "R02",
          alvoId: c.id,
          janela,
          titulo: `Poucos cliques em «${c.nome}»: troque o gancho do criativo`,
          evidencia: [
            `Taxa de clique dos últimos 7 dias: ${pct(ctr)} (esperado ao menos ${pct(L.ctrMinimo)}).`,
            `${s.impressoes.toLocaleString("pt-BR")} impressões e ${s.cliques.toLocaleString("pt-BR")} cliques no link.`,
          ],
          passoRelacionado: "P51",
          prioridade: 2,
        });
      }
    }

    // R03 — frequência alta. O alcance somado por dia só pode ser MAIOR que o real: a frequência
    // verdadeira é igual ou maior que esta, então a regra não dispara por engano.
    if (s.alcance > 0 && s.impressoes / s.alcance > L.frequenciaMaxima) {
      const f = s.impressoes / s.alcance;
      nova({
        regra: "R03",
        alvoId: c.id,
        janela,
        titulo: `O público de «${c.nome}» já viu o anúncio demais: renove os criativos`,
        evidencia: [
          `Cada pessoa viu o anúncio ${f.toFixed(1).replace(".", ",")} vezes em média na semana (o limite é ${L.frequenciaMaxima}).`,
        ],
        passoRelacionado: "P51",
        prioridade: 2,
      });
    }

    // R07 — verba gasta e nenhuma venda registrada: costuma ser venda que não foi lançada, ou CAPI.
    if (
      c.gasto14 >= L.gastoSemVenda &&
      c.vendas14 === 0 &&
      (c.coorte30?.leads ?? 0) >= L.leadsParaSemVenda
    ) {
      nova({
        regra: "R07",
        alvoId: c.id,
        janela,
        titulo: `Verba gasta em «${c.nome}» e nenhuma venda registrada`,
        evidencia: [
          `Últimos 14 dias: ${brl(c.gasto14)} gastos e 0 vendas registradas no CRM.`,
          `Pode ser venda não lançada ou o retorno à Meta (CAPI) parado: confira antes de mexer na campanha.`,
        ],
        passoRelacionado: "P47",
        acaoHref: "/app/clientes",
        prioridade: 2,
      });
    }

    // R04 / R06 — o funil depois do lead (só com amostra que sustente a conclusão).
    const f = c.coorte30;
    const vendeAgendando =
      e.diagnostico.passos.find((p) => p.id === "P42")?.estado !== "nao_se_aplica";
    if (
      f &&
      vendeAgendando &&
      f.leads >= L.amostraDeLeads &&
      f.agendados / f.leads < L.agendamentoMinimo
    ) {
      nova({
        regra: "R04",
        alvoId: c.id,
        janela,
        titulo: `Muitos leads e poucos agendamentos em «${c.nome}»`,
        evidencia: [
          `Últimos 30 dias: ${plural(f.leads, "lead", "leads")} e ${plural(f.agendados, "agendamento", "agendamentos")} (${pct(f.agendados / f.leads)}; o esperado é ao menos ${pct(L.agendamentoMinimo)}).`,
          "Veja a velocidade da primeira resposta e a abordagem.",
        ],
        passoRelacionado: "P46",
        acaoHref: "/app/automacoes",
        prioridade: 2,
      });
    }
    if (f && f.feitas >= L.amostraDeReunioes && f.vendas / f.feitas < L.vendaMinima) {
      nova({
        regra: "R06",
        alvoId: c.id,
        janela,
        titulo: `As reuniões de «${c.nome}» acontecem, mas poucas viram venda`,
        evidencia: [
          `Últimos 30 dias: ${plural(f.feitas, "reunião feita", "reuniões feitas")} e ${plural(f.vendas, "venda", "vendas")} (${pct(f.vendas / f.feitas)}; o esperado é ao menos ${pct(L.vendaMinima)}).`,
          "Revise a oferta, o processo comercial e como a concorrência vende.",
        ],
        passoRelacionado: "P24",
        acaoHref: "/app/marketing/estrategia/produtos-e-ofertas",
        prioridade: 2,
      });
    }
  }

  // R10 — campanha que acabou e ninguém registrou o que aprendeu (janela única por campanha).
  for (const c of e.campanhas) {
    if (
      c.status === "encerrada" &&
      !c.temAprendizado &&
      c.diasDesdeOFim !== null &&
      c.diasDesdeOFim <= L.diasParaAprender
    ) {
      nova({
        regra: "R10",
        alvoId: c.id,
        janela: "unica",
        titulo: `Registre o que funcionou e o que não funcionou em «${c.nome}»`,
        evidencia: [
          `A campanha terminou há ${plural(c.diasDesdeOFim, "dia", "dias")} e não há aprendizado registrado.`,
        ],
        passoRelacionado: "P74",
        acaoHref: "/app/guia",
        prioridade: 3,
      });
    }
  }

  // R12 — concorrência vencida (o prazo do passo P22 já é o de 6 meses).
  const p22 = e.diagnostico.passos.find((p) => p.id === "P22");
  if (p22?.estado === "desatualizado") {
    saida.push({
      regra: "R12",
      alvoTipo: "passo",
      alvoId: "P22",
      janela: semestreDe(e.agora),
      titulo: "Refaça a análise de concorrência",
      evidencia: [p22.evidencia],
      passoRelacionado: "P22",
      acaoHref: p22.onde.href,
      prioridade: 3,
    });
  }

  return saida;
}

/** Decide quais candidatas entram, respeitando o teto de ideias abertas e o que já existe. */
export function escolherNovas(
  candidatas: readonly IdeiaCandidata[],
  jaExistem: ReadonlySet<string>,
  abertas: number,
  maximo: number = LIMIARES.maximoDeAbertas,
): IdeiaCandidata[] {
  const vagas = Math.max(0, maximo - abertas);
  return candidatas
    .filter((c) => !jaExistem.has(chaveDaIdeia(c)))
    .sort((a, b) => a.prioridade - b.prioridade)
    .slice(0, vagas);
}

/** Identifica a ideia para não repetir: regra + alvo + janela (a mesma da unicidade no banco). */
export const chaveDaIdeia = (c: Pick<IdeiaCandidata, "regra" | "alvoId" | "janela">) =>
  `${c.regra}|${c.alvoId}|${c.janela}`;

/** A foto dos números de uma campanha (para o antes × depois). */
export interface FotoDaCampanha {
  cpl: number | null;
  ctr: number | null;
  frequencia: number | null;
  leads7: number;
  gasto7: number;
}

export function fotoDaCampanha(c: Pick<CampanhaParaIdeias, "semana">): FotoDaCampanha {
  const s = c.semana;
  return {
    cpl: s.leads > 0 ? s.gasto / s.leads : null,
    ctr: s.impressoes > 0 ? s.cliques / s.impressoes : null,
    frequencia: s.alcance > 0 ? s.impressoes / s.alcance : null,
    leads7: s.leads,
    gasto7: s.gasto,
  };
}

export type VereditoSugerido = "funcionou" | "nao_funcionou" | "inconclusivo";

export interface ComparacaoAntesDepois {
  /** O que a pessoa lê: antes → depois. */
  linhas: string[];
  /** Só uma SUGESTÃO; o veredito é de quem acompanha o projeto. */
  sugestao: VereditoSugerido;
}

const MUDANCA_RELEVANTE = 0.1;

/** Compara a foto de antes com a de depois, olhando o número que a regra queria mudar. */
export function compararFotos(
  regra: string,
  antes: FotoDaCampanha,
  depois: FotoDaCampanha,
): ComparacaoAntesDepois {
  const linhas: string[] = [];
  const julgar = (a: number | null, d: number | null, menorEMelhor: boolean): VereditoSugerido => {
    if (a === null || d === null || a === 0) return "inconclusivo";
    const mudanca = (d - a) / a;
    if (Math.abs(mudanca) < MUDANCA_RELEVANTE) return "inconclusivo";
    return mudanca < 0 === menorEMelhor ? "funcionou" : "nao_funcionou";
  };
  if (antes.cpl !== null || depois.cpl !== null) {
    linhas.push(
      `Custo por lead: ${antes.cpl === null ? "—" : brl(antes.cpl)} → ${depois.cpl === null ? "—" : brl(depois.cpl)}`,
    );
  }
  if (antes.ctr !== null || depois.ctr !== null) {
    linhas.push(
      `Taxa de clique: ${antes.ctr === null ? "—" : pct(antes.ctr)} → ${depois.ctr === null ? "—" : pct(depois.ctr)}`,
    );
  }
  if (antes.frequencia !== null || depois.frequencia !== null) {
    linhas.push(
      `Frequência: ${antes.frequencia === null ? "—" : antes.frequencia.toFixed(1).replace(".", ",")} → ${depois.frequencia === null ? "—" : depois.frequencia.toFixed(1).replace(".", ",")}`,
    );
  }
  linhas.push(`Leads na semana: ${antes.leads7} → ${depois.leads7}`);

  let sugestao: VereditoSugerido = "inconclusivo";
  if (regra === "R01") sugestao = julgar(antes.cpl, depois.cpl, true);
  else if (regra === "R02") sugestao = julgar(antes.ctr, depois.ctr, false);
  else if (regra === "R03") sugestao = julgar(antes.frequencia, depois.frequencia, true);
  else if (regra === "R11") sugestao = depois.leads7 > 0 ? "funcionou" : "nao_funcionou";
  return { linhas, sugestao };
}
