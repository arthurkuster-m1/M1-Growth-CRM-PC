import { NOME_DE_IMAGEM } from "@/lib/marketing/blocos";

/**
 * As IMAGENS das páginas de Marketing (prints, fotos, logos do cliente).
 *
 * Moram num bucket PRIVADO (o repositório só admite um bucket público — o dos logos), no
 * caminho `<empresa>/<uuid>.<png|jpg>`. A página guarda só o NOME do arquivo; a empresa vem da
 * sessão (painel) ou do link (público), e quem serve a imagem é uma rota nossa. Por isso nem o
 * cliente nem um link de outra empresa alcançam o arquivo de uma terceira.
 */
export const BUCKET_DE_IMAGENS = "marketing-images";
export const TAMANHO_MAXIMO_DA_IMAGEM = 5 * 1024 * 1024;

export { NOME_DE_IMAGEM };

export function nomeDeImagemValido(nome: string): boolean {
  return NOME_DE_IMAGEM.test(nome);
}

export function caminhoDaImagem(orgId: string, nome: string): string {
  return `${orgId}/${nome}`;
}

/** Onde o painel logado pede a imagem (a empresa vem da sessão). */
export const BASE_DAS_IMAGENS_DO_PAINEL = "/api/v1/marketing/imagens/";

/** Onde o link público pede a imagem. */
export function baseDasImagensDoLink(token: string): string {
  return `/p/${token}/img/`;
}

export function mimeDaImagem(nome: string): "image/png" | "image/jpeg" {
  return nome.endsWith(".png") ? "image/png" : "image/jpeg";
}
