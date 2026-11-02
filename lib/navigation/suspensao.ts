/**
 * SUSPENSÃO DA ÁREA DE IA (Agentes de IA) — decisão do Arthur em 02/11/2026.
 *
 * Tudo o que é de agente de IA fica ESCONDIDO até a próxima atualização do app: sai do menu, do hub e da
 * busca, e as rotas `/app/ai/*` redirecionam. Nada é apagado: o código, as tabelas e as rotas de API
 * continuam, e voltar é trocar `IA_SUSPENSA` para `false`. Ficam de pé as duas portas que NÃO são de agente:
 *
 *  - `/app/ai/inbox` — a Central de Avisos (Alertas), usada por avisos do sistema (parcelas vencidas etc.);
 *  - `/app/ai/followups` — os follow-ups, que a Central de Automações lista (frente 19).
 */
export const IA_SUSPENSA = process.env.M1_IA_SUSPENSA !== "false";

const RAIZ_DA_IA = "/app/ai";
const MANTIDAS = ["/app/ai/inbox", "/app/ai/followups"] as const;

function dentroDe(caminho: string, base: string): boolean {
  return caminho === base || caminho.startsWith(`${base}/`);
}

/** O caminho (rota ou href de menu) é de IA e está suspenso? */
export function caminhoDeIaSuspenso(caminho: string, suspensa: boolean = IA_SUSPENSA): boolean {
  if (!suspensa) return false;
  const puro = caminho.split(/[?#]/)[0] ?? caminho;
  if (!dentroDe(puro, RAIZ_DA_IA)) return false;
  return !MANTIDAS.some((m) => dentroDe(puro, m));
}

/**
 * Enquanto a IA está suspensa, as duas portas mantidas (Alertas e Follow-ups) moram no grupo Atendimento:
 * o grupo "Agente de IA" fica sem nada para mostrar. Devolve o destino com o grupo trocado, ou o mesmo.
 */
export function comGrupoDaSuspensao<T extends { href: string; group: string; section?: string }>(
  d: T,
  suspensa: boolean = IA_SUSPENSA,
): T {
  if (!suspensa) return d;
  const puro = d.href.split(/[?#]/)[0] ?? d.href;
  if (!MANTIDAS.some((m) => dentroDe(puro, m))) return d;
  return { ...d, group: "atendimento", section: "Acompanhar" };
}
