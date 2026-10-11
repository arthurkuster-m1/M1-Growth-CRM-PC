/**
 * Memória de curtíssima duração para o que `loadAuthUser` pergunta ao banco a cada requisição
 * (administrador da plataforma, vínculos com empresas, contexto de suporte).
 *
 * Por quê: cada tela e cada chamada de API repetia as mesmas três consultas — medido no
 * Supabase em 24 h: ~3.700 chamadas de cada uma. Isso enche o "Log Ingestion" do plano gratuito
 * e custa tempo. Vinte segundos de memória cortam a repetição sem mudar nenhuma regra: papel
 * de verdade (`fn_user_role_in_org`) continua indo ao banco em toda escrita.
 *
 * Escopo: memória do próprio processo (`next start` roda um só). Troca de empresa, entrada e
 * saída do modo suporte chamam `esquecerDoUsuario` para valer na hora.
 * Nos testes fica desligado, para um teste não herdar o dado do outro.
 */

const VALIDADE_MS = 20_000;
const LIMITE = 500;

type Guardado = { ate: number; valor: unknown };
const memoria = new Map<string, Guardado>();

const desligado = () => process.env.NODE_ENV === "test" || process.env.VITEST === "true";

export async function lembrarPorUsuario<T>(
  userId: string,
  parte: string,
  buscar: () => Promise<T>,
  valeGuardar: (valor: T) => boolean = () => true,
): Promise<T> {
  if (desligado()) return buscar();
  const chave = `${userId}:${parte}`;
  const agora = Date.now();
  const achado = memoria.get(chave);
  if (achado && achado.ate > agora) return achado.valor as T;
  const valor = await buscar();
  if (valeGuardar(valor)) {
    if (memoria.size >= LIMITE) {
      for (const [k, v] of memoria) if (v.ate <= agora) memoria.delete(k);
      if (memoria.size >= LIMITE) memoria.clear();
    }
    memoria.set(chave, { ate: agora + VALIDADE_MS, valor });
  }
  return valor;
}

export function esquecerDoUsuario(userId: string): void {
  const prefixo = `${userId}:`;
  for (const k of memoria.keys()) if (k.startsWith(prefixo)) memoria.delete(k);
}
