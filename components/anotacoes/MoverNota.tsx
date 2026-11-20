"use client";

import { useMemo } from "react";

import { Folha } from "@/components/anotacoes/kit-visual";
import { useT } from "@/hooks/i18n/useT";
import {
  idsDaSubarvore,
  montarArvore,
  type NoDaArvore,
  type ResumoDaNota,
} from "@/lib/anotacoes/paginas";

function achatar(nos: NoDaArvore[], nivel = 0): Array<{ nota: ResumoDaNota; nivel: number }> {
  return nos.flatMap((n) => [{ nota: n.nota, nivel }, ...achatar(n.filhas, nivel + 1)]);
}

/** "Mover para…": escolhe a nova página-mãe (ou a raiz). Não oferece a própria página, o que está dentro dela, nem a Caixa de entrada. */
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
    return achatar(
      montarArvore(notas.filter((n) => !n.deleted_at && !fora.has(n.id) && n.kind === null)),
    );
  }, [nota, notas]);

  return (
    <Folha open={nota !== null} onClose={aoFechar} title={t("Mover para…")}>
      <p className="an-t-corpo-sm an-t-mudo">{t("Escolha a página que vai guardar esta.")}</p>
      <ul className="an-mover">
        <li>
          <button
            type="button"
            className={nota?.parent_id === null ? "is-atual" : undefined}
            onClick={() => aoEscolher(null)}
          >
            {t("Raiz (fora de qualquer página)")}
          </button>
        </li>
        {opcoes.map(({ nota: o, nivel }) => (
          <li key={o.id}>
            <button
              type="button"
              style={{ paddingLeft: 12 + nivel * 16 }}
              className={nota?.parent_id === o.id ? "is-atual" : undefined}
              onClick={() => aoEscolher(o.id)}
            >
              {o.icon ? `${o.icon} ` : ""}
              {o.title || t("Sem título")}
            </button>
          </li>
        ))}
      </ul>
    </Folha>
  );
}
