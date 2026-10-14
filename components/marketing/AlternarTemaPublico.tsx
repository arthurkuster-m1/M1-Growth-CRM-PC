"use client";

import { useT } from "@/hooks/i18n/useT";
import { useTheme } from "@/lib/theme";
import { Moon, Sun } from "@/lib/ui/icons";

/**
 * Claro ou escuro, para quem abre o link sem login: um botão só, que troca na hora e lembra a
 * escolha neste navegador (a mesma preferência do app).
 */
export function AlternarTemaPublico() {
  const t = useT();
  const { resolvedTheme, setTheme } = useTheme();
  const escuro = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(escuro ? "light" : "dark")}
      aria-label={escuro ? t("Mudar para o modo claro") : t("Mudar para o modo escuro")}
      title={escuro ? t("Modo claro") : t("Modo escuro")}
      suppressHydrationWarning
      className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      {escuro ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
      <span suppressHydrationWarning>{escuro ? t("Claro") : t("Escuro")}</span>
    </button>
  );
}
