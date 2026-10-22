/**
 * O CÂMBIO do custo das extrações: a extração é cobrada em dólar (`cost_usd`) e o dashboard fala
 * real. Conta: dólar × cotação × (1 + IOF). O IOF padrão é o do cartão internacional (3,5%), e a
 * empresa pode mudar a alíquota e, se a cotação automática estiver fora do ar, informar a sua.
 */
export const IOF_PADRAO_PCT = 3.5;

export interface Cambio {
  /** Reais por dólar; `null` quando não há como saber (nem automática, nem informada). */
  taxa: number | null;
  origem: "automatica" | "manual" | "indisponivel";
  iofPct: number;
}

/** Lê o câmbio guardado em `organizations.settings.dashboards.cambio` (nunca lança). */
export function lerCambioGuardado(settings: unknown): { usdBrl: number | null; iofPct: number } {
  const c = (
    settings as { dashboards?: { cambio?: { usd_brl?: unknown; iof_pct?: unknown } } } | null
  )?.dashboards?.cambio;
  const usd = Number(c?.usd_brl);
  const iof = Number(c?.iof_pct);
  return {
    usdBrl: Number.isFinite(usd) && usd > 0 ? usd : null,
    iofPct: Number.isFinite(iof) && iof >= 0 && iof <= 30 ? iof : IOF_PADRAO_PCT,
  };
}

/** Dólares em reais, já com o IOF. `null` sem cotação. */
export function dolarEmReais(usd: number, cambio: Cambio): number | null {
  if (cambio.taxa === null) return null;
  return Math.round(usd * cambio.taxa * (1 + cambio.iofPct / 100) * 100) / 100;
}

let guardada: { taxa: number; em: number } | null = null;
const SEIS_HORAS = 6 * 60 * 60 * 1000;

/** A cotação do dia (AwesomeAPI), guardada por 6 horas; `null` se a rede ou o serviço falharem. */
export async function cotacaoAutomatica(): Promise<number | null> {
  if (guardada && Date.now() - guardada.em < SEIS_HORAS) return guardada.taxa;
  try {
    const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!r.ok) return guardada?.taxa ?? null;
    const j = (await r.json()) as { USDBRL?: { bid?: string } };
    const taxa = Number(j.USDBRL?.bid);
    if (!Number.isFinite(taxa) || taxa <= 0) return guardada?.taxa ?? null;
    guardada = { taxa, em: Date.now() };
    return taxa;
  } catch {
    return guardada?.taxa ?? null;
  }
}

/** A cotação automática; se falhar, a informada pela empresa. */
export async function resolverCambio(settings: unknown): Promise<Cambio> {
  const g = lerCambioGuardado(settings);
  const auto = await cotacaoAutomatica();
  if (auto !== null) return { taxa: auto, origem: "automatica", iofPct: g.iofPct };
  if (g.usdBrl !== null) return { taxa: g.usdBrl, origem: "manual", iofPct: g.iofPct };
  return { taxa: null, origem: "indisponivel", iofPct: g.iofPct };
}
