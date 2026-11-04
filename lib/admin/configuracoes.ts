import {
  CalendarBlank,
  ChartBar,
  ClipboardText,
  EnvelopeSimple,
  Gear,
  Key,
  Lock,
  Palette,
  Scales,
  ShieldCheck,
  Stack,
  Warning,
  WebhooksLogo,
} from "@/lib/ui/icons";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

/**
 * As telas de CONFIGURAÇÃO DA INSTALAÇÃO do painel de plataforma. Elas não são mais itens soltos
 * do menu lateral: moram atrás de UMA entrada, "Configurações" (`/admin/ajustes`), que lista
 * todas. Esta lista é a fonte da página e do teste de completude do menu do admin.
 *
 * A rota do hub é `/admin/ajustes`, e não `/admin/configuracoes`, de propósito: já existe
 * `/admin/configuracao` (Credenciais), e dois endereços com uma letra de diferença seriam armadilha.
 */
export const ROTA_DAS_CONFIGURACOES = "/admin/ajustes";

export interface ItemDeConfiguracao {
  href: string;
  label: string;
  descricao: string;
  icon: PhosphorIcon;
}

export const ITENS_DE_CONFIGURACAO: ItemDeConfiguracao[] = [
  {
    href: "/admin/marca",
    label: "Marca",
    descricao: "Nome, cor e logo do produto nesta instalação.",
    icon: Palette,
  },
  {
    href: "/admin/cadastro",
    label: "Cadastro",
    descricao: "Quem pode criar conta nesta instalação.",
    icon: Key,
  },
  {
    href: "/admin/email",
    label: "E-mail",
    descricao: "Servidor que envia os e-mails de todas as empresas.",
    icon: EnvelopeSimple,
  },
  {
    href: "/admin/sistema",
    label: "Recursos opcionais",
    descricao: "Liga e desliga recursos e comportamentos da instalação.",
    icon: Gear,
  },
  {
    href: "/admin/configuracao",
    label: "Credenciais",
    descricao: "Chaves e contatos da instalação (e-mail, remetente).",
    icon: Lock,
  },
  {
    href: "/admin/modulos",
    label: "Módulos",
    descricao: "Módulos opcionais instalados no servidor.",
    icon: Stack,
  },
  {
    href: "/admin/google",
    label: "Google Agenda",
    descricao: "App do Google usado pela Agenda.",
    icon: CalendarBlank,
  },
  {
    href: "/admin/meta",
    label: "API Oficial (Meta)",
    descricao: "Chave e verificação do webhook do App da Meta.",
    icon: WebhooksLogo,
  },
  {
    href: "/admin/platform-admins",
    label: "Administradores da plataforma",
    descricao: "Quem administra a instalação inteira.",
    icon: ShieldCheck,
  },
  {
    href: "/admin/audit",
    label: "Auditoria",
    descricao: "Registro de tudo o que foi feito no sistema.",
    icon: ClipboardText,
  },
  {
    href: "/admin/lgpd",
    label: "LGPD",
    descricao: "Solicitações de titulares e prazos.",
    icon: Scales,
  },
  {
    href: "/admin/incidents",
    label: "Incidentes",
    descricao: "Incidentes de segurança e dados.",
    icon: Warning,
  },
  {
    href: "/admin/usage",
    label: "Uso",
    descricao: "Consumo de IA e recursos por empresa.",
    icon: ChartBar,
  },
];
