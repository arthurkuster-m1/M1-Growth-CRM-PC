/**
 * DATA E HORÁRIO DE ENTRADA do lead na importação: quando a pessoa realmente chegou (captou o
 * lead), não quando a planilha foi colada. Puro: lê o texto das duas colunas e devolve um
 * instante (ISO, fuso de Brasília), ou o motivo de não ter entendido.
 *
 * Aceita a data como DD/MM/AAAA ou AAAA-MM-DD (e DD/MM/AA), com o horário na mesma célula
 * ("16/11/2026 14:30") ou na coluna de horário (HH:MM ou HH:MM:SS). Sem horário = 00:00.
 */
const FUSO = "-03:00";

const ehDataReal = (a: number, m: number, d: number) => {
  const x = new Date(Date.UTC(a, m - 1, d));
  return x.getUTCFullYear() === a && x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
};

const dois = (n: number) => String(n).padStart(2, "0");

/** A parte da data de um texto → "AAAA-MM-DD" (ou null). */
function lerData(texto: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (iso) return ehDataReal(+iso[1]!, +iso[2]!, +iso[3]!) ? texto : null;
  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(texto);
  if (!br) return null;
  const ano = br[3]!.length === 2 ? 2000 + +br[3]! : +br[3]!;
  return ehDataReal(ano, +br[2]!, +br[1]!) ? `${ano}-${dois(+br[2]!)}-${dois(+br[1]!)}` : null;
}

/** A parte do horário → "HH:MM:SS" (ou null). */
function lerHora(texto: string): string | null {
  const m = /^(\d{1,2})(?:[:h](\d{2}))?(?::(\d{2}))?$/i.exec(texto.replace(/\s+/g, ""));
  if (!m) return null;
  const h = +m[1]!;
  const min = m[2] ? +m[2] : 0;
  const s = m[3] ? +m[3] : 0;
  if (h > 23 || min > 59 || s > 59) return null;
  return `${dois(h)}:${dois(min)}:${dois(s)}`;
}

export type EntradaDoLead =
  | { ok: true; iso: string | null; data: string | null; hora: string | null }
  | { ok: false; motivo: string; valor: string; dica: string };

/**
 * `agora` só existe para o teste: data no futuro (mais de um dia à frente) é quase sempre
 * dia e mês trocados, e o lead não pode "chegar amanhã".
 */
export function lerEntradaDoLead(
  dataTexto: string,
  horaTexto: string,
  agora: number = Date.now(),
): EntradaDoLead {
  let d = dataTexto.trim();
  let h = horaTexto.trim();
  if (d === "" && h === "") return { ok: true, iso: null, data: null, hora: null };

  // "16/11/2026 14:30" na própria célula da data.
  const junto = /^(\S+)\s+(\d{1,2}(?:[:h]\d{2}(?::\d{2})?)?)$/i.exec(d);
  if (junto) {
    d = junto[1]!;
    if (h === "") h = junto[2]!;
  }
  if (d === "") return { ok: false, motivo: "horário sem data de entrada", valor: "", dica: "" };
  const data = lerData(d);
  if (!data)
    return {
      ok: false,
      motivo: "data de entrada não reconhecida",
      valor: dataTexto.trim(),
      dica: "DD/MM/AAAA",
    };
  let hora = "00:00:00";
  if (h !== "") {
    const lida = lerHora(h);
    if (!lida)
      return {
        ok: false,
        motivo: "horário não reconhecido",
        valor: horaTexto.trim(),
        dica: "HH:MM",
      };
    hora = lida;
  }
  const iso = `${data}T${hora}${FUSO}`;
  if (new Date(iso).getTime() > agora + 24 * 3600_000) {
    return { ok: false, motivo: "data de entrada no futuro", valor: dataTexto.trim(), dica: "" };
  }
  return { ok: true, iso, data, hora: h === "" ? null : hora.slice(0, 5) };
}

/** "2026-11-16T14:30:00-03:00" → "16/11/2026 14:30" (para mostrar na revisão). */
export function entradaPorExtenso(data: string, hora: string | null): string {
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a}${hora ? ` ${hora}` : ""}`;
}
