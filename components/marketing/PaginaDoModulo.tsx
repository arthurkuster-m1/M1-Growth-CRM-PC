"use client";

import { modeloDoModulo } from "@/lib/marketing/modelos";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { useVerComoCliente } from "@/hooks/marketing/useVerComoCliente";
import { CabecalhoDaSubpagina } from "@/components/marketing/CabecalhoDaSubpagina";
import { lerChaveDePagina } from "@/lib/marketing/modulos";
import { HistoricoDaPagina } from "@/components/marketing/HistoricoDaPagina";
import { useHistoricoDeMarketing } from "@/hooks/marketing/useHistoricoDeMarketing";
import { Apresentacao } from "@/components/marketing/Apresentacao";
import { CompartilharPagina } from "@/components/marketing/CompartilharPagina";
import { BlocosRender, type RotulosDosBlocos } from "@/components/marketing/BlocosRender";
import { EditorDeBlocos } from "@/components/marketing/EditorDeBlocos";
import { OQueVem } from "@/components/marketing/PaginaDeMarketing";
import { useT } from "@/hooks/i18n/useT";
import { usePaginaDeMarketing } from "@/hooks/marketing/usePaginaDeMarketing";
import { type Bloco } from "@/lib/marketing/blocos";
import type { TomDaCapa } from "@/lib/marketing/modulos";
import { randomId } from "@/lib/random-id";
import { ClockCounterClockwise, Eye, Presentation, ShareNetwork } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * O CONTEÚDO de uma página de módulo — o miolo que o cliente lê e a agência edita.
 *
 *  - Cliente (ou qualquer um sem permissão de editar): vê o PUBLICADO, ou "em breve".
 *  - Agência (manager+): alterna entre EDITAR (rascunho salvo sozinho) e VER, abre a
 *    APRESENTAÇÃO, publica e tira do ar. O que o cliente vê só muda ao publicar.
 */
