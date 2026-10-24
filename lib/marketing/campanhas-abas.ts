import type { CanalDaCampanha } from "@/lib/marketing/campanhas";

/**
 * AS SUBPÁGINAS da campanha. As fixas (cadastro, visão geral, dia a dia, funil de conversão)
 * existem sempre; as OPCIONAIS (landing pages, criativos, abordagem) dependem da estratégia: o
 * padrão vem do tipo da campanha e a agência liga ou desliga cada uma com o "+".
 */
export const ABAS_DA_CAMPANHA = [
  "cadastro",
  "visao",
  "dia",
  "landing",
  "criativos",
  "abordagem",
  "cadencia",
  "extracao",
  "disparos",
  "funil",
] as const;
export type AbaDaCampanha = (typeof ABAS_DA_CAMPANHA)[number];

export const ABAS_OPCIONAIS = [
  "landing",
  "criativos",
  "abordagem",
  "cadencia",
  "extracao",
  "disparos",
] as const;
export type AbaOpcional = (typeof ABAS_OPCIONAIS)[number];

export function ehAbaOpcional(a: string): a is AbaOpcional {
  return (ABAS_OPCIONAIS as readonly string[]).includes(a);
}

/** Os motores da prospecção ativa: só a campanha do tipo Prospecção pode tê-los. */
const SO_DA_PROSPECCAO: readonly AbaOpcional[] = ["cadencia", "extracao", "disparos"];

/** As opcionais que o tipo da campanha permite oferecer no "+". */
export function opcionaisPermitidas(canal: CanalDaCampanha): AbaOpcional[] {
  return ABAS_OPCIONAIS.filter((a) => canal === "prospeccao" || !SO_DA_PROSPECCAO.includes(a));
}

/** O padrão de cada tipo: anúncio tem LPs e criativos; prospecção tem abordagem, cadência, extração e disparos. */
export function opcionaisPadraoDoCanal(canal: CanalDaCampanha): AbaOpcional[] {
  if (canal === "trafego_pago" || canal === "social_media") return ["landing", "criativos"];
  return canal === "prospeccao" ? ["abordagem", "cadencia", "extracao", "disparos"] : ["abordagem"];
}

/** As opcionais que a campanha mostra: a escolha dela, ou o padrão do tipo. */
export function opcionaisDaCampanha(
  canal: CanalDaCampanha,
  escolhidas: readonly string[] | null | undefined,
): AbaOpcional[] {
  if (!escolhidas) return opcionaisPadraoDoCanal(canal);
  return opcionaisPermitidas(canal).filter((a) => escolhidas.includes(a));
}

export function abasDaCampanha(
  canal: CanalDaCampanha,
  escolhidas: readonly string[] | null | undefined,
): AbaDaCampanha[] {
  return ["cadastro", "visao", "dia", ...opcionaisDaCampanha(canal, escolhidas), "funil"];
}

export function abaValida(
  valor: string | null,
  canal: CanalDaCampanha,
  escolhidas?: readonly string[] | null,
): AbaDaCampanha {
  return abasDaCampanha(canal, escolhidas).find((a) => a === valor) ?? "cadastro";
}
