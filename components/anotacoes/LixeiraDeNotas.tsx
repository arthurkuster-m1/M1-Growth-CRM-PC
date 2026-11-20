"use client";

import { useState } from "react";

import { Botao, Folha } from "@/components/anotacoes/kit-visual";
import { useT } from "@/hooks/i18n/useT";
import { type ResumoDaNota } from "@/lib/anotacoes/paginas";
import { ArrowBendUpLeft, CaretDown, CaretRight, Trash } from "@/lib/ui/icons";

/**
 * A LIXEIRA, no pé da lista: as páginas apagadas (só a de cima de cada grupo; as subpáginas vão e
 * voltam com ela). Restaurar devolve tudo; "apagar de vez" não tem volta e pede confirmação.
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
    <div className="an-lixeira" data-testid="lixeira">
      <button
        type="button"
        className="an-lixeira__cab"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
      >
        {aberta ? <CaretDown size={12} aria-hidden /> : <CaretRight size={12} aria-hidden />}
        <Trash size={14} aria-hidden />
        {t("Lixeira")}
        <span className="an-t-legenda">{topos.length}</span>
      </button>
      {aberta ? (
        <ul className="an-lista">
          {topos.map((n) => (
            <li key={n.id} className="an-lixeira__item">
              <span className="an-nome">
                {n.icon ? `${n.icon} ` : ""}
                {n.title || t("Sem título")}
              </span>
              <button
                type="button"
                title={t("Restaurar")}
                aria-label={`${t("Restaurar")} ${n.title || t("página")}`}
                onClick={() => aoRestaurar(n.id)}
              >
                <ArrowBendUpLeft size={12} aria-hidden />
              </button>
              <button
                type="button"
                title={t("Apagar de vez")}
                aria-label={`${t("Apagar de vez")} ${n.title || t("página")}`}
                onClick={() => setConfirmando(n)}
              >
                <Trash size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Folha
        open={confirmando !== null}
        onClose={() => setConfirmando(null)}
        title={t("Apagar de vez?")}
      >
        <p className="an-t-corpo">
          {t("A página e as subpáginas dela serão apagadas para sempre. Não dá para desfazer.")}
        </p>
        <Botao
          variant="danger"
          size="lg"
          block
          onClick={() => {
            if (confirmando) aoApagarDeVez(confirmando.id);
            setConfirmando(null);
          }}
          data-testid="confirmar-apagar"
        >
          {t("Apagar de vez")}
        </Botao>
        <Botao variant="ghost" block onClick={() => setConfirmando(null)}>
          {t("Cancelar")}
        </Botao>
      </Folha>
    </div>
  );
}
