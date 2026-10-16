/**
 * O CLIENTE DA TAREFA: quem se beneficia dela. É sempre um lead do CRM (`contact_id`) ou, quando é
 * trabalho interno, a própria organização (sem contato). A rota junta o nome do contato para a
 * tela mostrar sem outra consulta.
 */

import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
export const COLUNAS_COM_CLIENTE = "contact:contacts(name, display_name, phone_number)";

export const ID_DO_CLIENTE_INTERNO = "interno";

interface ContatoJuntado {
  name?: string | null;
  display_name?: string | null;
  phone_number?: string | null;
}

/** Troca o `contact` juntado por `cliente_nome` (nome de exibição, ou o telefone). */
export function comNomeDoCliente<T extends Record<string, unknown>>(
  linha: T,
): Omit<T, "contact"> & { cliente_nome: string | null } {
  const { contact, ...resto } = linha as T & { contact?: unknown };
  const c = (Array.isArray(contact) ? contact[0] : contact) as ContatoJuntado | null | undefined;
  const nome = nomeDoContato(c) ?? c?.phone_number ?? null;
  return { ...(resto as Omit<T, "contact">), cliente_nome: nome };
}
