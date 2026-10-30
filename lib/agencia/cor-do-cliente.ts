import { BASE_DA_COR } from "@/lib/motor/cores";

/**
 * A COR DE UM CLIENTE NA AGÊNCIA: a que a agência escolheu em Gerenciar organizações
 * (`organizations.settings.agencia_cor`, hex), ou — sem escolha — uma da paleta, estável por cliente.
 * O cliente nunca vê essa cor: só quem opera o Modo agência.
 */
export const PALETA_DE_CLIENTES: readonly string[] = [
  BASE_DA_COR.blue,
  BASE_DA_COR.green,
  BASE_DA_COR.purple,
  BASE_DA_COR.orange,
  BASE_DA_COR.pink,
  BASE_DA_COR.yellow,
  BASE_DA_COR.red,
  BASE_DA_COR.brown,
];

export const ehHexValido = (v: unknown): v is string =>
  typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

export function corDoCliente(escolhida: unknown, id: string): string {
  if (ehHexValido(escolhida)) return escolhida.toLowerCase();
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA_DE_CLIENTES[h % PALETA_DE_CLIENTES.length]!;
}

/** O estilo da tag colorida (fundo suave, borda e texto na cor). */
export const estiloDaTagDoCliente = (hex: string) => ({
  backgroundColor: `${hex}26`,
  borderColor: `${hex}99`,
  color: hex,
});
