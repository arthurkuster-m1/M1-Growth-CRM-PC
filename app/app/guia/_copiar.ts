import { apiClient } from "@/lib/api/client";
import type { TamanhoDoDossie } from "@/lib/guia/dossie";

export interface DossieDaApi {
  markdown: string;
  caracteres: number;
  tokensAproximados: number;
  tamanho: TamanhoDoDossie;
  geradoEm: string;
  empresa: string;
}

/** Gera o Dossiê da empresa ativa (cada chamada é registrada na auditoria). */
export async function buscarDossie(
  tamanho: TamanhoDoDossie,
  pergunta?: string,
): Promise<DossieDaApi> {
  const q = new URLSearchParams({ tamanho });
  if (pergunta?.trim()) q.set("pergunta", pergunta.trim());
  return (await apiClient.get<{ data: DossieDaApi }>(`/api/v1/guia/dossie?${q.toString()}`)).data;
}

/** Copia para a área de transferência; `false` se o navegador recusar. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/** Baixa um texto como arquivo `.md`. */
export function baixarMarkdown(nome: string, texto: string): void {
  const url = URL.createObjectURL(new Blob([texto], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** "Clínica Sorriso Ltda." → "clinica-sorriso-ltda" (para o nome do arquivo). */
export function nomeParaArquivo(nome: string): string {
  return (
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "empresa"
  );
}
