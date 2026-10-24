"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CartaoDeModulo } from "@/components/marketing/Cartoes";
import { iconeDoModulo } from "@/components/marketing/icones";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { useSubpaginasDeMarketing } from "@/hooks/marketing/useSubpaginasDeMarketing";
import { useVerComoCliente } from "@/hooks/marketing/useVerComoCliente";
import { Plus } from "@/lib/ui/icons";

const MODULO = "estrategia-de-marketing";

/**
 * A fase "Geração de Demanda" da galeria da Estratégia: não tem páginas fixas. Cada estratégia
 * de marketing que a empresa vai rodar (uma, duas, quatro… depende do cliente) é uma página
 * criada aqui, no botão "Nova estratégia", já com o modelo de estratégia para preencher.
 * O cliente vê só as publicadas.
 */
export function EstrategiasDeMarketing({ titulo, fase }: { titulo: string; fase: string }) {
  const t = useT();
  const router = useRouter();
  const {
    subpaginas,
    podeEditar: podeEditarDeVerdade,
    carregando,
    criarSubpagina,
  } = useSubpaginasDeMarketing(MODULO);
  const verComoCliente = useVerComoCliente();
  const podeEditar = podeEditarDeVerdade && !verComoCliente.ativo;
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [criando, setCriando] = useState(false);

  const visiveis = podeEditar ? subpaginas : subpaginas.filter((s) => s.publicada);
  // O cliente não tem o que ver enquanto a agência não publicar nenhuma estratégia.
  if (!podeEditar && visiveis.length === 0 && !carregando) return null;

  async function criar() {
    setCriando(true);
    const chave = await criarSubpagina({
      tipo: "estrategia",
      title: nome.trim() || `${t("Estratégia")} ${subpaginas.length + 1}`,
    });
    setCriando(false);
    if (!chave) return;
    setAberto(false);
    setNome("");
    router.push(`/app/marketing/estrategia/${MODULO}/${chave}`);
  }

  return (
    <section aria-label={titulo} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 text-sm font-semibold text-muted-foreground">{titulo}</h2>
        {podeEditar ? (
          <Popover open={aberto} onOpenChange={setAberto}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border bg-card px-3 text-[13px] font-medium whitespace-nowrap transition-colors hover:bg-secondary sm:text-sm"
              >
                <Plus size={14} weight="bold" className="shrink-0" aria-hidden />
                {t("Nova estratégia")}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-3">
              <label
                htmlFor="nome-da-estrategia"
                className="mb-1 block text-xs text-muted-foreground"
              >
                {t("Nome da estratégia")}
              </label>
              <input
                id="nome-da-estrategia"
                autoFocus
                value={nome}
                maxLength={120}
                placeholder={t("Ex.: Tráfego pago, Indicação, Parcerias")}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !criando) {
                    e.preventDefault();
                    void criar();
                  }
                }}
                className="h-10 w-full rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {t(
                  "A página já nasce com o modelo de estratégia de marketing para você preencher.",
                )}
              </p>
              <button
                type="button"
                disabled={criando}
                onClick={() => void criar()}
                className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
              >
                {t("Criar estratégia")}
              </button>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
          {carregando
            ? t("Carregando…")
            : t("Nenhuma estratégia ainda. Use “Nova estratégia” para criar a primeira.")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visiveis.map((s) => (
            <CartaoDeModulo
              key={s.key}
              href={`/app/marketing/estrategia/${MODULO}/${s.key}`}
              tom="blue"
              icone={iconeDoModulo("Lightbulb")}
              titulo={s.title || t("Estratégia")}
              fase={fase}
              estado={s.publicada ? null : t("Rascunho")}
            />
          ))}
        </div>
      )}
    </section>
  );
}
