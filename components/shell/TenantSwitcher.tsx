"use client";
import { TagDoCliente } from "@/components/agencia/TagDoCliente";
import { destinoAoTrocarDeOrganizacao } from "@/lib/navigation/destino-ao-trocar-de-organizacao";
import { corDoCliente } from "@/lib/agencia/cor-do-cliente";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { useOrganizationTransition } from "./OrganizationTransitionProvider";
import { CaretDown, Storefront } from "@/lib/ui/icons";
import { useUser, useActiveOrg } from "@/hooks/auth/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { setActiveOrg } from "@/app/actions/shell/setActiveOrg";

export function TenantSwitcher() {
  const t = useT();
  const user = useUser();
  const active = useActiveOrg();
  const transition = useOrganizationTransition();
  const pathname = usePathname();
  const router = useRouter();
  const noModoAgencia = pathname === "/app/agencia" || pathname.startsWith("/app/agencia/");
  // O Modo agência é uma "organização" à parte na lista: quem gere clientes (manager/admin em mais de um,
  // ou super-admin) a vê.
  const temModoAgencia =
    user.is_platform_admin ||
    user.organizations.filter((o) => o.role === "admin" || o.role === "manager").length > 1;
  const [isPending, setPending] = useState(false);
  const switchTo = async (orgId: string) => {
    if (orgId === active?.orgId && !noModoAgencia) return;
    flushSync(() => { setPending(true); transition.begin(t("Carregando organização…")); });
    try {
      const result = await setActiveOrg(orgId);
      if (!result.ok) throw new Error(result.error);
      // Novo documento elimina QueryClient, subscriptions e respostas em voo.
      window.location.assign(destinoAoTrocarDeOrganizacao(pathname));
    } catch {
      transition.cancel();
      setPending(false);
      toast.error(t("Não foi possível trocar de organização. Seu acesso pode ter mudado. Tente novamente."));
    }
  };

  if (user.organizations.length <= 1 && !user.is_platform_admin) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/*
          ⚠️ NO CELULAR ESTE BOTÃO É SÓ O ÍCONE, e isso não é economia de estilo:
          é o que faz o cabeçalho caber.

          Medido na tela, numa instalação real em 360px: com o nome escrito, o
          botão ocupava 153px e o cabeçalho tinha 14 sobreposições, a pior de
          96px — o nome da organização por baixo do campo de busca, e a busca por
          cima do sino. Hambúrguer + nome + busca + sino + avatar não cabem em
          360px, e o bloco do meio é `flex-1 justify-center` entre dois
          `shrink-0`: quando falta espaço ele transborda por cima dos vizinhos em
          vez de encolher.

          Só o ícone: 40px, e as sobreposições vão a zero. O nome completo
          continua a UM TOQUE, dentro do menu que este botão já abre — e
          continua no `aria-label`, para quem usa leitor de tela.

          `min-w-0` sozinho NÃO resolve (medido): ele deixa o flex comprimir o
          texto, mas a 18px visíveis o nome vira "M…", e as colisões de 13px com
          a busca continuam. O espaço é que não existe.
        */}
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending || !!user.support}
          className="gap-2"
          aria-label={`${t("Organização")}: ${noModoAgencia ? t("Modo agência") : (active?.name ?? t("Selecionar org"))}`}
          title={user.support ? "Saia do acompanhamento para trocar de organização" : undefined}
          data-testid="tenant-switcher"
        >
          <Storefront size={16} weight="duotone" aria-hidden />
          <span className="hidden max-w-[160px] truncate md:inline">
            {noModoAgencia ? t("Modo agência") : (active?.name ?? "Selecionar org")}
          </span>
          <CaretDown size={12} aria-hidden className="hidden md:inline" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        {temModoAgencia && (
          <DropdownMenuItem
            data-testid="modo-agencia"
            onClick={() => router.push("/app/agencia/campanhas")}
            className="flex items-center justify-between"
          >
            <span className="truncate">{t("Modo agência")}</span>
            {noModoAgencia && <span className="text-xs text-muted-foreground">✓</span>}
          </DropdownMenuItem>
        )}
        {user.organizations.map((org) => (
          <DropdownMenuItem
            key={org.organization_id}
            data-testid={`tenant-switcher-item-${org.organization_id}`}
            onClick={() => { void switchTo(org.organization_id); }}
            className="flex items-center justify-between"
          >
            <TagDoCliente nome={org.organization_name} cor={corDoCliente(org.agencia_cor, org.organization_id)} />
            {active?.orgId === org.organization_id && !noModoAgencia && <span className="text-xs text-muted-foreground">✓</span>}
          </DropdownMenuItem>
        ))}
        {user.is_platform_admin && <DropdownMenuItem asChild>
          <Link href="/admin/tenants">{t("Gerenciar organizações")}</Link>
        </DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
