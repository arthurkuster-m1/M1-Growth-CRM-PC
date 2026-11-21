/** Busca por texto sem acento nem maiúsculas ("sau" acha "Saúde"). */
export const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Filtra mantendo a ordem em que as opções foram dadas (a ordem que a pessoa escolheu), mas põe antes
 * as que COMEÇAM com o texto (ou com uma palavra dele) e depois as que apenas o contêm.
 */
export function filtrarOpcoes<T extends { label: string }>(opcoes: T[], texto: string): T[] {
  const q = semAcento(texto).trim();
  if (!q) return opcoes;
  const comeca: T[] = [],
    contem: T[] = [];
  for (const o of opcoes) {
    const l = semAcento(o.label);
    if (l.startsWith(q) || l.split(/[\s\-/|()]+/).some((p) => p.startsWith(q))) comeca.push(o);
    else if (l.includes(q)) contem.push(o);
  }
  return [...comeca, ...contem];
}

/** Divide o rótulo em [antes, trecho achado, depois] para destacar o que a pessoa digitou. */
export function destacar(label: string, texto: string): [string, string, string] {
  const q = semAcento(texto).trim();
  if (!q) return [label, "", ""];
  // mapeia cada caractere do original ao normalizado (acentos não mudam o tamanho aqui)
  const norm = [...label].map((c) => semAcento(c));
  const plano = norm.join("");
  const i = plano.indexOf(q);
  if (i < 0) return [label, "", ""];
  let pos = 0,
    ini = 0,
    fim = label.length;
  const chars = [...label];
  for (let k = 0; k < chars.length; k++) {
    if (pos === i) ini = k;
    pos += norm[k]!.length;
    if (pos >= i + q.length && fim === label.length && pos > i) {
      fim = k + 1;
      break;
    }
  }
  return [chars.slice(0, ini).join(""), chars.slice(ini, fim).join(""), chars.slice(fim).join("")];
}

/** Já existe uma opção com exatamente esse texto (ignorando acento, maiúsculas e espaços nas pontas)? */
export function existeIgual(opcoes: { label: string }[], texto: string): boolean {
  const q = semAcento(texto.trim());
  return q !== "" && opcoes.some((o) => semAcento(o.label.trim()) === q);
}
