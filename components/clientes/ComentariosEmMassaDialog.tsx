"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";

type Modo = "mesmo" | "linhas" | "acrescentar";

/**
 * Edita os COMENTÁRIOS de várias oportunidades de uma vez: o mesmo texto em todas, ou uma linha
 * para cada uma (colar de uma planilha, na ordem da lista), ou acrescentar ao que já existe.
 */
export function ComentariosEmMassaDialog({
  quantidade,
  textoInicial = "",
  aoFechar,
  aoAplicar,
}: {
  quantidade: number;
  textoInicial?: string;
  aoFechar: () => void;
  aoAplicar: (texto: string, modo: Modo) => Promise<void>;
}) {
  const t = useT();
  const [texto, setTexto] = useState(textoInicial);
  const linhas = texto.split(/\r?\n/).filter((x) => x.trim() !== "");
  const [modo, setModo] = useState<Modo>(
    linhas.length === quantidade && quantidade > 1 ? "linhas" : "mesmo",
  );
  const [salvando, setSalvando] = useState(false);
  const linhasCertas = modo !== "linhas" || linhas.length === quantidade;

  return (
    <Dialog open onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("Editar comentários em massa")}</DialogTitle>
          <DialogDescription>
            {quantidade === 1
              ? t("1 oportunidade selecionada.")
              : `${quantidade} ${t("oportunidades selecionadas.")}`}
          </DialogDescription>
        </DialogHeader>
        <textarea
          rows={6}
          value={texto}
          autoFocus
          onChange={(e) => setTexto(e.target.value)}
          placeholder={t("Escreva ou cole aqui (pode vir de uma planilha)…")}
          className="w-full rounded-xl border bg-card px-3 py-2 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
        <div className="grid gap-1.5 text-sm">
          {(
            [
              ["mesmo", t("O mesmo texto em todas (substitui o que existe)")],
              ["linhas", t("Uma linha para cada oportunidade, na ordem da lista")],
              ["acrescentar", t("Acrescentar este texto ao final do que já existe")],
            ] as Array<[Modo, string]>
          ).map(([id, rotulo]) => (
            <label key={id} className="flex items-center gap-2">
              <input type="radio" checked={modo === id} onChange={() => setModo(id)} />
              {rotulo}
            </label>
          ))}
        </div>
        {!linhasCertas ? (
          <p className="rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning-fg">
            {t("Para uma linha por oportunidade, o texto precisa ter exatamente")} {quantidade}{" "}
            {t("linhas. Agora tem")} {linhas.length}.
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={aoFechar}
            className="h-9 rounded-xl border px-4 text-sm font-medium hover:bg-secondary"
          >
            {t("Cancelar")}
          </button>
          <button
            type="button"
            disabled={salvando || !linhasCertas || texto.trim() === ""}
            onClick={async () => {
              setSalvando(true);
              try {
                await aoAplicar(texto, modo);
                aoFechar();
              } finally {
                setSalvando(false);
              }
            }}
            className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t("Aplicar")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
