"use client";

import { useMemo } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import {
  idsDaSubarvore,
  montarArvore,
  type NoDaArvore,
  type ResumoDaNota,
} from "@/lib/anotacoes/paginas";
import { cn } from "@/lib/utils";

function achatar(nos: NoDaArvore[], nivel = 0): Array<{ nota: ResumoDaNota; nivel: number }> {
  return nos.flatMap((n) => [{ nota: n.nota, nivel }, ...achatar(n.filhas, nivel + 1)]);
}

/** "Mover para…": escolhe a nova página-mãe (ou a raiz). Não oferece a própria página nem o que está dentro dela. */
export function MoverNota({
  nota,
  notas,
  aoFechar,
  aoEscolher,
}: {
  nota: ResumoDaNota | null;
  notas: ResumoDaNota[];
  aoFechar: () => void;
  aoEscolher: (parentId: string | null) => void;
}) {
  const t = useT();
  const opcoes = useMemo(() => {
    if (!nota) return [];
    const fora = new Set(idsDaSubarvore(notas, nota.id));
    return achatar(montarArvore(notas.filter((n) => !n.deleted_at && !fora.has(n.id))));
  }, [nota, notas]);

  return (
    <Dialog open={nota !== null} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Mover para…")}</DialogTitle>
          <DialogDescription>{t("Escolha a página que vai guardar esta.")}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-80 overflow-y-auto">
          <li>
            <button
              type="button"
              onClick={() => aoEscolher(null)}
              className={cn(
                "w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-secondary",
                nota?.parent_id === null && "font-medium text-primary",
              )}
            >
              {t("Raiz (fora de qualquer página)")}
            </button>
          </li>
          {opcoes.map(({ nota: o, nivel }) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => aoEscolher(o.id)}
                style={{ paddingLeft: 12 + nivel * 16 }}
                className={cn(
                  "w-full truncate rounded-lg py-1.5 pr-3 text-left text-sm hover:bg-secondary",
                  nota?.parent_id === o.id && "font-medium text-primary",
                )}
              >
                {o.icon ? `${o.icon} ` : ""}
                {o.title || t("Sem título")}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
