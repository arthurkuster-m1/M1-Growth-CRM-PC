"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EscadaDeValor } from "@/components/marketing/EscadaDeValor";
import { EtiquetaDeEstado } from "@/components/marketing/Cartoes";
import { iconeDoModulo } from "@/components/marketing/icones";
import { textosDoTipoDeSubpagina } from "@/components/marketing/textos";
import { useT } from "@/hooks/i18n/useT";
import { useVerComoCliente } from "@/hooks/marketing/useVerComoCliente";
import { useSubpaginasDeMarketing } from "@/hooks/marketing/useSubpaginasDeMarketing";
import { chaveDeSubpagina, tiposDeSubpagina } from "@/lib/marketing/modulos";
import { ArrowRight, CaretDown, CaretUp, Plus } from "@/lib/ui/icons";

/**
 * As SUBPÁGINAS de um módulo (as personas, a pesquisa, a árvore, a arquitetura de premissas…).
 * A agência cria (os tipos de página única só uma vez; as repetíveis, quantas precisar) e o
 * cliente lê as publicadas. Cada uma é uma página completa, com rascunho, publicação e histórico.
 */
export function SubpaginasDoModulo({ modulo, base }: { modulo: string; base: string }) {
  const t = useT();
  const router = useRouter();
  const {
    subpaginas,
    podeEditar: podeEditarDeVerdade,
    carregando,
    criarSubpagina,
    moverSubpagina,
  } = useSubpaginasDeMarketing(modulo);
  const verComoCliente = useVerComoCliente();
  const podeEditar = podeEditarDeVerdade && !verComoCliente.ativo;
  const [menu, setMenu] = useState(false);
  const [criando, setCriando] = useState(false);
  const tipos = tiposDeSubpagina(modulo);
  if (tipos.length === 0) return null;

  const opcoes = tipos.filter(
    (x) => x.repetivel || !subpaginas.some((s) => s.key === chaveDeSubpagina(modulo, x.tipo)),
  );

  async function criar(tipo: string) {
    const textos = textosDoTipoDeSubpagina(t, tipo);
    const definicao = tipos.find((x) => x.tipo === tipo);
    if (!textos || !definicao) return;
    const jaTem = subpaginas.filter((s) => s.tipo === tipo).length;
    setCriando(true);
    const chave = await criarSubpagina({
      tipo,
      title: definicao.repetivel ? `${textos.titulo} ${jaTem + 1}` : textos.titulo,
    });
    setCriando(false);
    setMenu(false);
    if (chave) router.push(`${base}/${chave}`);
  }

  // O cliente (ou a agência em "ver como cliente") só vê as subpáginas publicadas.
  const visiveis = podeEditar ? subpaginas : subpaginas.filter((s) => s.publicada);
  if (!podeEditar && visiveis.length === 0 && !carregando) return null;
  const escada = visiveis.flatMap((s) =>
    s.oferta
      ? [
          {
            chave: s.key,
            titulo: s.title,
            etapa: s.oferta.etapa,
            carroChefe: s.oferta.carroChefe,
            preco: s.oferta.preco,
            href: `${base}/${s.key}`,
          },
        ]
      : [],
  );

  return (
    <section aria-label={t("Subpáginas")} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{t("Aprofundamento")}</h2>
        {podeEditar && opcoes.length > 0 ? (
          <div className="relative">
            <button
              type="button"
              aria-expanded={menu}
              disabled={criando}
              onClick={() => setMenu((a) => !a)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
            >
              <Plus size={14} weight="bold" aria-hidden />
              {t("Nova subpágina")}
            </button>
            {menu ? (
              <div
                role="menu"
                className="absolute top-full right-0 z-20 mt-1 w-72 rounded-2xl border bg-popover p-1.5 shadow-xl"
              >
                {opcoes.map((x) => {
                  const textos = textosDoTipoDeSubpagina(t, x.tipo);
                  return textos ? (
                    <button
                      key={x.tipo}
                      type="button"
                      role="menuitem"
                      onClick={() => void criar(x.tipo)}
                      className="block w-full rounded-xl px-3 py-2 text-left hover:bg-secondary"
                    >
                      <span className="block text-sm font-medium">{textos.titulo}</span>
                      <span className="block text-xs text-muted-foreground">
                        {textos.descricao}
                      </span>
                    </button>
                  ) : null;
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {modulo === "produtos-e-ofertas" ? <EscadaDeValor ofertas={escada} /> : null}

      {carregando ? (
        <div className="h-24 animate-pulse rounded-2xl bg-secondary" aria-busy="true" />
      ) : visiveis.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
          {t("Nenhuma subpágina ainda. Crie a primeira em “Nova subpágina”.")}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visiveis.map((s, indice) => {
            const definicao = tipos.find((x) => x.tipo === s.tipo);
            const textos = textosDoTipoDeSubpagina(t, s.tipo);
            return (
              <li key={s.key} className="relative">
                <Link
                  href={`${base}/${s.key}`}
                  className="group flex h-full flex-col gap-2 rounded-2xl border-[1.5px] border-primary bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-hidden"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-primary">
                      {iconeDoModulo(definicao?.icone ?? "Lightbulb", 22)}
                    </span>
                    <EtiquetaDeEstado
                      texto={s.publicada ? t("Publicada") : t("Rascunho")}
                      ativo={s.publicada}
                    />
                  </div>
                  <h3 className="font-semibold">{s.title || textos?.titulo}</h3>
                  <p className="text-xs text-muted-foreground">{textos?.descricao}</p>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-primary">
                    {t("Abrir")}
                    <ArrowRight
                      size={14}
                      weight="bold"
                      className="transition-transform group-hover:translate-x-1"
                      aria-hidden
                    />
                  </span>
                </Link>
                {podeEditar ? (
                  <div className="absolute right-2 bottom-2 flex rounded-lg border bg-card shadow-sm">
                    <button
                      type="button"
                      aria-label={t("Mover para antes")}
                      title={t("Mover para antes")}
                      disabled={indice === 0}
                      onClick={() => moverSubpagina(s.key, -1)}
                      className="grid h-8 w-8 place-items-center rounded-l-lg text-muted-foreground hover:bg-secondary disabled:opacity-30"
                    >
                      <CaretUp size={14} className="-rotate-90" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={t("Mover para depois")}
                      title={t("Mover para depois")}
                      disabled={indice === visiveis.length - 1}
                      onClick={() => moverSubpagina(s.key, 1)}
                      className="grid h-8 w-8 place-items-center rounded-r-lg text-muted-foreground hover:bg-secondary disabled:opacity-30"
                    >
                      <CaretDown size={14} className="-rotate-90" aria-hidden />
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
