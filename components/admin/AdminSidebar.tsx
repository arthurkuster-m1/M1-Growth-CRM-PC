"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { SimboloDoProduto } from "@/components/branding/MarcaDoProduto";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { marcaEhADoProduto } from "@/lib/branding";
import { useMarcaDaInstalacao } from "@/lib/branding/contexto";
import {
  itemAtivo,
  itensDaAgencia,
  itensDaPlataforma,
  type ItemDoMenuDaAgencia,
} from "@/lib/agencia/menu";
import { useT } from "@/hooks/i18n/useT";

/**
 * O MENU DO PAINEL DE PLATAFORMA = o menu do MODO AGÊNCIA (`lib/agencia/menu.ts`, a mesma lista do
 * menu do app). Antes era uma fila de 17 telas soltas; as telas de configuração da instalação
 * (Marca, E-mail, Auditoria, LGPD…) moram atrás de UMA entrada, "Configurações"
 * (`lib/admin/configuracoes.ts`). Inbox, Extensões e Destinos internos saíram do menu por decisão
 * do dono (04/11/2026): as telas continuam existindo, só sem porta aqui.
 */
interface AdminSidebarProps {
  userEmail: string;
  /** "mobile" = conteúdo desta MESMA navegação dentro do drawer que `AdminShell`
   * abre abaixo de `lg` — mesmo padrão de `components/shell/Sidebar.tsx`. */
  variant?: "desktop" | "mobile";
}

function Grupo({
  titulo,
  itens,
  pathname,
}: {
  titulo: string;
  itens: ItemDoMenuDaAgencia[];
  pathname: string;
}) {
  const t = useT();
  return (
    <div className="space-y-0.5">
      <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {titulo}
      </p>
      {itens.map((item) => {
        const ativo = itemAtivo(item, pathname);
        const Icone = item.Icone;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-colors",
              ativo
                ? "bg-card font-medium text-foreground shadow-sm ring-1 ring-border/70"
                : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
            )}
          >
            <Icone size={18} weight={ativo ? "fill" : "regular"} aria-hidden />
            <span className="truncate">{t(item.rotulo)}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function AdminSidebar({ userEmail, variant = "desktop" }: AdminSidebarProps) {
  const t = useT();
  const isMobile = variant === "mobile";
  const pathname = usePathname();
  // Por PROP do servidor, e nunca `branding()`: aquela função lê fontes
  // diferentes nos dois lados da fronteira (`window.__PUBLIC_ENV__` no
  // navegador, `process.env` no servidor), e desde que o layout raiz passou a
  // injetar a marca do BANCO as duas divergem — o nome renderizado no SSR não
  // batia com o hidratado, que é hydration mismatch. Ver `lib/branding/contexto.tsx`.
  const marca = useMarcaDaInstalacao();

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-card",
        isMobile ? "h-full w-full" : "hidden w-60 shrink-0 lg:flex",
      )}
    >
      <div className="space-y-2 border-b p-4">
        <div className="flex items-center gap-3">
          {/* O nome já está escrito ao lado — o símbolo é reforço, não legenda. */}
          {marcaEhADoProduto(marca) && (
            <SimboloDoProduto nome={marca.name} decorativo className="h-8 w-8" />
          )}
          <div className="flex flex-col">
            <span className="text-xs tracking-wider text-muted-foreground uppercase">
              {marca.name}
            </span>
            <span className="text-sm font-semibold tracking-tight">{t("Admin Plataforma")}</span>
          </div>
        </div>
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden />
          {t("Voltar para empresas")}
        </Link>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-2" aria-label={t("Navegação plataforma")}>
        <Grupo titulo={t("Modo agência")} itens={itensDaAgencia(true)} pathname={pathname} />
        <Grupo titulo={t("Plataforma")} itens={itensDaPlataforma()} pathname={pathname} />
      </nav>
      <div className="flex items-center justify-between gap-2 border-t p-3">
        <p className="min-w-0 truncate px-1 text-xs text-muted-foreground" title={userEmail}>
          {userEmail}
        </p>
        <ThemeToggle className="h-7 w-7 shrink-0 lg:h-7 lg:w-7" />
      </div>
    </aside>
  );
}
