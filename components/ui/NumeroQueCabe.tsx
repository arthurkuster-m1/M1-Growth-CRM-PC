"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { abreviarNumeroGrande } from "@/lib/formatar/numero-que-cabe";
import { cn } from "@/lib/utils";

const ESCALA_MINIMA = 0.45;

interface Grupo {
  registrar: (id: string, escala: number) => void;
  remover: (id: string) => void;
  /** A menor escala pedida por qualquer número do grupo: todos usam esta. */
  minimo: number;
}
const ContextoDoGrupo = createContext<Grupo | null>(null);

/**
 * Um GRUPO de números (os cartões de um painel): todos ficam com o MESMO tamanho de fonte, o do
 * número que mais aperta — se o maior não cabe, a fonte de todos encolhe junto, em vez de cada
 * cartão ter um tamanho.
 */
export function GrupoDeNumeros({ children }: { children: ReactNode }) {
  const [pedidos, setPedidos] = useState<Record<string, number>>({});
  const registrar = useCallback((id: string, escala: number) => {
    setPedidos((atual) =>
      Math.abs((atual[id] ?? 1) - escala) < 0.005 ? atual : { ...atual, [id]: escala },
    );
  }, []);
  const remover = useCallback((id: string) => {
    setPedidos((atual) => {
      if (!(id in atual)) return atual;
      const { [id]: _fora, ...resto } = atual;
      return resto;
    });
  }, []);
  const minimo = Math.min(1, ...Object.values(pedidos));
  const valor = useMemo(() => ({ registrar, remover, minimo }), [registrar, remover, minimo]);
  return <ContextoDoGrupo.Provider value={valor}>{children}</ContextoDoGrupo.Provider>;
}

/**
 * O número de um cartão de painel, sempre INTEIRO e em UMA linha: sem quebrar ("R$" em cima,
 * "1.500,00" embaixo) e sem reticências. A fonte herdada do pai encolhe até o texto caber; de 1
 * milhão para cima o número é abreviado ("3,5 mi"). Dê ao pai o tamanho de fonte (`text-xl`…).
 * Dentro de um `GrupoDeNumeros`, todos os números do grupo usam a mesma escala (a menor).
 */
export function NumeroQueCabe({
  children,
  className,
  abreviar = true,
}: {
  children: string;
  className?: string;
  abreviar?: boolean;
}) {
  const texto = abreviar ? abreviarNumeroGrande(children) : children;
  const caixa = useRef<HTMLSpanElement>(null);
  const miolo = useRef<HTMLSpanElement>(null);
  const id = useId();
  const grupo = useContext(ContextoDoGrupo);
  const registrar = grupo?.registrar;
  const remover = grupo?.remover;
  const [propria, setPropria] = useState(1);
  const escala = grupo ? grupo.minimo : propria;
  // A escala que está na tela agora: o texto natural se mede dividindo por ela.
  const aplicada = useRef(escala);
  useLayoutEffect(() => {
    aplicada.current = escala;
  });

  useLayoutEffect(() => {
    const c = caixa.current;
    const m = miolo.current;
    if (!c || !m) return;
    const medir = () => {
      const disponivel = c.clientWidth;
      const natural = m.scrollWidth / aplicada.current;
      if (!disponivel || !natural) return;
      const pedida = Math.max(ESCALA_MINIMA, Math.min(1, (disponivel - 1) / natural));
      setPropria(pedida);
      registrar?.(id, pedida);
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(c);
    return () => {
      obs.disconnect();
      remover?.(id);
    };
  }, [texto, id, registrar, remover]);

  return (
    <span
      ref={caixa}
      className={cn("block w-full min-w-0 overflow-hidden whitespace-nowrap", className)}
    >
      <span ref={miolo} className="inline-block" style={{ fontSize: `${escala}em` }}>
        {texto}
      </span>
    </span>
  );
}