export function PaginaDoModulo({
  chave,
  titulo,
  descricao,
  superior,
  tom,
  icone,
  rotulos,
  textosDeEspera,
  subpagina,
}: {
  chave: string;
  titulo: string;
  descricao: string;
  superior: string;
  tom: TomDaCapa;
  icone: ReactNode;
  rotulos: RotulosDosBlocos;
  /** O "o que vem aqui" mostrado enquanto nada foi publicado. */
  textosDeEspera: { titulo: string; itens: string[] };
  /** Presente quando esta é uma SUBPÁGINA: mostra o topo próprio (voltar, título editável, apagar). */
  subpagina?: { tipo: string; voltar: { href: string; rotulo: string } };
}) {
  const t = useT();
  const { pagina, carregando, falhou, blocos, estado, editar, publicar, tirarDoAr, renomear } =
    usePaginaDeMarketing(chave);
  const [modo, setModo] = useState<"editar" | "ver">("editar");
  const [apresentando, setApresentando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [historico, setHistorico] = useState(false);
  const verComoCliente = useVerComoCliente();
  const retratos = useHistoricoDeMarketing(chave, historico);

  if (carregando) {
    return <div className="h-48 animate-pulse rounded-3xl bg-secondary" aria-busy="true" />;
  }
  if (falhou || !pagina) {
    return (
      <p className="rounded-xl border border-error/30 bg-error-bg px-4 py-3 text-sm text-error-fg">
        {t("Não foi possível carregar a página.")}
      </p>
    );
  }

  // Quem é da agência pode olhar a página como o cliente a vê (só uma visão; o acesso é o mesmo).
  const podeEditarDeVerdade = pagina.pode_editar;
  const podeEditar = podeEditarDeVerdade && !verComoCliente.ativo;
  const publicado = pagina.published_blocks;
  const temAlteracoes = podeEditar && JSON.stringify(blocos) !== JSON.stringify(publicado ?? []);
  // Quem não edita só enxerga o publicado; quem edita enxerga o rascunho (que é o que está escrevendo).
  const visiveis: Bloco[] = podeEditar ? blocos : (publicado ?? []);
  const vazio = visiveis.length === 0;

  async function aoPublicar() {
    setOcupado(true);
    if (await publicar()) toast.success(t("Página publicada. O cliente já pode ver."));
    setOcupado(false);
  }
  async function aoTirarDoAr() {
    setOcupado(true);
    if (await tirarDoAr())
      toast.success(t("A página saiu do ar. O cliente volta a ver “em breve”."));
    setOcupado(false);
  }
  function comecarComModelo() {
    editar(modeloDoModulo(chave, randomId));
  }

  const textoDoEstado =
    estado === "salvando"
      ? t("Salvando…")
      : estado === "pendente"
        ? t("Alterações não salvas")
        : estado === "erro"
          ? t("Não foi possível salvar")
          : t("Rascunho salvo");

  const tituloAtual = subpagina ? pagina.title || titulo : titulo;
  // O link de uma subpágina é o do módulo dela (vale também para as demais subpáginas).
  const chaveDoLink = lerChaveDePagina(chave)?.modulo ?? chave;

  return (
    <div className="flex flex-col gap-6">
      {subpagina ? (
        <CabecalhoDaSubpagina
          chave={chave}
          titulo={tituloAtual}
          tipo={subpagina.tipo}
          voltar={subpagina.voltar}
          podeEditar={podeEditar}
          aoRenomear={renomear}
        />
      ) : null}
      {podeEditarDeVerdade && verComoCliente.ativo ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm"
        >
          <span className="font-medium">{t("Você está vendo como o cliente vê.")}</span>
          <span className="text-muted-foreground">
            {t("Só o que foi publicado aparece, sem botões de edição.")}
          </span>
          <button
            type="button"
            onClick={() => verComoCliente.definir(false)}
            className="ml-auto h-9 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-[var(--color-accent-hover)]"
          >
            {t("Voltar a editar")}
          </button>
        </div>
      ) : null}
      {podeEditar ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 shadow-sm">
          <div
            role="group"
            aria-label={t("Modo da página")}
            className="inline-flex rounded-xl bg-secondary p-0.5"
          >
            {(["editar", "ver"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={modo === m}
                onClick={() => setModo(m)}
                className={cn(
                  "h-8 rounded-[10px] px-3 text-sm font-medium transition-colors",
                  modo === m
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "editar" ? t("Editar") : t("Ver página")}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setApresentando(true)}
            disabled={vazio}
            className="inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-40"
          >
            <Presentation size={16} aria-hidden />
            {t("Apresentar")}
          </button>

          <button
            type="button"
            onClick={() => setCompartilhando(true)}
            className="inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <ShareNetwork size={16} aria-hidden />
            {t("Compartilhar")}
          </button>

          <button
            type="button"
            onClick={() => verComoCliente.definir(true)}
            className="inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <Eye size={16} aria-hidden />
            {t("Ver como cliente")}
          </button>

          <button
            type="button"
            onClick={() => setHistorico(true)}
            className="inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <ClockCounterClockwise size={16} aria-hidden />
            {t("Histórico")}
          </button>

          <span
            className={cn(
              "ml-auto text-xs",
              estado === "erro" ? "text-error-fg" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {textoDoEstado}
          </span>
          {publicado !== null && !temAlteracoes ? (
            <span className="rounded-full bg-success-bg px-2.5 py-1 text-xs font-medium text-success-fg">
              {t("Publicada")}
            </span>
          ) : publicado !== null ? (
            <span className="rounded-full bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning-fg">
              {t("Há alterações não publicadas")}
            </span>
          ) : (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {t("Rascunho")}
            </span>
          )}
          <button
            type="button"
            onClick={() => void aoPublicar()}
            disabled={ocupado || vazio || (publicado !== null && !temAlteracoes)}
            className="h-9 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("Publicar")}
          </button>
          {publicado !== null ? (
            <button
              type="button"
              onClick={() => void aoTirarDoAr()}
              disabled={ocupado}
              className="h-9 rounded-xl border px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              {t("Tirar do ar")}
            </button>
          ) : null}
        </div>
      ) : (
        !vazio && (
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setHistorico(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium shadow-sm transition-colors hover:bg-secondary"
            >
              <ClockCounterClockwise size={16} aria-hidden />
              {t("Histórico")}
            </button>
            <button
              type="button"
              onClick={() => setApresentando(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium shadow-sm transition-colors hover:bg-secondary"
            >
              <Presentation size={16} aria-hidden />
              {t("Apresentar")}
            </button>
          </div>
        )
      )}

      {podeEditar && modo === "editar" ? (
        <>
          {vazio ? (
            <div className="rounded-3xl border-2 border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t("Esta página ainda está em branco. Comece por um modelo ou adicione blocos.")}
              </p>
              <button
                type="button"
                onClick={comecarComModelo}
                className="mt-4 h-10 rounded-xl border bg-card px-4 text-sm font-medium shadow-sm hover:bg-secondary"
              >
                {t("Começar com um modelo básico")}
              </button>
            </div>
          ) : null}
          <EditorDeBlocos
            blocos={blocos}
            aoMudar={editar}
            novoId={randomId}
            tituloDaPagina={tituloAtual}
            chaveDaPagina={chave}
          />
        </>
      ) : vazio ? (
        <OQueVem titulo={textosDeEspera.titulo} itens={textosDeEspera.itens} />
      ) : (
        <article className="rounded-3xl border bg-card p-6 shadow-sm sm:p-10">
          <BlocosRender blocos={visiveis} rotulos={rotulos} />
        </article>
      )}

      {podeEditar ? (
        <CompartilharPagina
          aberto={compartilhando}
          aoFechar={() => setCompartilhando(false)}
          chave={chaveDoLink}
          temPublicado={publicado !== null}
        />
      ) : null}

      <HistoricoDaPagina
        aberto={historico}
        aoFechar={() => setHistorico(false)}
        versoes={retratos.versoes}
        carregando={retratos.carregando}
        atual={publicado}
        rotulos={rotulos}
        agencia={
          podeEditar
            ? {
                aoSalvar: retratos.salvarRetrato,
                aoApagar: retratos.apagarRetrato,
                podeSalvar: publicado !== null,
              }
            : undefined
        }
      />

      {apresentando ? (
        <Apresentacao
          titulo={tituloAtual}
          descricao={descricao}
          superior={superior}
          tom={tom}
          icone={icone}
          blocos={visiveis}
          rotulos={rotulos}
          aoFechar={() => setApresentando(false)}
        />
      ) : null}
    </div>
  );
}
