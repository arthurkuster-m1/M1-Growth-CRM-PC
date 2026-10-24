import type { Prospect } from "./schema";

/**
 * QUALIDADE antes de abordar: as regras que decidem se uma empresa encontrada vale a abordagem.
 * Puras — a tela as usa para marcar e desmarcar a fila; quem grava a seleção é o servidor.
 */
export type TipoDeTelefone = "celular" | "fixo";

/**
 * Celular ou fixo, pelo número em E.164 brasileiro (`+55` + DDD + número).
 * WhatsApp só chega em celular: 11 dígitos com o 9 na frente (ou os de 10 dígitos antigos que
 * começam em 6 a 9). Fixo: 10 dígitos que começam em 2 a 5. Sem telefone válido → `null`.
 */
export function tipoDoTelefone(telefone: string | null | undefined): TipoDeTelefone | null {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (!/^55\d{10,11}$/.test(digitos)) return null;
  const nacional = digitos.slice(2);
  const primeiro = nacional[2];
  if (nacional.length === 11) return primeiro === "9" ? "celular" : null;
  return primeiro !== undefined && "2345".includes(primeiro) ? "fixo" : "celular";
}

export interface FiltroDeQualidade {
  /** Nota mínima no Google (0 a 5); `null` = não filtra. */
  notaMinima: number | null;
  /** Mínimo de avaliações; `null` = não filtra. */
  avaliacoesMinimas: number | null;
  soComSite: boolean;
  /** Só quem tem celular (WhatsApp chega). */
  soCelular: boolean;
  /** Só quem a verificação confirmou com WhatsApp (quem não foi verificado não passa). */
  soComWhatsapp: boolean;
  /** Pedaço do nome da categoria ("clínica", "estética"); vazio = qualquer. */
  categoria: string;
}

export const SEM_FILTRO: FiltroDeQualidade = {
  notaMinima: null,
  avaliacoesMinimas: null,
  soComSite: false,
  soCelular: false,
  soComWhatsapp: false,
  categoria: "",
};

export function filtroEstaAtivo(f: FiltroDeQualidade): boolean {
  return (
    f.notaMinima !== null ||
    f.avaliacoesMinimas !== null ||
    f.soComSite ||
    f.soCelular ||
    f.soComWhatsapp ||
    f.categoria.trim() !== ""
  );
}

const semAcento = (x: string) =>
  x
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** A empresa atende a todos os critérios ligados? Quem não tem o dado (nota, site) não atende. */
export function atendeAoFiltro(
  e: Pick<Prospect, "phone" | "website" | "category" | "rating" | "reviews"> & {
    /** O resultado da verificação de WhatsApp da empresa (`exists`, `missing`, `unknown` ou nulo). */
    whatsapp?: string | null;
  },
  f: FiltroDeQualidade,
): boolean {
  if (f.notaMinima !== null && (e.rating === null || e.rating < f.notaMinima)) return false;
  if (f.avaliacoesMinimas !== null && (e.reviews ?? 0) < f.avaliacoesMinimas) return false;
  if (f.soComSite && !(e.website ?? "").trim()) return false;
  if (f.soCelular && tipoDoTelefone(e.phone) !== "celular") return false;
  if (f.soComWhatsapp && e.whatsapp !== "exists") return false;
  const categoria = semAcento(f.categoria.trim());
  if (categoria && !semAcento(e.category ?? "").includes(categoria)) return false;
  return true;
}
