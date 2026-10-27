import * as React from "react";

/**
 * AS HORAS QUE A GRADE DA AGENDA DESENHA — uma preferência de quem olha (por navegador).
 *
 * `primeira` e `ultima` são horas CHEIAS e inclusivas: 8 e 16 desenham de 08:00 a 17:00 (a última
 * linha é a das 16h às 17h). Fora desse trecho a grade só abre espaço quando há compromisso (ver
 * `janelaComCompromissos`); o resto da rotina — madrugada, noite — não ocupa a tela.
 */
export interface JanelaDaGrade {
  primeira: number;
  ultima: number;
}

export const JANELA_PADRAO: JanelaDaGrade = { primeira: 7, ultima: 21 };
export const CHAVE_DA_JANELA = "m1.agenda.horas";
const EVENTO = "m1:agenda-horas";

/** Lê o que está guardado; lixo ou intervalo invertido volta ao padrão. */
export function lerJanela(bruto: unknown): JanelaDaGrade {
  if (!bruto || typeof bruto !== "object") return JANELA_PADRAO;
  const { primeira, ultima } = bruto as Record<string, unknown>;
  const ok = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 23;
  if (!ok(primeira) || !ok(ultima) || ultima < primeira) return JANELA_PADRAO;
  return { primeira, ultima };
}

let guardado: { texto: string | null; janela: JanelaDaGrade } = {
  texto: null,
  janela: JANELA_PADRAO,
};

function snapshot(): JanelaDaGrade {
  let texto: string | null = null;
  try {
    texto = window.localStorage.getItem(CHAVE_DA_JANELA);
  } catch {
    /* sem armazenamento: vale o padrão */
  }
  if (texto !== guardado.texto) {
    let janela = JANELA_PADRAO;
    if (texto) {
      try {
        janela = lerJanela(JSON.parse(texto));
      } catch {
        /* guardado torto: padrão */
      }
    }
    guardado = { texto, janela };
  }
  return guardado.janela;
}

function assinar(aviso: () => void): () => void {
  window.addEventListener(EVENTO, aviso);
  window.addEventListener("storage", aviso);
  return () => {
    window.removeEventListener(EVENTO, aviso);
    window.removeEventListener("storage", aviso);
  };
}

/** A janela em vigor neste navegador. Muda na hora em todo lugar que a lê (a grade e as configurações). */
export function useJanelaDaGrade(): [JanelaDaGrade, (j: JanelaDaGrade) => void] {
  const janela = React.useSyncExternalStore(assinar, snapshot, () => JANELA_PADRAO);
  const gravar = React.useCallback((j: JanelaDaGrade) => {
    try {
      window.localStorage.setItem(CHAVE_DA_JANELA, JSON.stringify(j));
    } catch {
      /* o navegador pode bloquear: vale só até recarregar */
    }
    window.dispatchEvent(new Event(EVENTO));
  }, []);
  return [janela, gravar];
}

/**
 * A janela com o que for preciso para caber todo compromisso do período: se há reunião às 18:30 e a
 * janela acaba às 17h, a grade se estende até as 19h só para ela. Ocupação do Google (que não é
 * compromisso nosso) e compromisso cancelado não puxam a janela.
 */
export function janelaComCompromissos(
  base: JanelaDaGrade,
  compromissos: Array<{ comeca: string; termina: string; origem: string; situacao: string }>,
  horaMinutoNoFuso: (d: Date) => { hora: number; minuto: number },
): JanelaDaGrade {
  let { primeira, ultima } = base;
  for (const c of compromissos) {
    if (c.origem === "google_sync" || c.situacao === "cancelled") continue;
    const ini = horaMinutoNoFuso(new Date(c.comeca));
    const fim = horaMinutoNoFuso(new Date(c.termina));
    const duracaoMin = (Date.parse(c.termina) - Date.parse(c.comeca)) / 60_000;
    const atravessaAMeiaNoite = fim.hora * 60 + fim.minuto <= ini.hora * 60 + ini.minuto || duracaoMin >= 24 * 60;
    primeira = Math.min(primeira, ini.hora);
    const ultimaDoCompromisso = atravessaAMeiaNoite
      ? 23
      : fim.minuto === 0
        ? Math.max(ini.hora, fim.hora - 1)
        : fim.hora;
    ultima = Math.max(ultima, Math.min(23, ultimaDoCompromisso));
  }
  return { primeira, ultima };
}
