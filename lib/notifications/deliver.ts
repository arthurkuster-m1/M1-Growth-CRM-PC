import { toast } from "sonner";

import type { AcaoDoAviso } from "./aviso-pessoal";
import { emitNotification } from "./emit";
import type { NotifyKind } from "./kinds";
import { canalLigado, type NotifyCategory } from "./prefs";

export interface EntregarAvisoInput {
  category: NotifyCategory;
  kind: NotifyKind;
  title: string;
  body: string;
  tag?: string;
  /** Os botões do aviso (até dois). O primeiro é também o destino do clique. */
  acoes?: AcaoDoAviso[];
  /** Atalho para um botão só, com rótulo `rotulo` (padrão "Abrir"). */
  href?: string;
  rotulo?: string;
  icon?: string;
}

function botoes(input: EntregarAvisoInput): AcaoDoAviso[] {
  if (input.acoes && input.acoes.length > 0) return input.acoes.slice(0, 2);
  if (input.href) return [{ rotulo: input.rotulo ?? "Abrir", href: input.href }];
  return [];
}

/**
 * O aviso na TELA: o toast do canto (com os botões) e, se a pessoa ligou, a notificação do
 * navegador. Sem destino não inventa botão: um botão morto é pior que nenhum.
 */
export function entregarAviso(input: EntregarAvisoInput): void {
  const acoes = botoes(input);
  const ir = (href: string) => () => {
    window.location.assign(href);
  };

  if (canalLigado(input.category, "in_app")) {
    const [primeiro, segundo] = acoes;
    toast(input.title, {
      description: input.body,
      action: primeiro ? { label: primeiro.rotulo, onClick: ir(primeiro.href) } : undefined,
      cancel: segundo ? { label: segundo.rotulo, onClick: ir(segundo.href) } : undefined,
    });
  }
  if (canalLigado(input.category, "push")) {
    emitNotification({
      kind: input.kind,
      title: input.title,
      body: input.body,
      tag: input.tag,
      href: acoes[0]?.href,
      acoes,
      icon: input.icon,
      force: true,
    });
  }
}
