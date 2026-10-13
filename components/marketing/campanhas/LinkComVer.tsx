"use client";

import { useT } from "@/hooks/i18n/useT";
import { ArrowSquareOut } from "@/lib/ui/icons";

/** Um link numa célula de tabela, com o botão "Ver" no fim (abre em nova aba). */
export function LinkComVer({ url, children }: { url: string; children: React.ReactNode }) {
  const t = useT();
  const valido = /^https?:\/\//i.test(url);
  return (
    <div className="flex min-w-0 items-center gap-1">
      <div className="min-w-0 flex-1">{children}</div>
      {valido ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={t("Ver o link em nova aba")}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border bg-card px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase hover:bg-secondary hover:text-foreground"
        >
          <ArrowSquareOut size={12} aria-hidden />
          {t("Ver")}
        </a>
      ) : null}
    </div>
  );
}
