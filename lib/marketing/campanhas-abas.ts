import type { CanalDaCampanha } from "@/lib/marketing/campanhas";

/**
 * AS SUBPÁGINAS da campanha. Quais aparecem depende do tipo: campanha com anúncio e página de
 * destino (tráfego pago, social media) tem Landing Pages e Criativos; as de contato direto
 * (prospecção, indicações, parcerias, aproveitamento de base) têm "Abordagem" no lugar.
 */
export const ABAS_DA_CAMPANHA = [
  "cadastro",
  "visao",
  "dia",
  "landing",
  "criativos",
  "abordagem",
  "funil",
] as const;
export type AbaDaCampanha = (typeof ABAS_DA_CAMPANHA)[number];

export function abasDoCanal(canal: CanalDaCampanha): AbaDaCampanha[] {
  const comAnuncio = canal === "trafego_pago" || canal === "social_media";
  return comAnuncio
    ? ["cadastro", "visao", "dia", "landing", "criativos", "funil"]
    : ["cadastro", "visao", "dia", "abordagem", "funil"];
}

export function abaValida(valor: string | null, canal: CanalDaCampanha): AbaDaCampanha {
  const abas = abasDoCanal(canal);
  return abas.find((a) => a === valor) ?? "cadastro";
}
