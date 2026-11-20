import type { Conta } from "./tipos";
import { datasDaFatura, faturaPadrao } from "./formato";

/**
 * Quanto dá para gastar POR DIA com o que sobrou do TETO do mês, respeitando a virada do cartão.
 * A fatura do mês M (nome = mês do pagamento) recebe as compras feitas no cartão desde o fechamento anterior até o fechamento dela.
 * Ex.: cartão fecha dia 28 e vence dia 5 → de 29/10 a 28/11 as compras caem na fatura de DEZEMBRO.
 * - Fatura de M ainda acumulando (o cartão não virou): ritmo por dia até a VIRADA do cartão (tudo que gastar até lá conta em M).
 * - Cartão já virou: só Pix/débito conta em M → ritmo por dia até o fim do mês.
 * Mês passado não tem ritmo; mês futuro (que não é o da fatura aberta) conta desde o dia 1.
 */
export type RitmoDiario = {
  restante: number;
  esgotado: boolean;
  fase: "cartao" | "fim_do_mes";
  porDia: number;
  dias: number;
  /** último dia contado (ISO): a virada do cartão ou o último dia do mês */ ate: string;
  /** fase "cartao": qual cartão vira por último */ cartao: { nome: string; fecha: string } | null;
  /** fase "fim_do_mes": o cartão já virou para este mês e o mês da fatura aberta agora (para avisar "compras no cartão entram em …") */ faturaAberta:
    string | null;
};

type CartaoRitmo = Pick<Conta, "nome" | "dia_fechamento" | "dia_vencimento" | "ativa">;
const ultimoDia = (mes: string) =>
  `${mes}-${String(new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate()).padStart(2, "0")}`;
const dias = (de: string, ate: string) =>
  Math.round(
    (Date.UTC(+ate.slice(0, 4), +ate.slice(5, 7) - 1, +ate.slice(8, 10)) -
      Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10))) /
      86_400_000,
  ) + 1;

export function ritmoDiario(a: {
  mes: string;
  hoje: string;
  restante: number;
  cartoes: CartaoRitmo[];
}): RitmoDiario | null {
  const mesHoje = a.hoje.slice(0, 7);
  if (a.mes < mesHoje) return null;
  const fim = ultimoDia(a.mes);
  const cartoes = a.cartoes.filter((c) => c.ativa && c.dia_fechamento != null);
  // cartões cuja fatura de M ainda está acumulando (fecham hoje ou depois, e é nela que uma compra de hoje cairia)
  const abertos = cartoes
    .map((c) => ({
      nome: c.nome,
      fecha: datasDaFatura(a.mes, c.dia_fechamento, c.dia_vencimento).fecha,
      mesHoje: faturaPadrao(a.hoje, c.dia_fechamento, c.dia_vencimento),
    }))
    .filter((c) => c.fecha !== null && c.fecha >= a.hoje && c.mesHoje === a.mes) as {
    nome: string;
    fecha: string;
  }[];
  const virada = abertos.sort((x, y) => y.fecha.localeCompare(x.fecha))[0]; // o cartão que vira por último
  const faturaAberta =
    cartoes
      .map((c) => faturaPadrao(a.hoje, c.dia_fechamento, c.dia_vencimento))
      .filter((m) => m > a.mes)
      .sort()[0] ?? null;
  if (a.restante <= 0)
    return {
      restante: a.restante,
      esgotado: true,
      fase: virada ? "cartao" : "fim_do_mes",
      porDia: 0,
      dias: 0,
      ate: virada?.fecha ?? fim,
      cartao: virada ?? null,
      faturaAberta,
    };
  if (virada && virada.fecha < fim) {
    const d = dias(a.hoje, virada.fecha);
    return {
      restante: a.restante,
      esgotado: false,
      fase: "cartao",
      porDia: Math.floor(a.restante / d),
      dias: d,
      ate: virada.fecha,
      cartao: virada,
      faturaAberta: null,
    };
  }
  const inicio = a.mes === mesHoje ? a.hoje : `${a.mes}-01`;
  const d = dias(inicio, fim);
  return {
    restante: a.restante,
    esgotado: false,
    fase: "fim_do_mes",
    porDia: Math.floor(a.restante / d),
    dias: d,
    ate: fim,
    cartao: null,
    faturaAberta: a.mes === mesHoje || faturaAberta === null ? faturaAberta : null,
  };
}

/** Quanto precisa ENTRAR por dia, em média, até o fim do mês para bater a meta de ganhos (mês passado não tem ritmo). */
export type RitmoGanho = {
  restante: number;
  batida: boolean;
  porDia: number;
  dias: number;
  ate: string;
};
export function ritmoGanho(a: { mes: string; hoje: string; restante: number }): RitmoGanho | null {
  const mesHoje = a.hoje.slice(0, 7);
  if (a.mes < mesHoje) return null;
  const fim = ultimoDia(a.mes);
  if (a.restante <= 0) return { restante: a.restante, batida: true, porDia: 0, dias: 0, ate: fim };
  const d = dias(a.mes === mesHoje ? a.hoje : `${a.mes}-01`, fim);
  return {
    restante: a.restante,
    batida: false,
    porDia: Math.ceil(a.restante / d),
    dias: d,
    ate: fim,
  };
}
