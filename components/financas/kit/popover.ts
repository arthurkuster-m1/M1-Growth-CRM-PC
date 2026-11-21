import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * Popover na "camada de cima" do navegador (Popover API): aparece por cima de folhas e diálogos e não é cortado
 * por nenhum container. Fecha sozinho ao clicar fora; a posição é calculada junto do gatilho (abre para cima se
 * faltar espaço embaixo).
 */
export function usePopover(
  gatilho: RefObject<HTMLElement | null>,
  opcoes: { largura?: number; alturaMax?: number } = {},
) {
  const ref = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);

  /**
   * Preferência: embaixo do campo; se não couber, em cima; se não couber em nenhum lado mas couber na tela,
   * desliza para dentro da tela (cobrindo um pouco o campo) em vez de ser cortado; só rola se for maior que a tela.
   */
  // hook portado da família: lê a posição do DOM por ref, e o React Compiler não consegue provar a dependência
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const posicionar = useCallback(() => {
    const g = gatilho.current,
      el = ref.current;
    if (!g || !el) return;
    const r = g.getBoundingClientRect();
    const vv = window.visualViewport;
    const vw = vv?.width ?? window.innerWidth,
      vh = vv ? vv.height + vv.offsetTop : window.innerHeight; // com o teclado aberto, só conta a parte visível
    const largura = opcoes.largura ?? Math.max(r.width, 180);
    el.style.width = `${largura}px`;
    el.style.left = `${Math.min(Math.max(8, r.left), Math.max(8, vw - largura - 8))}px`;
    const rolagem = el.scrollTop; // trocar o max-height zera a rolagem: guarda e devolve
    el.style.maxHeight = "none";
    const natural = el.scrollHeight + 2; // altura real do conteúdo (+ bordas)
    const h = Math.min(natural, opcoes.alturaMax ?? Infinity, vh - 16);
    const abaixo = vh - r.bottom - 12,
      acima = r.top - 12;
    el.style.maxHeight = `${h}px`;
    el.scrollTop = rolagem;
    if (abaixo >= h) {
      el.style.top = `${r.bottom + 6}px`;
      el.style.bottom = "auto";
    } else if (acima >= h) {
      el.style.bottom = `${vh - r.top + 6}px`;
      el.style.top = "auto";
    } else {
      el.style.top = `${Math.max(8, Math.min(r.bottom + 6, vh - h - 8))}px`;
      el.style.bottom = "auto";
    }
  }, [gatilho, opcoes.largura, opcoes.alturaMax]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (aberto && !el.matches(":popover-open")) {
      el.showPopover();
      posicionar();
    }
    if (!aberto && el.matches(":popover-open")) el.hidePopover();
  }, [aberto, posicionar]);

  // clicar fora / Esc fecham pelo navegador: sincroniza o estado
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const aoAlternar = (e: Event) => {
      if ((e as ToggleEvent).newState === "closed") setAberto(false);
    };
    el.addEventListener("toggle", aoAlternar);
    return () => el.removeEventListener("toggle", aoAlternar);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const f = () => posicionar();
    // rolar a PRÓPRIA lista não é motivo para reposicionar (e antes jogava a lista de volta ao topo)
    const aoRolar = (e: Event) => {
      if (e.target instanceof Node && ref.current?.contains(e.target)) return;
      posicionar();
    };
    window.addEventListener("resize", f);
    window.addEventListener("scroll", aoRolar, true);
    window.visualViewport?.addEventListener("resize", f);
    window.visualViewport?.addEventListener("scroll", f);
    return () => {
      window.visualViewport?.removeEventListener("scroll", f);
      window.removeEventListener("resize", f);
      window.removeEventListener("scroll", aoRolar, true);
      window.visualViewport?.removeEventListener("resize", f);
    };
  }, [aberto, posicionar]);

  return { ref, aberto, setAberto };
}
