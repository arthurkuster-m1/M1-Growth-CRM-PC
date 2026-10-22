"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { useUpdateInboxItem, type AgentInboxItem } from "@/hooks/ai/useAgentInbox";
import { resumoDoAlerta } from "@/lib/ai/alerta-resumo";
import { SEVERITY_LABEL } from "@/lib/ai/agent-inbox-copy";
import { cn } from "@/lib/utils";

const COR = { info: "bg-info", warn: "bg-warning", critical: "bg-error" } as const;

interface Props {
  item: AgentInboxItem | null;
  podeEditar: boolean;
  aoFechar: () => void;
}

/**
 * O pop-up de um alerta do Início: o título curto, o que está acontecendo em palavras comuns, o
 * detalhe que o sistema registrou, o que fazer e o botão que leva ao assunto.
 */
export function AlertaDialog({ item, podeEditar, aoFechar }: Props) {
  const t = useT();
  const atualizar = useUpdateInboxItem();
  const resumo = item ? resumoDoAlerta(item.kind) : null;
  const destino = item?.destination;

  return (
    <Dialog open={item !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-w-lg gap-4 overflow-x-hidden rounded-2xl p-5 sm:rounded-2xl sm:p-6 [&>*]:min-w-0">
        {item && resumo ? (
          <>
            <div className="pr-8">
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                <span
                  aria-hidden
                  className={cn("h-2 w-2 rounded-full", COR[item.severity] ?? "bg-info")}
                />
                {t(SEVERITY_LABEL[item.severity] ?? "informativo")}
              </span>
              <DialogTitle className="text-xl font-semibold">{t(resumo.curto)}</DialogTitle>
              <DialogDescription className="mt-1.5 text-sm text-muted-foreground">
                {t(resumo.oQueE)}
              </DialogDescription>
            </div>

            {item.body || item.title ? (
              <div className="rounded-xl border bg-secondary/40 p-3">
                <p className="mb-1 text-[11px] font-semibold tracking-wider text-text-subtle uppercase">
                  {t("Detalhe")}
                </p>
                <div className="max-h-40 overflow-y-auto text-sm whitespace-pre-wrap">
                  {item.title}
                  {item.body ? `\n${item.body}` : ""}
                </div>
              </div>
            ) : null}

            {destino?.orientacao ? (
              <div>
                <p className="mb-1 text-[11px] font-semibold tracking-wider text-text-subtle uppercase">
                  {t("O que fazer")}
                </p>
                <p className="text-sm">{t(destino.orientacao)}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {podeEditar ? (
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={atualizar.isPending}
                  onClick={() =>
                    atualizar.mutate({ id: item.id, status: "resolved" }, { onSuccess: aoFechar })
                  }
                >
                  {t("Marcar como resolvido")}
                </Button>
              ) : null}
              {destino?.estado === "disponivel" ? (
                <Button asChild className="rounded-xl">
                  <Link href={destino.href}>{t(destino.rotulo)}</Link>
                </Button>
              ) : (
                <Button asChild className="rounded-xl">
                  <Link href="/app/ai/inbox">{t("Abrir na Central")}</Link>
                </Button>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
