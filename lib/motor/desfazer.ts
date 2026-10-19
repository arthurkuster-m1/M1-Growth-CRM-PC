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

/**
 * Começa a desfazer a última edição e devolve NA HORA a entrada e a promessa do fim. A tela já
 * mudou quando `desfazer` volta (as edições são otimistas); `concluido` só confirma o servidor.
 * `null` se não havia nada.
 */
export function iniciarDesfazer(): { entrada: EntradaDeDesfazer; concluido: Promise<void> } | null {
  const entrada = pilha.pop();
  if (!entrada) return null;
  // A marca fica de pé até o servidor confirmar: o desfazer pode registrar edições em
  // `onSuccess` (ex.: recriar uma linha apagada), e isso não é uma edição nova da pessoa.
  desfazendo = true;
  let rodando: Promise<unknown>;
  try {
    rodando = Promise.resolve(entrada.desfazer());
  } catch (e) {
    rodando = Promise.reject(e);
  }
  const concluido = rodando.then(
    () => {
      desfazendo = false;
    },
    (e) => {
      desfazendo = false;
      throw e;
    },
  );
  return { entrada, concluido };
}

/** Desfaz a última edição e espera o servidor. Devolve a entrada, ou `null` se não havia nada. */
export async function desfazerUltimo(): Promise<EntradaDeDesfazer | null> {
  const r = iniciarDesfazer();
  if (!r) return null;
  await r.concluido;
  return r.entrada;
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
