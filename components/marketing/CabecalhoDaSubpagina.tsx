"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { CaretLeft } from "@/lib/ui/icons";

/**
 * O topo de uma SUBPÁGINA: voltar para o módulo, o tipo, o título (a agência renomeia — é o
 * nome da persona, por exemplo) e, para a agência, apagar a subpágina inteira.
 */
export function CabecalhoDaSubpagina({
  chave,
  titulo,
  tipo,
  voltar,
  podeEditar,
  aoRenomear,
}: {
  chave: string;
  titulo: string;
  tipo: string;
  voltar: { href: string; rotulo: string };
  podeEditar: boolean;
  aoRenomear: (titulo: string) => Promise<boolean>;
}) {
  const t = useT();
  const router = useRouter();
  const [nome, setNome] = useState(titulo);
  const [confirmando, setConfirmando] = useState(false);

  async function salvarNome() {
    const limpo = nome.trim();
    if (limpo === "" || limpo === titulo) {
      setNome(titulo);
      return;
    }
    if (!(await aoRenomear(limpo))) setNome(titulo);
  }

  async function apagar() {
    try {
      await apiClient.delete(`/api/v1/marketing/pages/${chave}`);
      router.push(voltar.href);
    } catch (erro) {
      showApiError(erro);
    }
  }

  return (
    <header className="flex flex-col gap-3">
      <Link
        href={voltar.href}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <CaretLeft size={14} aria-hidden />
        {voltar.rotulo}
      </Link>
      <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {tipo}
      </span>
      {podeEditar ? (
        <input
          value={nome}
          maxLength={200}
          aria-label={t("Título da página")}
          onChange={(e) => setNome(e.target.value)}
          onBlur={() => void salvarNome()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="-mx-2 w-full rounded-xl border border-transparent bg-transparent px-2 py-1 text-2xl font-bold tracking-tight outline-hidden hover:border-border focus:border-primary/60 focus:ring-2 focus:ring-primary/20 sm:text-4xl"
        />
      ) : (
        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">{titulo}</h1>
      )}
      {podeEditar ? (
        confirmando ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>{t("Apagar esta subpágina e o histórico dela?")}</span>
            <button
              type="button"
              onClick={() => void apagar()}
              className="h-8 rounded-lg bg-error px-3 text-sm font-medium text-white"
            >
              {t("Apagar")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="h-8 rounded-lg border px-3 text-sm hover:bg-secondary"
            >
              {t("Cancelar")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="w-fit text-xs text-muted-foreground hover:text-error-fg"
          >
            {t("Apagar subpágina")}
          </button>
        )
      ) : null}
    </header>
  );
}
