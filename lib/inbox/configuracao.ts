/**
 * AS CONFIGURAÇÕES DO INBOX da organização, guardadas em `organizations.settings.inbox`:
 *
 *   numeros          nome e cor que a equipe deu a cada número de WhatsApp (por id do canal)
 *   categorias_ocultas / tags_ocultas   o que NÃO aparece no filtro de tags do inbox
 *
 * O padrão de tudo é "mostrar tudo" — configuração ausente não esconde nada. A leitura nunca
 * lança: lixo no JSON vira o padrão.
 */
import { chaveDaEtiqueta, normalizarCorDeEtiqueta } from "@/lib/tags/cor-da-etiqueta";

export interface NumeroDoInbox {
  nome?: string;
  cor?: string;
}

export interface ConfigDoInbox {
  numeros: Record<string, NumeroDoInbox>;
  categorias_ocultas: string[];
  tags_ocultas: string[];
}

export const CONFIG_DO_INBOX_VAZIA: ConfigDoInbox = {
  numeros: {},
  categorias_ocultas: [],
  tags_ocultas: [],
};

/** Cores sugeridas ao nomear um número (as mesmas tintas das categorias de tag). */
export const CORES_DOS_NUMEROS = [
  "#3e63dd",
  "#00655a",
  "#cf3716",
  "#ab4aba",
  "#d9822b",
  "#2f8f4e",
  "#0e7c9a",
  "#6b7280",
] as const;

function listaDeTexto(valor: unknown, max: number): string[] {
  if (!Array.isArray(valor)) return [];
  return [...new Set(valor.filter((v): v is string => typeof v === "string" && v.length > 0))]
    .map((v) => v.slice(0, 80))
    .slice(0, max);
}

export function lerConfigDoInbox(settings: unknown): ConfigDoInbox {
  const bruto =
    settings && typeof settings === "object"
      ? ((settings as Record<string, unknown>).inbox as Record<string, unknown> | undefined)
      : undefined;
  if (!bruto || typeof bruto !== "object") return { ...CONFIG_DO_INBOX_VAZIA, numeros: {} };
  const numeros: Record<string, NumeroDoInbox> = {};
  if (bruto.numeros && typeof bruto.numeros === "object") {
    for (const [id, v] of Object.entries(bruto.numeros as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const nome =
        typeof (v as NumeroDoInbox).nome === "string"
          ? (v as NumeroDoInbox).nome!.trim().slice(0, 40)
          : "";
      const cor = normalizarCorDeEtiqueta((v as NumeroDoInbox).cor) ?? undefined;
      if (nome || cor) numeros[id] = { ...(nome ? { nome } : {}), ...(cor ? { cor } : {}) };
    }
  }
  return {
    numeros,
    categorias_ocultas: listaDeTexto(bruto.categorias_ocultas, 60),
    tags_ocultas: listaDeTexto(bruto.tags_ocultas, 500).map(chaveDaEtiqueta),
  };
}

/** O nome do número na tela: o que a equipe escreveu, senão o rótulo de fábrica. */
export function nomeDoNumero(
  config: ConfigDoInbox | undefined,
  id: string,
  padrao: string,
): string {
  return config?.numeros[id]?.nome || padrao;
}
