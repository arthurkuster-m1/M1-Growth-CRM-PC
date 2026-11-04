import { ITENS_DE_CONFIGURACAO, ROTA_DAS_CONFIGURACOES } from "@/lib/admin/configuracoes";
import {
  Buildings,
  CalendarBlank,
  ChartLineUp,
  Gauge,
  Gear,
  ListChecks,
  Megaphone,
  UserCircle,
  Users,
} from "@/lib/ui/icons";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

/**
 * O MENU DO MODO AGÊNCIA — uma lista só, usada pelo menu do app (`components/shell/Sidebar.tsx`)
 * e pelo do painel de plataforma (`components/admin/AdminSidebar.tsx`). O Modo agência É a visão
 * multi-empresa: as telas que mostram todos os clientes e, para o super-admin, a gestão das
 * empresas e das configurações da instalação.
 */
export interface ItemDoMenuDaAgencia {
  href: string;
  /** Texto em português; quem renderiza passa por `t()`. */
  rotulo: string;
  Icone: PhosphorIcon;
  /** Rotas que também acendem este item (ex.: as telas de Configurações). */
  tambemAtivoEm?: string[];
}

export function itensDaAgencia(ehSuperAdmin: boolean): ItemDoMenuDaAgencia[] {
  return [
    { href: "/app/agencia/campanhas", rotulo: "Campanhas", Icone: Megaphone },
    { href: "/app/agencia/cronograma", rotulo: "Cronograma e semana", Icone: CalendarBlank },
    { href: "/app/agencia/dashboards", rotulo: "Dashboards", Icone: ChartLineUp },
    { href: "/app/agencia/tarefas", rotulo: "Tarefas", Icone: ListChecks },
    ...(ehSuperAdmin
      ? [{ href: "/app/agencia/equipe", rotulo: "Equipe e clientes", Icone: Users }]
      : []),
  ];
}

/** Só o super-admin da plataforma: empresas, painel geral, pessoas e configurações. */
export function itensDaPlataforma(): ItemDoMenuDaAgencia[] {
  return [
    { href: "/admin/dashboard", rotulo: "Dashboard", Icone: Gauge },
    { href: "/admin/tenants", rotulo: "Empresas", Icone: Buildings },
    { href: "/admin/users", rotulo: "Usuários", Icone: UserCircle },
    {
      href: ROTA_DAS_CONFIGURACOES,
      rotulo: "Configurações",
      Icone: Gear,
      tambemAtivoEm: ITENS_DE_CONFIGURACAO.map((i) => i.href),
    },
  ];
}

export function itemAtivo(item: ItemDoMenuDaAgencia, pathname: string): boolean {
  return [item.href, ...(item.tambemAtivoEm ?? [])].some(
    (h) => pathname === h || pathname.startsWith(h + "/"),
  );
}
