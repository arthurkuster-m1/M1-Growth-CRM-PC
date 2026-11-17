"use client";

import { useCallback, useState } from "react";

import { BlocosRender } from "@/components/marketing/BlocosRender";
import { EditorVisualDeBlocos } from "@/components/marketing/EditorVisualDeBlocos";
import { useT } from "@/hooks/i18n/useT";
import { blocosDaNota, MAXIMO_DE_BLOCOS_DA_NOTA } from "@/lib/anotacoes/blocos-da-nota";
import type { Documento } from "@/lib/anotacoes/documento";
import type { Bloco } from "@/lib/marketing/blocos";
import { randomId } from "@/lib/random-id";

export interface PropsDoEditorDeNotas {
  /** O conteúdo salvo. Lido UMA vez, ao abrir (use `key={id}` para trocar de página). */
  inicial: Documento;
  editavel: boolean;
  aoMudar: (documento: Documento) => void;
  /** Dentro de um cartão (Início): sem a folga de tela cheia embaixo. */
  compacto?: boolean;
}

/**
 * O EDITOR DE ANOTAÇÕES: o mesmo motor de blocos da aba Estratégia (`EditorVisualDeBlocos`) — clique
 * no vazio e escreva, Enter cria o próximo bloco, "/" escolhe o bloco, cada bloco tem atalho de
 * teclado, e há o bloco Canvas (desenho com formas e setas). Quem só lê vê os blocos prontos.
 *
 * O documento é a lista de blocos de Marketing (`lib/marketing/blocos.ts`); páginas gravadas no
 * editor anterior são convertidas ao abrir (`lib/anotacoes/blocos-da-nota.ts`).
 */
export default function EditorDeNotas({
  inicial,
  editavel,
  aoMudar,
  compacto = false,
}: PropsDoEditorDeNotas) {
  const t = useT();
  const [blocos, setBlocos] = useState<Bloco[]>(() => blocosDaNota(inicial));
  const rotulos = { antes: t("Antes"), depois: t("Depois"), abrirLink: t("Abrir link") };

  const mudar = useCallback(
    (novos: Bloco[]) => {
      setBlocos(novos);
      aoMudar(novos as Documento);
    },
    [aoMudar],
  );

  if (!editavel) {
    return blocos.length === 0 ? (
      <p className="py-6 text-sm text-muted-foreground">{t("Esta página está em branco.")}</p>
    ) : (
      <div className={compacto ? "" : "pb-24"}>
        <BlocosRender blocos={blocos} rotulos={rotulos} />
      </div>
    );
  }

  return (
    <div className={compacto ? "" : "pb-24"}>
      <EditorVisualDeBlocos
        blocos={blocos}
        aoMudar={mudar}
        novoId={randomId}
        rotulos={rotulos}
        maximo={MAXIMO_DE_BLOCOS_DA_NOTA}
      />
    </div>
  );
}
