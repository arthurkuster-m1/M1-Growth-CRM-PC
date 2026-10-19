"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { useT } from "@/hooks/i18n/useT";
import { iniciarDesfazer, podeDesfazer } from "@/lib/motor/desfazer";

/**
 * Ctrl+Z (Cmd+Z no Mac) desfaz a última edição feita numa tabela. Fica quieto quando a pessoa
 * está digitando — ali o Ctrl+Z é do próprio campo de texto.
 */
export function useAtalhoDesfazer() {
  const t = useT();
  useEffect(() => {
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "z" || e.shiftKey || e.altKey) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!podeDesfazer()) return;
      e.preventDefault();
      // A tela volta na hora; o aviso também — o servidor confirma por baixo.
      const r = iniciarDesfazer();
      if (!r) return;
      toast.success(r.entrada.rotulo ? `${t("Desfeito")}: ${r.entrada.rotulo}` : t("Desfeito"));
      r.concluido.catch(showApiError);
    };
    window.addEventListener("keydown", aoTecla);
    return () => window.removeEventListener("keydown", aoTecla);
  }, [t]);
}
