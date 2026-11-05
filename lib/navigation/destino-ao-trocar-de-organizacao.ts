const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * A porta de entrada de uma empresa: `/app` redireciona para a primeira tela liberada DAQUELA empresa
 * (`homeDaInterface`) — o Início, ou o que ela tiver escolhido quando o Início não está nas áreas
 * de trabalho dela. Antes era `/app/inbox` fixo: a pessoa caía na Inbox ao voltar do Modo agência.
 */
const PADRAO = "/app";

/**
 * Para onde ir ao trocar de organização: a MESMA página em que a pessoa estava.
 * Ficam de fora o Modo agência (não existe na outra organização) e qualquer rota com um id no caminho
 * (a ficha de um lead de um cliente não existe no outro): ali volta-se à lista, o trecho antes do id.
 * Fora de `/app` (o painel `/admin` é Modo agência), ou sem rota, cai no Início da empresa.
 */
export function destinoAoTrocarDeOrganizacao(pathname: string | null | undefined): string {
  if (!pathname || !pathname.startsWith("/app")) return PADRAO;
  if (pathname === "/app" || pathname === "/app/") return PADRAO;
  if (pathname === "/app/agencia" || pathname.startsWith("/app/agencia/")) return PADRAO;
  const partes = pathname.split("/").filter(Boolean);
  const iId = partes.findIndex((p) => UUID.test(p));
  const final = iId === -1 ? partes : partes.slice(0, iId);
  return final.length > 1 ? `/${final.join("/")}` : PADRAO;
}
