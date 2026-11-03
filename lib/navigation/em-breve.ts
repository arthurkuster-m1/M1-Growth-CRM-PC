/**
 * As áreas marcadas "EM BREVE" no menu (decisão do Arthur, 03/11/2026): ainda não fazem parte do que a
 * operação usa hoje. A marca é só de apresentação (um selo no menu e uma faixa na página); a página
 * continua abrindo, exceto a de Agente de IA, que é um aviso.
 */
export const ROTAS_EM_BREVE = ["/app/automacoes", "/app/financas", "/app/ai"] as const;

export function ehEmBreve(href: string): boolean {
  const puro = href.split(/[?#]/)[0] ?? href;
  return ROTAS_EM_BREVE.some((r) => puro === r);
}
