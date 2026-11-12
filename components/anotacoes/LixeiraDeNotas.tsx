"use client";

import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useT } from "@/hooks/i18n/useT";
import { type ResumoDaNota } from "@/lib/anotacoes/paginas";
import { ArrowBendUpLeft, CaretDown, CaretRight, Trash } from "@/lib/ui/icons";

/**
 * A LIXEIRA: as páginas apagadas (só a de cima de cada grupo; as subpáginas vão e voltam com ela).
 * Restaurar devolve tudo; "apagar de vez" não tem volta, por isso pede confirmação.
 */
export function LixeiraDeNotas({
  notas,
  aoRestaurar,
  aoApagarDeVez,
}: {
  notas: ResumoDaNota[];
  aoRestaurar: (id: string) => void;
  aoApagarDeVez: (id: string) => void;
}) {
  const t = useT();
  const [aberta, setAberta] = useState(false);
  const [confirmando, setConfirmando] = useState<ResumoDaNota | null>(null);

  const apagadas = notas.filter((n) => n.deleted_at);
  // O topo do grupo: a mãe não foi apagada junto (instante de exclusão diferente, ou mãe viva).
  const topos = apagadas
    .filter((n) => {
      const mae = n.parent_id ? notas.find((x) => x.id === n.parent_id) : undefined;
      return !mae || mae.deleted_at !== n.deleted_at;
    })
    .sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? ""));
  if (topos.length === 0) return null;

  return (
    <div className="mt-3 border-t pt-2">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-card/70 hover:text-foreground"
      >
        {aberta ? <CaretDown size={12} aria-hidden /> : <CaretRight size={12} aria-hidden />}
        <Trash size={14} aria-hidden />
        {t("Lixeira")}
        <span className="ml-auto text-xs">{topos.length}</span>
      </button>
      {aberta ? (
        <ul className="mt-1 flex flex-col gap-px">
          {topos.map((n) => (
            <li
              key={n.id}
              className="group flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] text-muted-foreground hover:bg-card/70"
            >
              <span className="min-w-0 flex-1 truncate">
                {n.icon ? `${n.icon} ` : ""}
                {n.title || t("Sem título")}
              </span>
              <button
                type="button"
                title={t("Restaurar")}
                aria-label={t("Restaurar")}
                onClick={() => aoRestaurar(n.id)}
                className="grid h-5 w-5 place-items-center rounded hover:bg-secondary hover:text-foreground"
              >
                <ArrowBendUpLeft size={12} aria-hidden />
              </button>
              <button
                type="button"
                title={t("Apagar de vez")}
                aria-label={t("Apagar de vez")}
                onClick={() => setConfirmando(n)}
                className="grid h-5 w-5 place-items-center rounded hover:bg-secondary hover:text-error-fg"
              >
                <Trash size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <AlertDialog open={confirmando !== null} onOpenChange={(v) => !v && setConfirmando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Apagar de vez?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("A página e suas subpáginas serão apagadas para sempre. Não dá para desfazer.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmando) aoApagarDeVez(confirmando.id);
                setConfirmando(null);
              }}
            >
              {t("Apagar de vez")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
