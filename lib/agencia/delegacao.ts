/**
 * A DELEGAÇÃO do modo agência: quais clientes cada pessoa da equipe gere. Acesso a um cliente = ser
 * membro da organização dele (papel manager ou admin) — a mesma associação que a RLS já usa. Aqui só
 * há as regras puras; o banco é tocado por `app/actions/agencia/delegacao.ts`.
 */
export const PAPEIS_DELEGAVEIS = ["manager", "admin"] as const;
export type PapelDelegavel = (typeof PAPEIS_DELEGAVEIS)[number];

export const ROTULO_DO_PAPEL_DELEGADO: Record<PapelDelegavel, string> = {
  manager: "Gestor",
  admin: "Admin",
};

export type Acesso = PapelDelegavel | null;

export type MudancaDeAcesso =
  | { tipo: "nada" }
  | { tipo: "conceder"; papel: PapelDelegavel }
  | { tipo: "alterar"; papel: PapelDelegavel }
  | { tipo: "revogar" };

/**
 * O que fazer para ir do acesso de hoje ao pedido. `atual` é o papel da associação ATIVA
 * (`null` = sem associação ou revogada).
 */
export function mudancaDeAcesso(atual: string | null, pedido: Acesso): MudancaDeAcesso {
  if (pedido === null) return atual === null ? { tipo: "nada" } : { tipo: "revogar" };
  if (atual === null) return { tipo: "conceder", papel: pedido };
  return atual === pedido ? { tipo: "nada" } : { tipo: "alterar", papel: pedido };
}

/** Tirar ou rebaixar o ÚLTIMO admin deixaria o cliente sem quem o administre. */
export function deixariaSemAdmin(
  atual: string | null,
  pedido: Acesso,
  adminsAtivos: number,
): boolean {
  return atual === "admin" && pedido !== "admin" && adminsAtivos <= 1;
}
