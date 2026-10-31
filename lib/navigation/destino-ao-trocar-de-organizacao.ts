const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PADRAO = "/app/inbox";

/**
 * Para onde ir ao trocar de organização: a MESMA página em que a pessoa estava.
 * Ficam de fora o Modo agência (não existe na outra organização) e qualquer rota com um id no caminho
 * (a ficha de um lead de um cliente não existe no outro): ali volta-se à lista, o trecho antes do id.
 * Fora de `/app`, ou sem rota, cai na Inbox.
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
