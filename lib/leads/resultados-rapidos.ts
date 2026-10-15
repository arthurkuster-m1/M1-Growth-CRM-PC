/**
 * OS RESULTADOS RÁPIDOS da ligação (prospecção): um clique registra a ação na linha do tempo da
 * oportunidade e já define o próximo passo (cadência). Vocabulário puro, usado pela tela.
 *
 * `diasUteis`: o próximo passo vence em N dias úteis (0 = hoje). `pedeData`: a pessoa escolhe a
 * data. `perde`: encerra a oportunidade como perdida (pede o motivo).
 */
export const RESULTADOS_RAPIDOS = [
  {
    id: "nao_atendeu",
    rotulo: "Não atendeu",
    resultado: "Não atendeu",
    proximo: "Tentar ligar de novo",
    diasUteis: 1,
  },
  {
    id: "caixa_postal",
    rotulo: "Caixa postal",
    resultado: "Caixa postal",
    proximo: "Tentar ligar de novo",
    diasUteis: 1,
  },
  {
    id: "numero_errado",
    rotulo: "Número errado",
    resultado: "Número errado",
    proximo: "Conferir o telefone do lead",
    diasUteis: 0,
  },
  {
    id: "conversa",
    rotulo: "Falei com o lead",
    resultado: "Atendeu — conversa positiva",
    proximo: "Seguir o combinado na conversa",
    diasUteis: 1,
  },
  {
    id: "retornar",
    rotulo: "Pediu retorno",
    resultado: "Atendeu — pediu para retornar",
    proximo: "Retornar a ligação",
    pedeData: true,
  },
  {
    id: "sem_interesse",
    rotulo: "Sem interesse",
    resultado: "Atendeu — sem interesse",
    perde: true,
  },
] as const;

export type IdDoResultadoRapido = (typeof RESULTADOS_RAPIDOS)[number]["id"];

/** Soma N dias úteis (sáb e dom não contam) a uma data `AAAA-MM-DD`. */
export function somarDiasUteis(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  let falta = Math.max(0, Math.round(n));
  while (falta > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) falta -= 1;
  }
  // Dia 0 caindo no fim de semana vai para segunda.
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * A FILA DO DIA: oportunidade aberta cuja próxima ação venceu (ou é hoje) ou, sem próxima ação
 * marcada, sem resposta há 24h ou mais. `prioridade` menor = mais urgente (mais atrasada primeiro).
 */
export function prioridadeDaFila(
  p: {
    status: string;
    proxima_acao_em: string | null;
    ultima_atividade: string | null;
    criado_em: string;
  },
  hoje: string,
  agoraMs: number,
): number | null {
  if (p.status !== "open") return null;
  if (p.proxima_acao_em) {
    if (p.proxima_acao_em > hoje) return null;
    // Vencidas antes: quanto mais antiga a data, menor o número.
    return Date.parse(`${p.proxima_acao_em}T00:00:00Z`) / 86_400_000;
  }
  const horas = (agoraMs - new Date(p.ultima_atividade ?? p.criado_em).getTime()) / 3_600_000;
  if (horas < 24) return null;
  // Sem data marcada vem depois das vencidas, e a mais parada primeiro.
  return 1_000_000 - horas;
}
