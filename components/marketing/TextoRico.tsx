import { Fragment } from "react";

import { trechosDoTexto } from "@/lib/marketing/texto-rico";

/** Desenha um texto com `**negrito**` e `*itálico*` como negrito e itálico de verdade. */
export function TextoRico({ texto }: { texto: string }) {
  const trechos = trechosDoTexto(texto);
  if (trechos.every((t) => !t.negrito && !t.italico)) return <>{texto}</>;
  return (
    <>
      {trechos.map((t, i) => {
        let no = <Fragment key={i}>{t.texto}</Fragment>;
        if (t.italico) no = <em key={i}>{no}</em>;
        if (t.negrito) no = <strong key={i}>{no}</strong>;
        return no;
      })}
    </>
  );
}
