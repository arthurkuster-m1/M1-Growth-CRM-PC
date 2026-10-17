import * as React from "react";

/**
 * A RODA DO MOUSE DENTRO DE UM POPUP QUE ABRE POR CIMA DE UM DIÁLOGO.
 *
 * Todo diálogo do app trava a rolagem do resto da página (`react-remove-scroll`): ele escuta a
 * roda do mouse no documento e a cancela quando o alvo está FORA do diálogo. Só que os popups
 * (seletores, listas, menus) abrem num portal, fora do diálogo — então a roda deles era
 * cancelada junto, e a lista só rolava arrastando a barra lateral.
 *
 * A saída é interromper o evento no próprio popup, antes de ele chegar ao documento: o
 * navegador rola a lista normalmente e o bloqueio continua valendo para a página de trás.
 */
export function liberarRolagem(no: HTMLElement): () => void {
  const parar = (e: Event) => e.stopPropagation();
  no.addEventListener("wheel", parar, { passive: true });
  no.addEventListener("touchmove", parar, { passive: true });
  return () => {
    no.removeEventListener("wheel", parar);
    no.removeEventListener("touchmove", parar);
  };
}

/**
 * A ref do conteúdo de um popup: ela guarda o elemento e liga a rolagem livre nele; a ref de quem
 * usa o popup (se houver) recebe o mesmo elemento.
 */
export function useRolagemLivre<T extends HTMLElement>(ref: React.ForwardedRef<T>) {
  const [no, setNo] = React.useState<T | null>(null);
  React.useImperativeHandle(ref, () => no as T, [no]);
  React.useEffect(() => (no ? liberarRolagem(no) : undefined), [no]);
  return setNo;
}
