"use client";

import { useState } from "react";

import type { RotulosDosBlocos } from "@/components/marketing/BlocosRender";
import { HistoricoDaPagina } from "@/components/marketing/HistoricoDaPagina";
import { useT } from "@/hooks/i18n/useT";
import type { Bloco } from "@/lib/marketing/blocos";
import type { VersaoDaPagina } from "@/lib/marketing/historico";
import { ClockCounterClockwise } from "@/lib/ui/icons";

/** O botão "Histórico" das páginas públicas: lê os retratos que o servidor já entregou. */
export function HistoricoPublico({
  versoes,
  atual,
  rotulos,
}: {
  versoes: VersaoDaPagina[];
  atual: Bloco[];
  rotulos: RotulosDosBlocos;
}) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  if (versoes.length === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium shadow-sm transition-colors hover:bg-secondary"
      >
        <ClockCounterClockwise size={16} aria-hidden />
        {t("Histórico")}
      </button>
      <HistoricoDaPagina
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        versoes={versoes}
        atual={atual}
        rotulos={rotulos}
      />
    </>
  );
}
