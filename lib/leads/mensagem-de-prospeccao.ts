/**
 * MENSAGEM PRONTA de prospecção: o modelo de mensagem (os mesmos de Modelos de mensagem do Inbox)
 * com variáveis trocadas pelos dados da oportunidade. Aceita {nome} e {{nome}}.
 *
 * Variáveis: nome, primeiro_nome, produto, campanha, responsavel.
 */
export interface DadosDaMensagem {
  nome: string;
  produto?: string | null;
  campanha?: string | null;
  responsavel?: string | null;
}

export const VARIAVEIS_DA_MENSAGEM = [
  "nome",
  "primeiro_nome",
  "produto",
  "campanha",
  "responsavel",
] as const;

export function aplicarVariaveis(texto: string, d: DadosDaMensagem): string {
  const nome = d.nome.trim();
  const valores: Record<string, string> = {
    nome,
    primeiro_nome: nome.split(/\s+/)[0] ?? "",
    produto: d.produto?.trim() ?? "",
    campanha: d.campanha?.trim() ?? "",
    responsavel: d.responsavel?.trim() ?? "",
  };
  return texto.replace(/\{\{?\s*([a-z_]+)\s*\}\}?/gi, (inteiro, chave: string) => {
    const k = chave.toLowerCase();
    return k in valores ? (valores[k] ?? "") : inteiro;
  });
}

/** O link do WhatsApp (`wa.me`) já com a mensagem, ou sem ela. */
export function linkDoWhatsapp(telefone: string | null | undefined, mensagem?: string): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  return `https://wa.me/${digitos}${mensagem?.trim() ? `?text=${encodeURIComponent(mensagem.trim())}` : ""}`;
}

/**
 * A MELHOR FAIXA para ligar: a janela de 2h com mais sinais (respostas do lead e ligações
 * atendidas). Exige no mínimo 3 sinais; senão devolve null (sem dado suficiente para sugerir).
 */
export function melhorFaixa(horas: readonly number[]): { faixa: string; base: number } | null {
  if (horas.length < 3) return null;
  const janelas = new Array<number>(12).fill(0);
  for (const h of horas) janelas[Math.floor(((h % 24) + 24) % 24 / 2)]! += 1;
  let melhor = 0;
  for (let i = 1; i < janelas.length; i += 1) if (janelas[i]! > janelas[melhor]!) melhor = i;
  if (janelas[melhor]! < 2) return null;
  return { faixa: `${melhor * 2}h–${melhor * 2 + 2}h`, base: horas.length };
}
