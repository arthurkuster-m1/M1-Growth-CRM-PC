"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { useLinksDeMarketing } from "@/hooks/marketing/useLinksDeMarketing";
import { textosDoModulo, textosDoTipoDeSubpagina } from "@/components/marketing/textos";
import {
  CHAVE_DO_CRONOGRAMA,
  enderecoDoLink,
  linkVigente,
  type LinkDeMarketing,
} from "@/lib/marketing/links";
import { lerChaveDePagina } from "@/lib/marketing/modulos";
import { Copy, Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * COMPARTILHAR — a agência gera o link SEM LOGIN que o cliente abre. Do painel inteiro ou só
 * desta página; sem validade ou com. O link mostra o que foi PUBLICADO, somente leitura.
 * Revogar o link o torna inexistente na hora.
 */
export function CompartilharPagina({
  aberto,
  aoFechar,
  chave,
  temPublicado,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** O módulo desta página. */
  chave: string;
  /** Há algo publicado nesta página? (Sem isso o link do painel abre vazio, e o desta página, 404.) */
  temPublicado: boolean;
}) {
  const t = useT();
  const { links, carregando, criarLink, revogarLink } = useLinksDeMarketing(aberto);
  const [escopo, setEscopo] = useState<"pagina" | "painel">("pagina");
  const [validade, setValidade] = useState<string>("");
  const [criando, setCriando] = useState(false);

  async function criar() {
    setCriando(true);
    await criarLink({
      module_key: escopo === "pagina" ? chave : null,
      expires_in_days: validade === "" ? null : Number(validade),
    });
    setCriando(false);
  }

  async function copiar(token: string) {
    const endereco = enderecoDoLink(window.location.origin, token);
    try {
      await navigator.clipboard.writeText(endereco);
      toast.success(t("Link copiado."));
    } catch {
      // Sem permissão de área de transferência (http, navegador antigo): o campo já está selecionável.
      toast.info(t("Copie o link do campo."));
    }
  }

  /** O nome da página do link: assim, com muitos links, dá para saber qual é qual. */
  const rotuloDoEscopo = (link: LinkDeMarketing) => {
    const chaveDoLink = link.module_key;
    if (chaveDoLink === null) return t("Painel inteiro");
    if (chaveDoLink === CHAVE_DO_CRONOGRAMA) return t("Cronograma");
    const lida = lerChaveDePagina(chaveDoLink);
    const modulo = lida ? textosDoModulo(t, lida.modulo)?.titulo : undefined;
    if (lida?.tipo) {
      const nome = link.page_title || textosDoTipoDeSubpagina(t, lida.tipo)?.titulo || chaveDoLink;
      return modulo ? `${modulo} · ${nome}` : nome;
    }
    return link.page_title || modulo || chaveDoLink;
  };

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="max-h-[88dvh] max-w-lg gap-4 overflow-y-auto p-5 sm:rounded-2xl">
        <DialogTitle className="text-base font-semibold">
          {t("Compartilhar com o cliente")}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {t(
            "O cliente abre o link sem entrar no sistema e vê só o que foi publicado, sem poder editar.",
          )}
        </DialogDescription>

        {!temPublicado ? (
          <p className="rounded-xl bg-warning-bg px-3 py-2 text-sm text-warning-fg">
            {t("Esta página ainda não foi publicada. O link só mostra o que estiver publicado.")}
          </p>
        ) : null}

        <div className="grid gap-3 rounded-2xl bg-secondary/60 p-3">
          <div
            role="radiogroup"
            aria-label={t("O que o link abre")}
            className="grid grid-cols-2 gap-1.5"
          >
            {(
              [
                { id: "pagina", rotulo: t("Só esta página") },
                { id: "painel", rotulo: t("Painel inteiro") },
              ] as const
            ).map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={escopo === o.id}
                onClick={() => setEscopo(o.id)}
                className={cn(
                  "h-10 rounded-xl border px-3 text-sm transition-colors",
                  escopo === o.id
                    ? "border-primary bg-primary/10 font-medium"
                    : "bg-background hover:bg-secondary",
                )}
              >
                {o.rotulo}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">{t("Validade")}</span>
            <select
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
              className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
            >
              <option value="">{t("Sem validade")}</option>
              <option value="7">{t("7 dias")}</option>
              <option value="30">{t("30 dias")}</option>
              <option value="90">{t("90 dias")}</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void criar()}
            disabled={criando}
            className="h-10 rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {t("Gerar link")}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("Links ativos")}
          </h3>
          {carregando ? (
            <div className="h-16 animate-pulse rounded-xl bg-secondary" aria-busy="true" />
          ) : links.filter((l) => linkVigente(l)).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("Nenhum link ativo.")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {links
                .filter((l) => linkVigente(l))
                .map((l) => (
                  <li key={l.id} className="rounded-xl border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{rotuloDoEscopo(l)}</span>
                      <span>
                        {l.expires_at
                          ? `${t("Vence em")} ${new Date(l.expires_at).toLocaleDateString()}`
                          : t("Sem validade")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={enderecoDoLink(
                          typeof window === "undefined" ? "" : window.location.origin,
                          l.token,
                        )}
                        aria-label={t("Endereço do link")}
                        onFocus={(e) => e.currentTarget.select()}
                        className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-2 text-xs"
                      />
                      <button
                        type="button"
                        aria-label={t("Copiar link")}
                        title={t("Copiar link")}
                        onClick={() => void copiar(l.token)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border hover:bg-secondary"
                      >
                        <Copy size={14} aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={t("Revogar link")}
                        title={t("Revogar link")}
                        onClick={() => void revogarLink(l.id)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-error-fg hover:bg-error-bg"
                      >
                        <Trash size={14} aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
