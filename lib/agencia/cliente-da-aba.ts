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
export const PREFIXO_COM_CLIENTE_DA_AGENCIA = "/api/v1/marketing/cronograma";

let atual: string | null = null;

export const definirClienteDaAgencia = (id: string | null): void => {
  atual = id;
};

/** O header a carimbar numa chamada a `url`, ou `null` quando não se aplica. */
export const clienteDaAgenciaParaUrl = (url: string): string | null =>
  atual && url.startsWith(PREFIXO_COM_CLIENTE_DA_AGENCIA) ? atual : null;
