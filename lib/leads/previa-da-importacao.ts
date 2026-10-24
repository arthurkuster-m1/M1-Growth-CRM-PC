import type { ErroDaLinha, LinhaDeLead } from "@/lib/leads/planilha";

/**
 * A PRÉVIA da importação: o que vai acontecer com a planilha ANTES de gravar qualquer linha.
 *
 * - `repetidas_na_planilha`: o mesmo telefone (ou, sem telefone, o mesmo e-mail) mais de uma vez —
 *   vira um contato só, então só a primeira conta como pessoa nova;
 * - `ja_no_crm`: a pessoa já é contato da empresa (casada por telefone ou e-mail): entra na
 *   campanha sem duplicar o contato;
 * - `novos`: o que de fato vira contato novo.
 *
 * Pura: quem consulta o banco monta `jaNoCrm` (chaves `tel:<E.164>` e `mail:<minúsculo>`).
 */
export interface PreviaDaImportacao {
  total_linhas: number;
  validas: number;
  invalidas: number;
  repetidas_na_planilha: number;
  ja_no_crm: number;
  novos: number;
  /** As primeiras linhas recusadas, com o número da linha e o motivo. */
  erros: ErroDaLinha[];
  amostra: Array<{ linha: number; titulo: string; telefone: string | null; email: string | null }>;
  colunas_ignoradas: string[];
}

export const chaveDeTelefone = (telefone: string) => `tel:${telefone}`;
export const chaveDeEmail = (email: string) => `mail:${email.trim().toLowerCase()}`;

/** A chave que identifica a PESSOA da linha: telefone primeiro, e-mail na falta dele. */
export function chaveDaPessoa(l: Pick<LinhaDeLead, "telefone" | "email">): string | null {
  if (l.telefone) return chaveDeTelefone(l.telefone);
  if (l.email) return chaveDeEmail(l.email);
  return null;
}

export function previaDaImportacao(
  lido: { leads: LinhaDeLead[]; erros: ErroDaLinha[]; colunasIgnoradas: string[] },
  jaNoCrm: ReadonlySet<string>,
  limiteDeErros = 20,
): PreviaDaImportacao {
  const vistas = new Set<string>();
  let repetidas = 0;
  let existentes = 0;
  let novos = 0;
  for (const l of lido.leads) {
    const chave = chaveDaPessoa(l);
    if (chave === null) {
      // Sem telefone nem e-mail não há com quem casar: é uma pessoa nova.
      novos += 1;
      continue;
    }
    if (vistas.has(chave)) {
      repetidas += 1;
      continue;
    }
    vistas.add(chave);
    if (jaNoCrm.has(chave)) existentes += 1;
    else novos += 1;
  }
  return {
    total_linhas: lido.leads.length + lido.erros.length,
    validas: lido.leads.length,
    invalidas: lido.erros.length,
    repetidas_na_planilha: repetidas,
    ja_no_crm: existentes,
    novos,
    erros: lido.erros.slice(0, limiteDeErros),
    amostra: lido.leads
      .slice(0, 5)
      .map((l) => ({ linha: l.linha, titulo: l.title, telefone: l.telefone, email: l.email })),
    colunas_ignoradas: lido.colunasIgnoradas,
  };
}
