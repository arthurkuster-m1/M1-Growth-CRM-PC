"use client";

import { useMutation } from "@tanstack/react-query";
import * as React from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { BlocosRender } from "@/components/marketing/BlocosRender";
import { EditorVisualDeBlocos } from "@/components/marketing/EditorVisualDeBlocos";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { Bloco } from "@/lib/marketing/blocos";
import { randomId } from "@/lib/random-id";

const ESPERA_PARA_SALVAR_MS = 900;

/**
 * O EDITOR DE BLOCOS da página do compromisso. Abre pré-preenchido com o MODELO do tipo (o roteiro
 * de vendas, por exemplo) e se adapta só neste compromisso: o que se edita aqui nunca volta ao
 * modelo. Salva sozinho, um instante depois da última mudança; "Voltar ao modelo do tipo" descarta
 * as adaptações.
 *
 * O que o compromisso tinha no campo antigo de anotações entra como um bloco de texto, na primeira
 * vez, para nada do que já foi escrito sumir.
 */
export function EditorDoCompromisso({
  id,
  salvos,
  modelo,
  notasAntigas,
  podeEditar,
  titulo,
  aoSalvar,
}: {
  id: string;
  /** Os blocos já adaptados neste compromisso; `null` = ainda vale o modelo do tipo. */
  salvos: Bloco[] | null;
  modelo: Bloco[];
  notasAntigas: string | null;
  podeEditar: boolean;
  titulo: string;
  aoSalvar: () => void;
}) {
  const t = useT();
  const [blocos, setBlocos] = React.useState<Bloco[]>(() => {
    if (salvos) return salvos;
    const antigas = notasAntigas?.trim();
    return antigas
      ? [
          ...modelo,
          { id: randomId(), tipo: "titulo", nivel: 2, texto: t("Anotações anteriores") } as Bloco,
          { id: randomId(), tipo: "texto", texto: antigas } as Bloco,
        ]
      : modelo;
  });
  const [estado, setEstado] = React.useState<"parado" | "pendente" | "salvo">("parado");
  const espera = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rotulos = { antes: t("Antes"), depois: t("Depois"), abrirLink: t("Abrir link") };

  const gravar = useMutation({
    mutationFn: async (novos: Bloco[] | null) =>
      apiClient.patch(`/api/v1/agenda/agendamentos/${id}/blocos`, { blocos: novos }),
    onSuccess: () => {
      setEstado("salvo");
      aoSalvar();
    },
    onError: (e) => {
      setEstado("parado");
      showApiError(e);
    },
  });

  React.useEffect(() => () => clearTimeout(espera.current), []);

  const mudar = (novos: Bloco[]) => {
    setBlocos(novos);
    setEstado("pendente");
    clearTimeout(espera.current);
    espera.current = setTimeout(() => gravar.mutate(novos), ESPERA_PARA_SALVAR_MS);
  };

  return (
    <section data-testid="editor-do-compromisso" aria-label={t("Anotações do compromisso")}>
      {podeEditar ? (
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-text-muted">
          <span aria-live="polite">
            {estado === "pendente" || gravar.isPending
              ? t("Salvando…")
              : estado === "salvo"
                ? t("Salvo neste compromisso")
                : t("As mudanças valem só neste compromisso.")}
          </span>
          {salvos ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-lg px-2 text-xs"
              onClick={() => {
                clearTimeout(espera.current);
                setBlocos(modelo);
                setEstado("pendente");
                gravar.mutate(null);
              }}
            >
              {t("Voltar ao modelo do tipo")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {podeEditar ? (
        <EditorVisualDeBlocos
          blocos={blocos}
          aoMudar={mudar}
          novoId={randomId}
          tituloDaPagina={titulo}
          rotulos={rotulos}
        />
      ) : (
        <BlocosRender blocos={blocos} rotulos={rotulos} />
      )}
    </section>
  );
}
