/**
 * Ciclo de vida da pessoa (CRM): calculado no banco (`contacts.ciclo_de_vida`, migration 0631),
 * nunca digitado. Aqui só os nomes e as cores para a tela.
 */
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";

export const CICLOS_DE_VIDA = [
  "novo_lead",
  "em_negociacao",
  "ativo",
  "ex_cliente",
  "em_reativacao",
  "nunca_comprou",
  "desqualificado",
] as const;
export type CicloDeVida = (typeof CICLOS_DE_VIDA)[number];

export const ROTULO_DO_CICLO: Record<CicloDeVida, string> = {
  novo_lead: "Novo lead",
  em_negociacao: "Em negociação",
  ativo: "Cliente ativo",
  ex_cliente: "Ex-cliente",
  em_reativacao: "Em reativação",
  nunca_comprou: "Nunca comprou",
  desqualificado: "Desqualificado",
};

export const COR_DO_CICLO: Record<CicloDeVida, CorDaOpcao> = {
  novo_lead: "blue",
  em_negociacao: "yellow",
  ativo: "green",
  ex_cliente: "gray",
  em_reativacao: "purple",
  nunca_comprou: "red",
  desqualificado: "pink",
};

export function ehCicloDeVida(v: unknown): v is CicloDeVida {
  return typeof v === "string" && (CICLOS_DE_VIDA as readonly string[]).includes(v);
}
