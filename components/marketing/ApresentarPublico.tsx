"use client";

import { useState, type ReactNode } from "react";

import { Apresentacao } from "@/components/marketing/Apresentacao";
import type { RotulosDosBlocos } from "@/components/marketing/BlocosRender";
import { useT } from "@/hooks/i18n/useT";
import type { Bloco } from "@/lib/marketing/blocos";
import type { TomDaCapa } from "@/lib/marketing/modulos";
import { Presentation } from "@/lib/ui/icons";

/** O botão "Apresentar" das páginas públicas (a apresentação em tela cheia precisa de estado no navegador). */
export function ApresentarPublico(props: {
  titulo: string;
  descricao: string;
  superior: string;
  tom: TomDaCapa;
  icone: ReactNode;
  blocos: readonly Bloco[];
  rotulos: RotulosDosBlocos;
}) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium shadow-sm transition-colors hover:bg-secondary"
      >
        <Presentation size={16} aria-hidden />
        {t("Apresentar")}
      </button>
      {aberto ? <Apresentacao {...props} aoFechar={() => setAberto(false)} /> : null}
    </>
  );
}
