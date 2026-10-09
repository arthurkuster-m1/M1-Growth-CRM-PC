"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BlocosRender, type RotulosDosBlocos } from "@/components/marketing/BlocosRender";
import { Capa } from "@/components/marketing/Capa";
import { useT } from "@/hooks/i18n/useT";
import type { Bloco } from "@/lib/marketing/blocos";
import type { TomDaCapa } from "@/lib/marketing/modulos";
import { slidesDaPagina } from "@/lib/marketing/slides";
import { CaretLeft, CaretRight, X } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * A APRESENTAÇÃO: a página em tela cheia, slide a slide.
 *
 * Setas do teclado (← →, espaço, Home/End) e Esc para sair; no celular, deslizar o dedo para o
 * lado ou tocar nas setas. Os slides vêm da MESMA lista de blocos da página (`slidesDaPagina`):
 * não há um segundo conteúdo para manter. Sem estado fora daqui — quem abre decide quando fechar.
 */
export function Apresentacao({
  titulo,
  descricao,
  superior,
  tom,
  icone,
  blocos,
  rotulos,
  aoFechar,
}: {
  titulo: string;
  descricao: string;
  superior: string;
  tom: TomDaCapa;
  icone: React.ReactNode;
  blocos: readonly Bloco[];
  rotulos: RotulosDosBlocos;
  aoFechar: () => void;
}) {
  const t = useT();
  const slides = slidesDaPagina(blocos);
  const [indice, setIndice] = useState(0);
  const inicioDoToque = useRef<number | null>(null);
  const raiz = useRef<HTMLDivElement>(null);

  const ir = useCallback(
    (alvo: number) => setIndice(Math.min(slides.length - 1, Math.max(0, alvo))),
    [slides.length],
  );

  useEffect(() => {
    raiz.current?.focus();
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
      else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setIndice((i) => Math.min(slides.length - 1, i + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIndice((i) => Math.max(0, i - 1));
      } else if (e.key === "Home") setIndice(0);
      else if (e.key === "End") setIndice(slides.length - 1);
    }
    window.addEventListener("keydown", aoTeclar);
    // A página de trás não rola enquanto a apresentação está aberta.
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = antes;
    };
  }, [aoFechar, slides.length]);

  const slide = slides[indice]!;

  return (
    <div
      ref={raiz}
      role="dialog"
      aria-modal="true"
      aria-label={`${t("Apresentação")}: ${titulo}`}
      tabIndex={-1}
      onTouchStart={(e) => {
        inicioDoToque.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const inicio = inicioDoToque.current;
        inicioDoToque.current = null;
        const fim = e.changedTouches[0]?.clientX;
        if (inicio === null || fim === undefined) return;
        if (fim - inicio < -50) ir(indice + 1);
        else if (fim - inicio > 50) ir(indice - 1);
      }}
      className="fixed inset-0 z-[60] flex flex-col bg-background outline-hidden"
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <span className="truncate text-sm font-medium text-muted-foreground">{titulo}</span>
        <button
          type="button"
          onClick={aoFechar}
          aria-label={t("Sair da apresentação")}
          className="grid h-10 w-10 place-items-center rounded-xl border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <X size={18} aria-hidden />
        </button>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 pb-6 sm:px-14">
        {slide.tipo === "capa" ? (
          <Capa tom={tom} icone={icone} className="w-full max-w-5xl rounded-[2rem]">
            <div className="relative z-10 flex min-h-[55dvh] flex-col justify-center gap-4 p-8 sm:p-16">
              <span className="text-sm font-semibold tracking-wider uppercase opacity-80 sm:text-base">
                {superior}
              </span>
              <h1 className="text-4xl font-bold tracking-tight sm:text-7xl">{titulo}</h1>
              <p className="max-w-2xl text-lg opacity-90 sm:text-2xl">{descricao}</p>
            </div>
          </Capa>
        ) : (
          <div className="w-full max-w-5xl">
            <BlocosRender
              escala="slide"
              rotulos={rotulos}
              blocos={
                slide.titulo
                  ? [
                      { id: `${slide.chave}-t`, tipo: "titulo", nivel: 1, texto: slide.titulo },
                      ...slide.blocos,
                    ]
                  : slide.blocos
              }
            />
          </div>
        )}
      </main>

      <footer className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => ir(indice - 1)}
          disabled={indice === 0}
          aria-label={t("Slide anterior")}
          className="grid h-11 w-11 place-items-center rounded-xl border bg-card disabled:opacity-30"
        >
          <CaretLeft size={18} aria-hidden />
        </button>
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5" aria-hidden>
            {slides.map((s, n) => (
              <span
                key={s.chave}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  n === indice ? "w-6 bg-primary" : "w-1.5 bg-border-strong",
                )}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {indice + 1} / {slides.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => ir(indice + 1)}
          disabled={indice === slides.length - 1}
          aria-label={t("Próximo slide")}
          className="grid h-11 w-11 place-items-center rounded-xl border bg-card disabled:opacity-30"
        >
          <CaretRight size={18} aria-hidden />
        </button>
      </footer>
    </div>
  );
}
