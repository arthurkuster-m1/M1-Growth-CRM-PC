/**
 * AS AÇÕES que a equipe registra à mão no histórico do cliente (Linha do tempo da ficha).
 * Vocabulário puro, usado pela tela e pela rota.
 *
 * `rotulo` é o TÍTULO que aparece na linha do tempo (no lugar de "Anotação"); `tagPadrao` é a tag
 * sugerida (a pessoa pode trocar ou desmarcar); `exigeTitulo` é a "Outra ação": sem um título
 * dizendo o que foi, não se registra.
 */
export const ACOES_DO_LEAD = [
  { id: "ligacao", rotulo: "Follow Up - Ligação", comResultado: true },
  { id: "mensagem", rotulo: "Follow Up - Mensagem enviada", comResultado: true },
  { id: "email", rotulo: "Follow Up - E-mail", comResultado: true },
  { id: "reuniao", rotulo: "Reunião realizada", comResultado: true },
  { id: "remarcou", rotulo: "Lead remarcou", comResultado: false, tagPadrao: "Remarcou" },
  { id: "no_show", rotulo: "No Show", comResultado: false, tagPadrao: "No Show" },
  { id: "nao_atendeu", rotulo: "Não atendeu", comResultado: false, tagPadrao: "Não atendeu" },
  { id: "proposta", rotulo: "Proposta enviada", comResultado: false },
  { id: "outro", rotulo: "Outra ação", comResultado: false, exigeTitulo: true },
] as const;

export type IdDaAcao = (typeof ACOES_DO_LEAD)[number]["id"];
export const IDS_DAS_ACOES = ACOES_DO_LEAD.map((a) => a.id) as [IdDaAcao, ...IdDaAcao[]];

/** Ações de abordagem: contam nos dashboards de Prospecção e NÃO se registram sem resultado. */
export const ACOES_DE_ABORDAGEM = ["ligacao", "mensagem", "email"] as const;
export const exigeResultado = (id: string) =>
  (ACOES_DE_ABORDAGEM as readonly string[]).includes(id);

export const RESULTADOS_DA_LIGACAO = [
  "Atendeu — falou com o decisor",
  "Atendeu — não é o decisor",
  "Atendeu — conversa positiva",
  "Atendeu — pediu para retornar",
  "Atendeu — sem interesse",
  "Não atendeu",
  "Caixa postal",
  "Número errado",
] as const;

export const RESULTADOS_DA_MENSAGEM = [
  "Respondeu — falou com o decisor",
  "Respondeu — não é o decisor",
  "Respondeu — conversa positiva",
  "Respondeu — pediu para retornar",
  "Respondeu — sem interesse",
  "Sem resposta",
  "Número ou e-mail inválido",
] as const;

/** Os resultados sugeridos de cada ação (a pessoa ainda pode escrever o seu). */
export function resultadosDaAcao(id: string): readonly string[] {
  return id === "ligacao" ? RESULTADOS_DA_LIGACAO : RESULTADOS_DA_MENSAGEM;
}

/** O título da linha na linha do tempo: o da ação, ou o que a pessoa escreveu em "Outra ação". */
export function tituloDaAcao(id: IdDaAcao, tituloLivre?: string | null): string {
  const acao = ACOES_DO_LEAD.find((a) => a.id === id);
  if (acao && "exigeTitulo" in acao && acao.exigeTitulo) {
    const t = (tituloLivre ?? "").trim();
    if (t) return t.slice(0, 80);
  }
  return acao?.rotulo ?? "Ação registrada";
}

/** O texto de baixo: "Resultado: …" e o comentário, um por linha. Vazio quando não há nenhum. */
export function corpoDaAcao(
  resultado: string | null | undefined,
  comentario: string | null | undefined,
): string {
  const linhas: string[] = [];
  if (resultado && resultado.trim()) linhas.push(`Resultado: ${resultado.trim()}`);
  if (comentario && comentario.trim()) linhas.push(comentario.trim());
  return linhas.join("\n").slice(0, 1000);
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A tag da ação com contador: a primeira vez é "No Show"; a segunda, "No Show: 2x"; e assim por
 * diante. Compara sem diferenciar maiúsculas; mantém o resto das tags como estão.
 */
export function somarTagComContador(tags: readonly string[], base: string): string[] {
  const nome = base.trim().slice(0, 30);
  if (!nome) return [...tags];
  const re = new RegExp(`^${escapar(nome)}(?:: (\\d+)x)?$`, "i");
  let achou = false;
  const saida = tags.map((t) => {
    const m = re.exec(t.trim());
    if (!m) return t;
    achou = true;
    const n = m[1] ? Number(m[1]) : 1;
    return `${nome}: ${n + 1}x`;
  });
  return achou ? saida : [...saida, nome];
}
