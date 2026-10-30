import type { NavGroupId } from "@/lib/navigation/catalogo";

/**
 * Os GRUPOS DA BUSCA (⌘K): a ordem e a divisão do MENU LATERAL, não as do catálogo.
 *
 * O catálogo agrupa por responsabilidade técnica (`NavGroupId`): Início, Tarefas e Finanças moram em
 * "atendimento", o CRM e as Automações em grupos próprios. O menu lateral desenha outra coisa —
 * Início e Tarefas soltos, Atendimento com Inbox, Agenda, CRM e Automações, e Agentes de IA,
 * Conexões e Financeiro como entradas à parte. A busca é a mesma navegação por outra porta, e uma
 * tela não pode estar num grupo na busca e em outro no menu: aqui só se traduz.
 */
export type GrupoDaPaleta =
  | "geral"
  | "marketing"
  | "atendimento"
  | "ia"
  | "conexoes"
  | "financeiro"
  | "configuracoes";

export const GRUPOS_DA_PALETA: ReadonlyArray<{ id: GrupoDaPaleta; label: string }> = [
  { id: "geral", label: "Início e Tarefas" },
  { id: "marketing", label: "Marketing" },
  { id: "atendimento", label: "Atendimento" },
  { id: "ia", label: "Agentes de IA" },
  { id: "conexoes", label: "Conexões" },
  { id: "financeiro", label: "Financeiro" },
  { id: "configuracoes", label: "Configurações" },
];

/** A ordem das telas que o menu lateral desenha, de cima para baixo; o resto vem depois, na ordem do catálogo. */
const ORDEM_NO_MENU: readonly string[] = [
  "/app/inicio",
  "/app/tarefas",
  "/app/marketing/estrategia",
  "/app/marketing/cronograma",
  "/app/marketing/geracao-de-demanda",
  "/app/marketing/dashboards",
  "/app/inbox",
  "/app/agenda",
  "/app/clientes",
  "/app/automacoes",
];

export function grupoDaPaleta(d: { href: string; group: NavGroupId }): GrupoDaPaleta {
  if (d.href === "/app/inicio" || d.href === "/app/tarefas") return "geral";
  if (d.href === "/app/financas") return "financeiro";
  if (d.href === "/app/automacoes") return "atendimento";
  switch (d.group) {
    case "marketing":
      return "marketing";
    case "atendimento":
    case "crm":
      return "atendimento";
    case "ia":
      return "ia";
    case "canais":
      return "conexoes";
    case "organizacao":
      return "configuracoes";
  }
}

/** Posição da tela dentro do seu grupo: as do menu primeiro, na ordem dele. */
export function posicaoNoMenu(href: string): number {
  const i = ORDEM_NO_MENU.indexOf(href);
  return i < 0 ? ORDEM_NO_MENU.length : i;
}
