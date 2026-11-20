/**
 * Da linha de `notificacoes` (que chega por Realtime) ao aviso da tela.
 *
 * Função pura: o hook `useNotificacoesPessoais` só a chama com a linha e o contexto da tela.
 */
import type { AcaoDoAviso, CategoriaDeNotificacao } from "./aviso-pessoal";
import type { EntregarAvisoInput } from "./deliver";
import type { NotifyKind } from "./kinds";

const SOM_POR_CATEGORIA: Record<CategoriaDeNotificacao, NotifyKind> = {
  mensagem: "message_inbound",
  lead_novo: "lead_new",
  lead_atribuido: "lead_assigned",
  mencao: "mention",
  tarefa: "task",
  atendimento: "alert",
  crm: "alert",
  sistema: "alert",
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
  if (!Object.hasOwn(SOM_POR_CATEGORIA, categoria)) return null;
  const tag = typeof linha.tag === "string" ? linha.tag : undefined;
  // A pessoa já está lendo esta conversa: não precisa de aviso.
  if (contexto.conversaAbertaEmFoco && tag === `conversa:${contexto.conversaAbertaEmFoco}`)
    return null;
  return {
    category: categoria,
    kind: SOM_POR_CATEGORIA[categoria],
    title: linha.titulo,
    body: typeof linha.corpo === "string" ? linha.corpo : "",
    tag,
    acoes: acoesValidas(linha.acoes),
  };
}
