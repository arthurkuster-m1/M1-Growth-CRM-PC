"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/hooks/i18n/useT";
import { cn } from "@/lib/utils";

interface TabItem {
  label: string;
  href: string;
  disabled: boolean;
}

interface TabNavProps {
  basePath: string;
  tabs: TabItem[];
}

/**
 * As abas da página da empresa, no mesmo desenho das abas do resto do app (`components/ui/tabs`):
 * pílulas num trilho arredondado, a ativa em destaque. Uma fila só, que rola na horizontal no
 * celular. São links (cada aba é uma página), por isso não usam o `Tabs` do Radix.
 */
export function TabNav({ basePath, tabs }: TabNavProps) {
  const t = useT();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("Abas da empresa")}
      className="inline-flex h-11 max-w-full items-center gap-1 overflow-x-auto rounded-full bg-muted p-1 text-muted-foreground"
    >
      {tabs.map((tab) => {
        const href = basePath + tab.href;
        // A Visão Geral só vale na raiz; as outras, por prefixo.
        const isActive =
          tab.href === ""
            ? pathname === basePath || pathname === basePath + "/"
            : pathname.startsWith(href);

        return (
          <Link
            key={tab.label}
            href={tab.disabled ? "#" : href}
            aria-disabled={tab.disabled}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center justify-center rounded-full px-3.5 py-1 text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-fast focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
              tab.disabled && "pointer-events-none cursor-not-allowed opacity-50",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "hover:bg-background/60 hover:text-foreground",
            )}
          >
            {t(tab.label)}
            {tab.disabled && (
              <span className="ml-1.5 text-[10px] font-normal opacity-60">{t("em breve")}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
