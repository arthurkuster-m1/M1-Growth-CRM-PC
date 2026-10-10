"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { textosDoModulo, textosDoTipoDeSubpagina } from "@/components/marketing/textos";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { usePublicacaoEmMassa } from "@/hooks/marketing/usePublicacaoEmMassa";
import { useVerComoCliente } from "@/hooks/marketing/useVerComoCliente";
import { MODULOS_DA_ESTRATEGIA } from "@/lib/marketing/modulos";
import type { EstadoDePublicacao } from "@/lib/marketing/paginas";
import { cn } from "@/lib/utils";

/**
 * PUBLICAR EM MASSA — a agência marca páginas e subpáginas e publica (ou tira do ar) todas de
 * uma vez. Só aparece para quem é da agência; o cliente não vê nem o botão.
 */
export function PublicacaoEmMassa() {
  const t = useT();
  const verComoCliente = useVerComoCliente();
  const [aberto, setAberto] = useState(false);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const { paginas, carregando, negado, executar, ocupado } = usePublicacaoEmMassa(true);

  const grupos = useMemo(() => {
    const ordem = new Map(MODULOS_DA_ESTRATEGIA.map((m, i) => [m.chave, i]));
    const porModulo = new Map<string, typeof paginas>();
    for (const p of paginas) porModulo.set(p.modulo, [...(porModulo.get(p.modulo) ?? []), p]);
    return [...porModulo.entries()]
      .sort((a, b) => (ordem.get(a[0]) ?? 99) - (ordem.get(b[0]) ?? 99))
      .map(([modulo, linhas]) => ({
        modulo,
        // A página do módulo primeiro, depois as subpáginas na ordem escolhida.
        linhas: [...linhas].sort((a, b) => Number(b.tipo === null) - Number(a.tipo === null)),
      }));
  }, [paginas]);

  if (negado || verComoCliente.ativo) return null;

  const estado = (e: EstadoDePublicacao): { texto: string; classe: string } => {
    switch (e) {
      case "publicada":
        return { texto: t("Publicada"), classe: "bg-success-bg text-success-fg" };
      case "alteracoes":
        return {
          texto: t("Há alterações não publicadas"),
          classe: "bg-warning-bg text-warning-fg",
        };
      case "rascunho":
        return { texto: t("Rascunho"), classe: "bg-secondary text-muted-foreground" };
      case "vazia":
        return { texto: t("Sem conteúdo"), classe: "bg-secondary text-muted-foreground" };
    }
  };
  const nomeDe = (p: (typeof paginas)[number]): string => {
    if (p.tipo === null) return textosDoModulo(t, p.modulo)?.titulo ?? p.modulo;
    return p.title || textosDoTipoDeSubpagina(t, p.tipo)?.titulo || p.key;
  };

  const alternar = (chaves: string[], ligar: boolean) =>
    setMarcadas((atual) => {
      const novo = new Set(atual);
      for (const k of chaves) {
        if (ligar) novo.add(k);
        else novo.delete(k);
      }
      return novo;
    });
  const todas = paginas.map((p) => p.key);
  const naoPublicadas = paginas
    .filter((p) => p.estado === "rascunho" || p.estado === "alteracoes")
    .map((p) => p.key);

  async function rodar(tipo: "publicar" | "despublicar") {
    const r = await executar([...marcadas], tipo);
    if (!r) return;
    toast.success(
      tipo === "publicar"
        ? t("Páginas publicadas: {n}.").replace("{n}", String(r.feitas))
        : t("Páginas tiradas do ar: {n}.").replace("{n}", String(r.feitas)),
    );
    if (r.ignoradas > 0) {
      toast.info(t("Ignoradas (sem conteúdo): {n}.").replace("{n}", String(r.ignoradas)));
    }
    setMarcadas(new Set());
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={carregando}
        className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium shadow-sm transition-colors hover:bg-secondary disabled:opacity-50"
      >
        {t("Publicar em massa")}
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-3xl overflow-hidden p-0">
          <div className="flex max-h-[90dvh] flex-col">
            <div className="border-b p-4 pr-12 sm:p-5">
              <DialogTitle className="text-lg font-semibold">{t("Publicar em massa")}</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                {t("Marque as páginas e publique ou tire do ar todas de uma vez.")}
              </DialogDescription>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => alternar(todas, true)}
                  className="h-8 rounded-lg border px-3 hover:bg-secondary"
                >
                  {t("Marcar todas")}
                </button>
                <button
                  type="button"
                  onClick={() => alternar(naoPublicadas, true)}
                  className="h-8 rounded-lg border px-3 hover:bg-secondary"
                >
                  {t("Marcar as não publicadas")}
                </button>
                <button
                  type="button"
                  onClick={() => setMarcadas(new Set())}
                  className="h-8 rounded-lg px-3 text-muted-foreground hover:bg-secondary"
                >
                  {t("Limpar")}
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {carregando ? (
                <p className="text-sm text-muted-foreground">{t("Carregando…")}</p>
              ) : grupos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("Ainda não há páginas criadas.")}
                </p>
              ) : (
                <div className="flex flex-col gap-5">
                  {grupos.map((g) => {
                    const chaves = g.linhas.map((l) => l.key);
                    const todasMarcadas = chaves.every((k) => marcadas.has(k));
                    return (
                      <section key={g.modulo} className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2 text-sm font-semibold">
                          <input
                            type="checkbox"
                            checked={todasMarcadas}
                            onChange={(e) => alternar(chaves, e.target.checked)}
                          />
                          {textosDoModulo(t, g.modulo)?.titulo ?? g.modulo}
                        </label>
                        <ul className="flex flex-col gap-1 pl-6">
                          {g.linhas.map((p) => {
                            const e = estado(p.estado);
                            return (
                              <li key={p.key}>
                                <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-secondary">
                                  <input
                                    type="checkbox"
                                    checked={marcadas.has(p.key)}
                                    onChange={(ev) => alternar([p.key], ev.target.checked)}
                                  />
                                  <span className="min-w-0 flex-1 truncate">
                                    {p.tipo === null ? t("Página principal") : nomeDe(p)}
                                  </span>
                                  <span
                                    className={cn(
                                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                                      e.classe,
                                    )}
                                  >
                                    {e.texto}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t p-4 sm:p-5">
              <span className="mr-auto text-sm text-muted-foreground">
                {t("{n} selecionadas").replace("{n}", String(marcadas.size))}
              </span>
              <button
                type="button"
                disabled={ocupado || marcadas.size === 0}
                onClick={() => void rodar("despublicar")}
                className="h-10 rounded-xl border px-4 text-sm font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("Tirar do ar")}
              </button>
              <button
                type="button"
                disabled={ocupado || marcadas.size === 0}
                onClick={() => void rodar("publicar")}
                className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("Publicar")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
