"use client";

import { useEffect, useRef, useState } from "react";

import { EditorDeNotasCarregavel } from "@/components/anotacoes/EditorDeNotasCarregavel";
import { SeletorDeIcone } from "@/components/anotacoes/SeletorDeIcone";
import { Switch } from "@/components/ui/switch";
import { useNota } from "@/hooks/anotacoes/useNota";
import { useT } from "@/hooks/i18n/useT";
import { caminhoDaNota, type ResumoDaNota } from "@/lib/anotacoes/paginas";
import { CaretRight, Eye, Trash } from "@/lib/ui/icons";

const ESPERA_DO_TITULO_MS = 600;

/**
 * Uma PÁGINA de anotação aberta: ícone, título editável, visibilidade ao cliente e o editor de
 * blocos da Estratégia, salvo sozinho. Quem não é da agência só lê (e só vê o que foi liberado).
 * Use sempre com `key={id}`: cada página começa com o estado dela.
 */
export function PaginaDeNota({
  id,
  notas,
  podeEditar,
  aoMudar,
  aoApagar,
  aoAbrir,
  aoCriarSubpagina,
  aoReordenarSubpaginas,
}: {
  id: string;
  notas: ResumoDaNota[];
  podeEditar: boolean;
  aoMudar: (
    id: string,
    mudanca: Partial<Pick<ResumoDaNota, "title" | "icon" | "visible_to_client">>,
    opcoes?: { cascade?: boolean },
  ) => Promise<boolean>;
  aoApagar: (id: string) => void;
  aoAbrir: (id: string) => void;
  aoCriarSubpagina: (paiId: string) => Promise<string | null>;
  aoReordenarSubpaginas: (ids: string[]) => void;
}) {
  const t = useT();
  const { pagina, estado, editar, carregando, falhou } = useNota(id);
  const resumo = notas.find((n) => n.id === id);
  const caminho = caminhoDaNota(notas, id);
  const temFilhas = notas.some((n) => n.parent_id === id && !n.deleted_at);

  const [titulo, setTitulo] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tituloAtual = titulo ?? resumo?.title ?? "";

  function digitarTitulo(valor: string) {
    setTitulo(valor);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      temporizador.current = undefined;
      void aoMudar(id, { title: valor.trim() });
    }, ESPERA_DO_TITULO_MS);
  }
  // Saiu da página com o título pendente: grava agora.
  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );
  function fecharTitulo() {
    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = undefined;
      if (titulo !== null) void aoMudar(id, { title: titulo.trim() });
    }
  }

  if (carregando) {
    return <div className="h-48 animate-pulse rounded-3xl bg-secondary" aria-busy="true" />;
  }
  if (falhou || !pagina || !resumo) {
    return (
      <p className="rounded-xl border border-error/30 bg-error-bg px-4 py-3 text-sm text-error-fg">
        {t("Não foi possível carregar a página.")}
      </p>
    );
  }

  const textoDoEstado =
    estado === "salvando"
      ? t("Salvando…")
      : estado === "pendente"
        ? t("Alterações não salvas")
        : estado === "erro"
          ? t("Não foi possível salvar")
          : t("Salvo");

  return (
    <div className="flex flex-col gap-5">
      {caminho.length > 1 ? (
        <nav aria-label={t("Caminho")} className="flex flex-wrap items-center gap-1 text-xs">
          {caminho.slice(0, -1).map((c) => (
            <span key={c.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => aoAbrir(c.id)}
                className="max-w-[16rem] truncate text-muted-foreground hover:text-foreground hover:underline"
              >
                {c.icon ? `${c.icon} ` : ""}
                {c.title || t("Sem título")}
              </button>
              <CaretRight size={10} aria-hidden className="text-muted-foreground" />
            </span>
          ))}
          <span className="font-medium">{resumo.title || t("Sem título")}</span>
        </nav>
      ) : null}

      <header className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <SeletorDeIcone
            icone={resumo.icon}
            podeEditar={podeEditar}
            aoEscolher={(icone) => void aoMudar(id, { icon: icone })}
          />
          {podeEditar ? (
            <input
              value={tituloAtual}
              onChange={(e) => digitarTitulo(e.target.value)}
              onBlur={fecharTitulo}
              maxLength={200}
              placeholder={t("Sem título")}
              aria-label={t("Título da página")}
              className="w-full min-w-0 bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/60"
            />
          ) : (
            <h1 className="w-full min-w-0 text-3xl font-bold tracking-tight">
              {resumo.title || t("Sem título")}
            </h1>
          )}
        </div>

        {podeEditar ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b pb-3 text-xs text-muted-foreground">
            <label className="flex items-center gap-2">
              <Switch
                checked={resumo.visible_to_client}
                onCheckedChange={(valor) =>
                  void aoMudar(id, { visible_to_client: valor }, { cascade: false })
                }
                aria-label={t("Visível ao cliente")}
              />
              <span className="flex items-center gap-1">
                <Eye size={14} aria-hidden />
                {t("Visível ao cliente")}
              </span>
            </label>
            {temFilhas ? (
              <button
                type="button"
                onClick={() =>
                  void aoMudar(
                    id,
                    { visible_to_client: resumo.visible_to_client },
                    { cascade: true },
                  )
                }
                className="underline-offset-2 hover:text-foreground hover:underline"
              >
                {resumo.visible_to_client
                  ? t("Liberar também as subpáginas")
                  : t("Esconder também as subpáginas")}
              </button>
            ) : null}
            <span aria-live="polite">{textoDoEstado}</span>
            <button
              type="button"
              onClick={() => aoApagar(id)}
              className="ml-auto flex items-center gap-1 hover:text-error-fg"
            >
              <Trash size={14} aria-hidden />
              {t("Mandar para a lixeira")}
            </button>
          </div>
        ) : null}
      </header>

      <EditorDeNotasCarregavel
        inicial={pagina.blocks}
        editavel={podeEditar}
        paginas={notas}
        paginaId={id}
        aoMudar={editar}
        aoAbrir={aoAbrir}
        aoCriarSubpagina={() => aoCriarSubpagina(id)}
        aoRemoverSubpagina={aoApagar}
        aoReordenarSubpaginas={aoReordenarSubpaginas}
      />
    </div>
  );
}
