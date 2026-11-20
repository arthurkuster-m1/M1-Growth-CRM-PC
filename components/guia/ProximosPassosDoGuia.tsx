"use client";

import Link from "next/link";

import { useAuth } from "@/hooks/auth/AuthProvider";
import { useDiagnosticoDoGuia } from "@/hooks/guia/useDiagnosticoDoGuia";
import { useT } from "@/hooks/i18n/useT";
import { roleAtLeast } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

const MOSTRAR = 3;

/**
 * O cartão do Início: os 3 próximos passos do Guia de marketing da empresa, para quem tem papel de
 * gerente ou acima. Sem perfil ainda, o cartão chama para preenchê-lo. Se o banco ainda não recebeu
 * a atualização do Guia, o cartão some (o aviso fica na tela do Guia), para não poluir o Início.
 */
export function ProximosPassosDoGuia() {
  const t = useT();
  const { user, activeOrg } = useAuth();
  const podeVer =
    (user.is_platform_admin && !user.support) || roleAtLeast(activeOrg?.role, "manager");
  const q = useDiagnosticoDoGuia({ ativo: podeVer });

  if (!podeVer || q.isLoading || q.isError || !q.data) return null;
  const { perfil, diagnostico: d } = q.data;
  const proximos = d.proximos.slice(0, MOSTRAR);

  return (
    <section
      aria-label={t("Guia de marketing")}
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5"
      data-testid="inicio-guia"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{t("Próximos passos do marketing")}</h2>
        {perfil && d.prontidao.geral !== null ? (
          <span className="text-sm text-muted-foreground">
            {t("Prontidão")} {d.prontidao.geral}%
          </span>
        ) : null}
      </div>
      {!perfil ? (
        <p className="text-sm text-muted-foreground">
          {t("Conte como é o negócio para o Guia mostrar o que fazer primeiro.")}
        </p>
      ) : proximos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("Nada pendente agora.")}</p>
      ) : (
        <ul className="grid gap-2">
          {proximos.map((p) => (
            <li key={p.id}>
              <Link
                href={p.onde.href}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors hover:bg-secondary/60",
                )}
              >
                <span className="min-w-0 truncate font-medium">{p.titulo}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{p.onde.rotulo}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/app/guia" className="w-fit text-xs font-medium text-primary hover:underline">
        {perfil ? t("Ver o Guia completo") : t("Preencher o perfil")} →
      </Link>
    </section>
  );
}
