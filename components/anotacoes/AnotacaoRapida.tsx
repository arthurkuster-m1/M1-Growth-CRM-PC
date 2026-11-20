"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useArvoreDeNotas } from "@/hooks/anotacoes/useArvoreDeNotas";
import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { MAXIMO_DA_ANOTACAO_RAPIDA, opcoesDeDestino } from "@/lib/anotacoes/anotacao-rapida";
import { ROLE_RANK } from "@/lib/auth/types";
import { CaretDown, FileText, PencilSimpleLine } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/** Aviso interno: uma anotação rápida entrou numa página (quem mostra essa página recarrega). */
export const EVENTO_ANOTACAO_RAPIDA = "anotacoes:rapida";

/**
 * A ANOTAÇÃO RÁPIDA, em qualquer tela: o lápis da barra do topo abre uma janela já com o cursor no
 * texto. Dá para escolher em QUAL página das Anotações a nota entra (busca pelo nome); sem escolher,
 * vai para a Caixa de entrada. A nota entra no TOPO da página, com data e hora. Ctrl+Enter (ou
 * ⌘+Enter) envia; Enter pula de linha. É o mesmo sistema do aplicativo Família Kuster.
 */
export function AnotacaoRapida({ className }: { className?: string }) {
  const t = useT();
  const org = useActiveOrg();
  const [aberto, setAberto] = useState(false);
  // Só a agência (gerente ou mais) escreve nas Anotações; os outros nem veem o lápis.
  if (!org || ROLE_RANK[org.role] < ROLE_RANK.manager) return null;
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={className}
        aria-label={t("Anotação rápida")}
        title={t("Anotação rápida")}
        onClick={() => setAberto(true)}
        data-testid="anotacao-rapida"
      >
        <PencilSimpleLine size={18} aria-hidden />
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Anotação rápida")}</DialogTitle>
            <DialogDescription>
              {t("Escolha a página e anote. Vai para o topo dela, com data e hora.")}
            </DialogDescription>
          </DialogHeader>
          {/* Monta só aberta: a árvore de páginas só é lida quando a janela abre. */}
          <Formulario aoEnviado={() => setAberto(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function Formulario({ aoEnviado }: { aoEnviado: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { notas } = useArvoreDeNotas();
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [destino, setDestino] = useState<string | null>(null); // nulo = Caixa de entrada
  const [escolhendo, setEscolhendo] = useState(false);
  const [busca, setBusca] = useState("");
  const campo = useRef<HTMLTextAreaElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);

  const todas = opcoesDeDestino(notas);
  const opcoes = opcoesDeDestino(notas, busca);
  const atual = todas.find((o) => (destino === null ? o.inbox : o.id === destino));
  const nomeDoDestino = atual?.titulo ?? t("Caixa de entrada");

  useEffect(() => {
    const espera = setTimeout(() => campo.current?.focus(), 80);
    return () => clearTimeout(espera);
  }, []);
  useEffect(() => {
    if (!escolhendo) return;
    const espera = setTimeout(() => campoBusca.current?.focus(), 30);
    return () => clearTimeout(espera);
  }, [escolhendo]);

  function escolher(id: string | null) {
    setDestino(id);
    setEscolhendo(false);
    setBusca("");
    setTimeout(() => campo.current?.focus(), 30);
  }

  async function enviar() {
    if (ocupado || !texto.trim()) return;
    setOcupado(true);
    try {
      const r = await apiClient.post<{ data: { page_id: string } }>("/api/v1/anotacoes/captura", {
        texto,
        ...(destino ? { page_id: destino } : {}),
      });
      queryClient.removeQueries({ queryKey: ["anotacoes", "pagina", r.data.page_id] });
      await queryClient.invalidateQueries({ queryKey: ["anotacoes", "arvore"] });
      window.dispatchEvent(
        new CustomEvent(EVENTO_ANOTACAO_RAPIDA, { detail: { id: r.data.page_id } }),
      );
      toast.success(
        `${t("Anotação enviada para")} ${destino === null ? t("a Caixa de entrada") : `“${nomeDoDestino}”`}`,
      );
      setTexto("");
      aoEnviado();
    } catch (erro) {
      showApiError(erro);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="grid gap-3" data-testid="anotacao-rapida-janela">
      <div className="relative">
        <button
          type="button"
          aria-expanded={escolhendo}
          aria-haspopup="listbox"
          onClick={() => setEscolhendo((v) => !v)}
          data-testid="rapida-destino"
          className="flex min-h-11 w-full items-center gap-2 rounded-xl border bg-background px-3 py-1.5 text-left text-sm"
        >
          <span className="text-xs text-muted-foreground">{t("Anotar em")}</span>
          <b className="min-w-0 flex-1 truncate">
            {atual?.icone ? <span aria-hidden>{atual.icone} </span> : null}
            {nomeDoDestino}
          </b>
          <CaretDown size={14} weight="bold" aria-hidden />
        </button>
        {escolhendo ? (
          <div
            data-testid="rapida-lista"
            className="absolute z-20 mt-1 w-full rounded-xl border bg-popover p-2 shadow-xl"
          >
            <input
              ref={campoBusca}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={t("Buscar a página…")}
              aria-label={t("Buscar a página de destino")}
              data-testid="rapida-busca"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const p = opcoes[0];
                  if (p) escolher(p.inbox ? null : p.id);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setEscolhendo(false);
                }
              }}
              className="mb-1 h-9 w-full rounded-lg border bg-background px-2.5 text-sm outline-hidden focus:border-primary/60"
            />
            <div role="listbox" aria-label={t("Páginas")} className="max-h-60 overflow-y-auto">
              {opcoes.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  {t("Nenhuma página com esse nome.")}
                </p>
              ) : null}
              {opcoes.map((o) => {
                const selecionada = o.inbox ? destino === null : o.id === destino;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="option"
                    aria-selected={selecionada}
                    onClick={() => escolher(o.inbox ? null : o.id)}
                    data-testid={`rapida-opcao-${o.inbox ? "caixa" : o.id}`}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary",
                      selecionada && "bg-accent-soft font-medium",
                    )}
                  >
                    <span aria-hidden className="grid w-5 shrink-0 place-items-center">
                      {o.icone ?? <FileText size={16} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {o.titulo}
                      {o.caminho ? (
                        <small className="ml-2 text-xs text-muted-foreground">{o.caminho}</small>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <textarea
        ref={campo}
        rows={8}
        value={texto}
        maxLength={MAXIMO_DA_ANOTACAO_RAPIDA}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void enviar();
          }
        }}
        placeholder={t("O que você precisa anotar?")}
        aria-label={t("Texto da anotação")}
        data-testid="anotacao-rapida-texto"
        className="w-full resize-y rounded-xl border bg-background p-3 text-sm outline-hidden focus:ring-2 focus:ring-primary/40"
      />
      <button
        type="button"
        onClick={() => void enviar()}
        disabled={!texto.trim() || ocupado}
        data-testid="anotacao-rapida-enviar"
        className="h-11 w-full rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
      >
        {ocupado
          ? t("Enviando…")
          : `${t("Enviar para")} ${destino === null ? t("a Caixa de entrada") : `“${nomeDoDestino}”`}`}
      </button>
      <p className="text-xs text-muted-foreground">
        {t(
          "Vai para o topo da página escolhida (por padrão, a Caixa de entrada), com data e hora. Ctrl+Enter envia.",
        )}
      </p>
    </div>
  );
}
