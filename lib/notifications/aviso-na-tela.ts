/**
 * Da linha de `notificacoes` (que chega por Realtime) ao aviso da tela.
 *
 * Função pura: o hook `useNotificacoesPessoais` só a chama com a linha e o contexto da tela.
 */
import type { AcaoDoAviso, CategoriaDeNotificacao } from "./aviso-pessoal";
import type { EntregarAvisoInput } from "./deliver";
import type { NotifyKind } from "./kinds";
import type { NotifyCategory } from "./prefs";

const POR_CATEGORIA: Record<
  CategoriaDeNotificacao,
  { category: NotifyCategory; kind: NotifyKind }
> = {
  mensagem: { category: "message", kind: "message_inbound" },
  lead_novo: { category: "lead_new", kind: "lead_new" },
  lead_atribuido: { category: "lead_assigned", kind: "lead_assigned" },
  mencao: { category: "mention", kind: "mention" },
  tarefa: { category: "task", kind: "task" },
  atendimento: { category: "alerts", kind: "alert" },
  crm: { category: "alerts", kind: "alert" },
  sistema: { category: "alerts", kind: "alert" },
};

function acoesValidas(v: unknown): AcaoDoAviso[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (a): a is AcaoDoAviso =>
        !!a &&
        typeof a === "object" &&
        typeof (a as AcaoDoAviso).rotulo === "string" &&
        typeof (a as AcaoDoAviso).href === "string" &&
        // Só caminho interno: o botão nunca leva para fora do CRM.
        (a as AcaoDoAviso).href.startsWith("/"),
    )
    .slice(0, 2);
}

export function avisoDaLinha(
  linha: Record<string, unknown>,
  contexto: { organizacaoAtiva: string | null; conversaAbertaEmFoco: string | null },
): EntregarAvisoInput | null {
  if (typeof linha.titulo !== "string" || !linha.titulo) return null;
  // Notificação de outra empresa: o botão abriria no contexto errado (a do celular cobre).
  if (contexto.organizacaoAtiva && linha.organization_id !== contexto.organizacaoAtiva) return null;
  const categoria = linha.categoria as CategoriaDeNotificacao;
  const alvo = Object.hasOwn(POR_CATEGORIA, categoria) ? POR_CATEGORIA[categoria] : null;
  if (!alvo) return null;
  const tag = typeof linha.tag === "string" ? linha.tag : undefined;
  // A pessoa já está lendo esta conversa: não precisa de aviso.
  if (contexto.conversaAbertaEmFoco && tag === `conversa:${contexto.conversaAbertaEmFoco}`)
    return null;
  return {
    category: alvo.category,
    kind: alvo.kind,
    title: linha.titulo,
    body: typeof linha.corpo === "string" ? linha.corpo : "",
    tag,
    acoes: acoesValidas(linha.acoes),
  };
}
