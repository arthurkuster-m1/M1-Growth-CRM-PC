/**
 * O QUE UMA PÁGINA EMBUTIDA NO MODO AGÊNCIA PEDE À PÁGINA-MÃE (o quadro avisa por `postMessage`):
 * abrir a campanha numa janela da agência, ou fechar essa janela. Fora de um quadro embutido
 * (`embutidoAtivo` falso) nada disto age e a página navega como sempre.
 */
export const TIPO_ABRIR_NA_AGENCIA = "agencia-abrir";
export const TIPO_FECHAR_JANELA = "agencia-fechar";

let embutidoAtivo = false;
let clienteDoQuadro: string | null = null;

export function marcarEmbutido(clienteId: string): void {
  embutidoAtivo = true;
  clienteDoQuadro = clienteId;
}

const CAMINHO_DA_CAMPANHA = /^\/app\/marketing\/geracao-de-demanda\/campanhas\/[0-9a-f-]{36}\/?$/i;
export const ehCaminhoDeCampanha = (caminho: string): boolean => CAMINHO_DA_CAMPANHA.test(caminho);

/** `true` se o pedido foi entregue à página-mãe (e a página NÃO deve navegar). */
export function pedirAbrirNaAgencia(caminho: string): boolean {
  if (!embutidoAtivo || !clienteDoQuadro || !ehCaminhoDeCampanha(caminho)) return false;
  window.parent.postMessage(
    { tipo: TIPO_ABRIR_NA_AGENCIA, cliente: clienteDoQuadro, caminho },
    window.location.origin,
  );
  return true;
}

/** `true` se o quadro é a janela de uma campanha e pediu à mãe que a feche. */
export function pedirFecharJanela(): boolean {
  if (!embutidoAtivo || !clienteDoQuadro) return false;
  window.parent.postMessage({ tipo: TIPO_FECHAR_JANELA, cliente: clienteDoQuadro }, window.location.origin);
  return true;
}
