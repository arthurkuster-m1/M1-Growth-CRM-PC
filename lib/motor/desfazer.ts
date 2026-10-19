/**
 * O "DESFAZER" das tabelas estilo Notion (Ctrl+Z / Cmd+Z).
 *
 * Cada tela que grava uma edição de célula registra aqui como VOLTAR atrás (o que estava antes);
 * o atalho (`useAtalhoDesfazer`, montado uma vez no AppShell) desfaz a última, uma por vez.
 * A pilha vive no navegador e zera ao recarregar a página — é um "ops, errei", não um histórico.
 */
export interface EntradaDeDesfazer {
  /** O que foi feito, para o aviso ("Desfeito: Status"). */
  rotulo?: string;
  desfazer: () => Promise<unknown> | unknown;
}

const LIMITE = 50;
const pilha: EntradaDeDesfazer[] = [];
let desfazendo = false;

/** Guarda como desfazer a edição que acabou de ser gravada. Ignorado durante um desfazer. */
export function registrarDesfazer(entrada: EntradaDeDesfazer): void {
  if (desfazendo) return;
  pilha.push(entrada);
  if (pilha.length > LIMITE) pilha.shift();
}

export function podeDesfazer(): boolean {
  return pilha.length > 0;
}

/** Desfaz a última edição. Devolve o rótulo dela, ou `null` se não havia nada. */
export async function desfazerUltimo(): Promise<EntradaDeDesfazer | null> {
  const entrada = pilha.pop();
  if (!entrada) return null;
  desfazendo = true;
  try {
    await entrada.desfazer();
  } finally {
    desfazendo = false;
  }
  return entrada;
}

export function limparDesfazer(): void {
  pilha.length = 0;
}

/** Só as chaves de `patch`, com o valor que `linha` tem agora — o "antes" dessa edição. */
export function valoresAntes<T extends object>(
  linha: T,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const antes: Record<string, unknown> = {};
  for (const chave of Object.keys(patch)) {
    antes[chave] = (linha as Record<string, unknown>)[chave] ?? null;
  }
  return antes;
}
