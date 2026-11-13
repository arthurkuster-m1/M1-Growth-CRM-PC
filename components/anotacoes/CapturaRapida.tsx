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

/**
 * CAPTURA RÁPIDA: joga um texto ou link na Caixa de entrada para analisar depois, sem escolher
 * onde guardar. Ctrl+Enter salva (ou Enter, com `enterSalva`).
 */
export function CapturaRapida({
  aberto,
  aoFechar,
  aoCapturar,
  enterSalva = false,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** Devolve verdadeiro se guardou. */
  aoCapturar: (texto: string) => Promise<boolean>;
  /** Enter guarda (Shift+Enter quebra a linha); sem isto, é Ctrl+Enter. */
  enterSalva?: boolean;
}) {
  const t = useT();
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const limpo = texto.trim();
    if (!limpo || salvando) return;
    setSalvando(true);
    const ok = await aoCapturar(limpo);
    setSalvando(false);
    if (ok) {
      setTexto("");
      aoFechar();
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Captura rápida")}</DialogTitle>
          <DialogDescription>
            {t(
              "Cole um texto ou link. Ele vai para a Caixa de entrada, para você organizar depois.",
            )}
          </DialogDescription>
        </DialogHeader>
        <textarea
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.nativeEvent.isComposing &&
              (enterSalva ? !e.shiftKey : e.ctrlKey || e.metaKey)
            ) {
              e.preventDefault();
              void salvar();
            }
          }}
          rows={6}
          maxLength={5000}
          placeholder={t("Escreva ou cole aqui…")}
          className="w-full resize-y rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {enterSalva
              ? t("Enter para guardar, Shift+Enter para nova linha")
              : t("Ctrl+Enter para guardar")}
          </span>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={!texto.trim() || salvando}
            className="h-9 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {salvando ? t("Guardando…") : t("Guardar na Caixa de entrada")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
