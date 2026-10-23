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
  "extracao",
  "disparos",
  "funil",
] as const;
export type AbaDaCampanha = (typeof ABAS_DA_CAMPANHA)[number];

export const ABAS_OPCIONAIS = ["landing", "criativos", "abordagem"] as const;
export type AbaOpcional = (typeof ABAS_OPCIONAIS)[number];

export function ehAbaOpcional(a: string): a is AbaOpcional {
  return (ABAS_OPCIONAIS as readonly string[]).includes(a);
}

/** O padrão de cada tipo: anúncio tem LPs e criativos; contato direto tem abordagem. */
export function opcionaisPadraoDoCanal(canal: CanalDaCampanha): AbaOpcional[] {
  return canal === "trafego_pago" || canal === "social_media"
    ? ["landing", "criativos"]
    : ["abordagem"];
}

/** As opcionais que a campanha mostra: a escolha dela, ou o padrão do tipo. */
export function opcionaisDaCampanha(
  canal: CanalDaCampanha,
  escolhidas: readonly string[] | null | undefined,
): AbaOpcional[] {
  if (!escolhidas) return opcionaisPadraoDoCanal(canal);
  return ABAS_OPCIONAIS.filter((a) => escolhidas.includes(a));
}

/**
 * Os MOTORES da campanha de prospecção — extração de leads e disparos. São fixos (não opcionais:
 * a coluna `optional_tabs` tem CHECK) e só existem no tipo Prospecção.
 */
export function motoresDaCampanha(canal: CanalDaCampanha): AbaDaCampanha[] {
  return canal === "prospeccao" ? ["extracao", "disparos"] : [];
}

export function abasDaCampanha(
  canal: CanalDaCampanha,
  escolhidas: readonly string[] | null | undefined,
): AbaDaCampanha[] {
  return [
    "cadastro",
    "visao",
    "dia",
    ...opcionaisDaCampanha(canal, escolhidas),
    ...motoresDaCampanha(canal),
    "funil",
  ];
}

export function abaValida(
  valor: string | null,
  canal: CanalDaCampanha,
  escolhidas?: readonly string[] | null,
): AbaDaCampanha {
  return abasDaCampanha(canal, escolhidas).find((a) => a === valor) ?? "cadastro";
}
