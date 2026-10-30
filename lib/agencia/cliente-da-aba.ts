/**
 * O CLIENTE QUE A TELA DO MODO AGÊNCIA ESTÁ EDITANDO AGORA — do lado do navegador.
 *
 * Quando a agência abre o cronograma de outro cliente SEM trocar de organização, o `apiClient` carimba
 * `X-Agencia-Cliente` nas chamadas do cronograma, e o servidor (`autorizarCronograma`) reconfere o
 * direito da pessoa sobre aquele cliente antes de usar o id. O header só vale para esta família de
 * rotas; fora dela, nada muda.
 *
 * O valor é limpo ao sair da tela do modo agência (`ClienteDaAgenciaProvider`).
 */
export const HEADER_CLIENTE_DA_AGENCIA = "X-Agencia-Cliente";
/** As famílias de rota que sabem atender "outro cliente" (todas passam por `clienteDaRequisicao`). */
export const PREFIXOS_COM_CLIENTE_DA_AGENCIA = [
  "/api/v1/marketing/cronograma",
  "/api/v1/dashboards",
  "/api/v1/demand-campaigns",
] as const;

let atual: string | null = null;

export const definirClienteDaAgencia = (id: string | null): void => {
  atual = id;
};

/**
 * Libera o cliente SÓ se ainda for o `id` dado. Ao trocar de cliente, o provedor novo define o seu id
 * ANTES de o antigo desmontar; limpar sem conferir apagaria o id novo e as chamadas seguintes sairiam
 * sem cliente (e voltariam os dados da empresa da sessão).
 */
export const liberarClienteDaAgencia = (id: string): void => {
  if (atual === id) atual = null;
};

/** O header a carimbar numa chamada a `url`, ou `null` quando não se aplica. */
export const clienteDaAgenciaParaUrl = (url: string): string | null =>
  atual && PREFIXOS_COM_CLIENTE_DA_AGENCIA.some((p) => url.startsWith(p)) ? atual : null;
