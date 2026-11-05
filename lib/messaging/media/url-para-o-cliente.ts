/**
 * O que a API entrega ao navegador no campo `media_url` de uma mensagem.
 *
 * No banco, `media_url` guarda o endereço que o WAHA anunciou no webhook — algo como
 * `http://localhost:3000/api/files/…`, o endereço INTERNO do contêiner. O servidor precisa dele
 * (o worker de persistência e a rota de mídia reaproveitam só o caminho, sobre a base configurada),
 * então a coluna não muda. Mas o navegador não tem o que fazer com um endereço interno, e entregá-lo
 * mostra a topologia da VPS a qualquer usuário (e quebra se alguém tentar abri-lo).
 *
 * Para o cliente, a mídia tem UM endereço: a rota autenticada que a serve
 * (`/api/v1/messages/[id]/media`, que redireciona para a URL assinada do Storage). O campo continua
 * "preenchido quando há mídia", que é só o que a tela lê (`hasMedia`).
 */
export function urlDaMidiaParaOCliente(m: {
  id: string;
  media_url: string | null;
  media_storage_path: string | null;
}): string | null {
  if (!m.media_url && !m.media_storage_path) return null;
  return `/api/v1/messages/${m.id}/media`;
}

/** Troca `media_url` pela forma segura, sem tocar nos demais campos. */
export function comMidiaParaOCliente<
  T extends { id: string; media_url: string | null; media_storage_path: string | null },
>(m: T): T {
  if (!m.media_url) return m;
  return { ...m, media_url: urlDaMidiaParaOCliente(m) };
}
