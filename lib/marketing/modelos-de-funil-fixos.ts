import type { EtapaDoModelo } from "@/lib/marketing/modelos-de-funil";

/**
 * OS MODELOS DE FUNIL FIXOS — os que já vêm prontos, iguais em toda empresa, e que ninguém edita
 * nem apaga (os modelos da própria empresa, salvos de um funil, continuam à parte).
 *
 * Cada um é uma lista de etapas na ordem do funil. As regras do CRM valem como em qualquer funil:
 * uma etapa "Comprou" (ganho) e uma "Não comprou" (perdido) no fim, `qualification: "mql"` marca
 * onde o lead vira MQL e `"disqualified"` a etapa de quem não serve para o negócio. A janela
 * `expected_duration_hours` é a do Radar (quanto tempo parado esfria); sem número, vale a padrão —
 * e etapas que dependem de data marcada (reunião agendada) ficam sem janela, porque a Agenda já
 * mantém o negócio "em voo".
 *
 * O id que a API recebe é `fixo:<chave>`.
 */
export interface ModeloDeFunilFixo {
  chave: string;
  nome: string;
  descricao: string;
  stages: EtapaDoModelo[];
}

const aberta = (
  name: string,
  win_probability: number,
  expected_duration_hours: number | null,
  qualification: EtapaDoModelo["qualification"] = null,
  slug?: string,
): EtapaDoModelo => ({
  name,
  is_won: false,
  is_lost: false,
  win_probability,
  expected_duration_hours,
  qualification,
  ...(slug ? { slug } : {}),
});

/**
 * As duas etapas que o resto do sistema reconhece pelo slug: marcar um compromisso leva o negócio
 * para `agendado`; registrar que a reunião aconteceu, para `reuniao-realizada`
 * (`lib/leads/appointment-stage-move.ts`).
 */
const REUNIAO_AGENDADA = () => aberta("Reunião agendada", 40, null, null, "agendado");
const REUNIAO_REALIZADA = (horas: number) =>
  aberta("Reunião realizada", 60, horas, null, "reuniao-realizada");
const comprou: EtapaDoModelo = {
  name: "Comprou",
  is_won: true,
  is_lost: false,
  win_probability: null,
  expected_duration_hours: null,
  qualification: null,
};
const naoComprou: EtapaDoModelo = {
  name: "Não comprou",
  is_won: false,
  is_lost: true,
  win_probability: null,
  expected_duration_hours: null,
  qualification: null,
};
const desqualificado = (): EtapaDoModelo => ({
  name: "Desqualificado",
  is_won: false,
  is_lost: false,
  win_probability: 0,
  expected_duration_hours: null,
  qualification: "disqualified",
});

export const MODELOS_DE_FUNIL_FIXOS: readonly ModeloDeFunilFixo[] = [
  {
    chave: "trafego-pago-com-reuniao",
    nome: "Tráfego pago · com reunião",
    descricao:
      "O lead cai da página de captura no CRM, é abordado, qualificado e leva a uma reunião antes da venda.",
    stages: [
      aberta("Novo lead", 5, 4),
      aberta("Em contato", 10, 24),
      aberta("Qualificado", 25, 48, "mql"),
      REUNIAO_AGENDADA(),
      REUNIAO_REALIZADA(48),
      desqualificado(),
      comprou,
      naoComprou,
    ],
  },
  {
    chave: "trafego-pago-sem-reuniao",
    nome: "Tráfego pago · sem reunião",
    descricao:
      "A venda se fecha na conversa (WhatsApp, chamada rápida ou página): do lead à proposta, sem reunião marcada.",
    stages: [
      aberta("Novo lead", 5, 4),
      aberta("Em contato", 10, 24),
      aberta("Qualificado", 25, 48, "mql"),
      aberta("Proposta enviada", 50, 48),
      aberta("Em negociação", 70, 72),
      desqualificado(),
      comprou,
      naoComprou,
    ],
  },
  {
    chave: "prospeccao-ativa",
    nome: "Prospecção ativa",
    descricao:
      "Você vai atrás: lista de contatos, primeiro contato, conversa com quem decide, reunião e venda.",
    stages: [
      aberta("Prospectado", 3, 48),
      aberta("Primeiro contato", 8, 48),
      aberta("Contato com o decisor", 25, 72, "mql"),
      REUNIAO_AGENDADA(),
      REUNIAO_REALIZADA(72),
      desqualificado(),
      comprou,
      naoComprou,
    ],
  },
];

const PREFIXO = "fixo:";

/** O id que a API recebe para um modelo fixo. */
export const idDoModeloFixo = (chave: string): string => `${PREFIXO}${chave}`;

/** O modelo fixo de um `template_id` (`fixo:<chave>`); `undefined` se não for um deles. */
export function modeloFixoDoId(id: string | null | undefined): ModeloDeFunilFixo | undefined {
  if (!id?.startsWith(PREFIXO)) return undefined;
  return MODELOS_DE_FUNIL_FIXOS.find((m) => m.chave === id.slice(PREFIXO.length));
}
