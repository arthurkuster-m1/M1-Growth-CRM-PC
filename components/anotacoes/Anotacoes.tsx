"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AtalhosDeNotas } from "@/components/anotacoes/AtalhosDeNotas";
import { CapturaRapida } from "@/components/anotacoes/CapturaRapida";
import { ArvoreDeNotas } from "@/components/anotacoes/ArvoreDeNotas";
import { LixeiraDeNotas } from "@/components/anotacoes/LixeiraDeNotas";
import { MoverNota } from "@/components/anotacoes/MoverNota";
import { PaginaDeNota } from "@/components/anotacoes/PaginaDeNota";
import { useArvoreDeNotas } from "@/hooks/anotacoes/useArvoreDeNotas";
import { useBuscaDeNotas } from "@/hooks/anotacoes/useBuscaDeNotas";
import { useEstadoDasNotas } from "@/hooks/anotacoes/useEstadoDasNotas";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { useT } from "@/hooks/i18n/useT";
import { caminhoDaNota, idsDaSubarvore } from "@/lib/anotacoes/paginas";
import { MagnifyingGlass, Note, Plus, Tray, X } from "@/lib/ui/icons";

/**
 * ANOTAÇÕES — o bloco de notas: árvore de páginas à esquerda, a página aberta à direita (no editor
 * de blocos da Estratégia). A página aberta fica na URL (`?p=`), então dá para voltar e compartilhar.
 * A mesma tela serve à agência (na organização dela) e a cada cliente.
 */
export function Anotacoes() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();
  const arvore = useArvoreDeNotas();
  const { notas, podeEditar } = arvore;

  const pedida = parametros.get("p");
  const selecionada = useMemo(() => {
    const viva = (id: string | null) =>
      id ? notas.find((n) => n.id === id && !n.deleted_at) : undefined;
    return viva(pedida)?.id ?? null;
  }, [notas, pedida]);

  const queryClient = useQueryClient();
  const estado = useEstadoDasNotas();
  const [busca, setBusca] = useState("");
  const resultados = useBuscaDeNotas(busca);
  const [capturando, setCapturando] = useState(false);
  // Sobe a cada captura: a página aberta (se for a Caixa de entrada) é relida em vez de sobrescrita.
  const [versao, setVersao] = useState(0);
  const caixa = notas.find((n) => n.kind === "inbox" && !n.deleted_at);

  // Abrir uma página a coloca em "Recentes" (preferência pessoal, gravada em silêncio).
  const { registrarAbertura } = estado;
  useEffect(() => {
    if (selecionada) registrarAbertura(selecionada);
  }, [selecionada, registrarAbertura]);

  async function capturar(texto: string): Promise<boolean> {
    try {
      const r = await apiClient.post<{ data: { page_id: string } }>("/api/v1/anotacoes/captura", {
        texto,
      });
      queryClient.removeQueries({ queryKey: ["anotacoes", "pagina", r.data.page_id] });
      await queryClient.invalidateQueries({ queryKey: ["anotacoes", "arvore"] });
      setVersao((v) => v + 1);
      toast.success(t("Guardado na Caixa de entrada."), {
        action: { label: t("Abrir"), onClick: () => abrir(r.data.page_id) },
      });
      return true;
    } catch (erro) {
      showApiError(erro);
      return false;
    }
  }

  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [movendo, setMovendo] = useState<string | null>(null);

  // A página aberta mostra o caminho até ela: ao trocar de página, abre as mães (ajuste durante o
  // desenho, o jeito do React para derivar estado de uma mudança de entrada).
  const [vista, setVista] = useState<string | null>(null);
  if (selecionada !== vista) {
    setVista(selecionada);
    if (selecionada) {
      const maes = caminhoDaNota(notas, selecionada)
        .slice(0, -1)
        .map((n) => n.id);
      if (maes.some((m) => !abertas.has(m))) setAbertas(new Set([...abertas, ...maes]));
    }
  }

  function abrir(id: string | null) {
    const url = id ? `${pathname}?p=${id}` : pathname;
    router.replace(url, { scroll: false });
  }

  function alternar(id: string) {
    setAbertas((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(id)) novo.add(id);
      return novo;
    });
  }

  async function criar(parentId: string | null) {
    const nova = await arvore.criar(parentId);
    if (!nova) return;
    if (parentId) setAbertas((a) => new Set([...a, parentId]));
    abrir(nova.id);
  }

  async function apagar(id: string) {
    const nota = notas.find((n) => n.id === id);
    if (!(await arvore.apagar(id))) return;
    if (selecionada && idsDaSubarvore(notas, id).includes(selecionada)) abrir(null);
    toast(t("Página enviada para a lixeira."), {
      description: nota?.title || undefined,
      action: { label: t("Desfazer"), onClick: () => void arvore.restaurar(id) },
    });
  }

  async function mover(id: string, parentId: string | null) {
    const nota = notas.find((n) => n.id === id);
    if (!nota || nota.parent_id === parentId) return;
    const irmas = notas.filter((n) => n.parent_id === parentId && !n.deleted_at);
    const posicao = irmas.length ? Math.max(...irmas.map((n) => n.position)) + 1 : 1;
    const anterior = { parent_id: nota.parent_id, position: nota.position };
    if (!(await arvore.mudar(id, { parent_id: parentId, position: posicao }))) return;
    if (parentId) setAbertas((a) => new Set([...a, parentId]));
    toast(t("Página movida."), {
      action: { label: t("Desfazer"), onClick: () => void arvore.mudar(id, anterior) },
    });
  }

  function reordenar(mudancas: Array<{ id: string; position: number }>) {
    for (const m of mudancas) void arvore.mudar(m.id, { position: m.position });
  }

  const nota = movendo ? (notas.find((n) => n.id === movendo) ?? null) : null;

  if (arvore.carregando) {
    return <div className="h-64 animate-pulse rounded-3xl bg-secondary" aria-busy="true" />;
  }
  if (arvore.falhou) {
    return (
      <p className="rounded-xl border border-error/30 bg-error-bg px-4 py-3 text-sm text-error-fg">
        {t("Não foi possível carregar as anotações.")}
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside
        aria-label={t("Páginas")}
        className="rounded-2xl border bg-card/40 p-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto"
      >
        <div className="mb-2 flex flex-col gap-1">
          <div className="relative">
            <MagnifyingGlass
              size={14}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={t("Buscar nas anotações")}
              aria-label={t("Buscar nas anotações")}
              className="h-8 w-full rounded-lg border bg-background pr-7 pl-8 text-[13px] outline-none focus:ring-2 focus:ring-primary/40"
            />
            {busca ? (
              <button
                type="button"
                aria-label={t("Limpar busca")}
                onClick={() => setBusca("")}
                className="absolute top-1/2 right-1.5 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-secondary"
              >
                <X size={12} aria-hidden />
              </button>
            ) : null}
          </div>
          {podeEditar ? (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setCapturando(true)}
                className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border bg-card text-[13px] font-medium shadow-sm hover:bg-secondary"
              >
                <Plus size={13} aria-hidden /> {t("Captura rápida")}
              </button>
              {caixa ? (
                <button
                  type="button"
                  onClick={() => abrir(caixa.id)}
                  title={t("Abrir a Caixa de entrada")}
                  aria-label={t("Abrir a Caixa de entrada")}
                  className="grid h-8 w-8 place-items-center rounded-lg border bg-card shadow-sm hover:bg-secondary"
                >
                  <Tray size={15} aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {resultados.ativa ? (
          <ul aria-label={t("Resultados da busca")} className="flex flex-col gap-px">
            {resultados.procurando && resultados.resultados.length === 0 ? (
              <li className="px-2 py-3 text-xs text-muted-foreground">{t("Buscando…")}</li>
            ) : resultados.resultados.length === 0 ? (
              <li className="px-2 py-3 text-xs text-muted-foreground">{t("Nada encontrado.")}</li>
            ) : (
              resultados.resultados.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      abrir(r.id);
                      setBusca("");
                    }}
                    className="flex w-full flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left hover:bg-card/70"
                  >
                    <span className="truncate text-[13px] font-medium">
                      {r.icon ? `${r.icon} ` : ""}
                      {r.title || t("Sem título")}
                    </span>
                    {r.trecho ? (
                      <span className="line-clamp-2 text-xs text-muted-foreground">{r.trecho}</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : (
          <>
            <AtalhosDeNotas
              favoritas={estado.favoritas}
              recentes={estado.recentes}
              notas={notas}
              selecionada={selecionada}
              aoAbrir={abrir}
            />
            <ArvoreDeNotas
              notas={notas}
              selecionada={selecionada}
              podeEditar={podeEditar}
              abertas={abertas}
              aoAlternar={alternar}
              aoAbrir={abrir}
              aoCriar={(pai) => void criar(pai)}
              aoApagar={(id) => void apagar(id)}
              aoMover={setMovendo}
              aoMudarVisibilidade={(id, visivel) =>
                void arvore.mudar(id, { visible_to_client: visivel })
              }
              aoReordenar={reordenar}
            />
            {podeEditar ? (
              <LixeiraDeNotas
                notas={notas}
                aoRestaurar={(id) => void arvore.restaurar(id)}
                aoApagarDeVez={(id) => void arvore.apagarDeVez(id)}
              />
            ) : null}
          </>
        )}
      </aside>

      <section className="min-w-0">
        {selecionada ? (
          <PaginaDeNota
            key={`${selecionada}-${versao}`}
            id={selecionada}
            favorita={estado.favoritas.includes(selecionada)}
            aoFavoritar={(favorita) => void estado.favoritar(selecionada, favorita)}
            notas={notas}
            podeEditar={podeEditar}
            aoMudar={arvore.mudar}
            aoApagar={(id) => void apagar(id)}
            aoAbrir={abrir}
            aoCriarSubpagina={async (paiId) => {
              const nova = await arvore.criar(paiId);
              return nova?.id ?? null;
            }}
            aoReordenarSubpaginas={(ids) =>
              reordenar(
                ids
                  .map((id, i) => ({ id, position: i + 1 }))
                  .filter(
                    ({ id, position }) => notas.find((n) => n.id === id)?.position !== position,
                  ),
              )
            }
          />
        ) : (
          <div className="grid place-items-center gap-3 rounded-3xl border border-dashed p-12 text-center">
            <Note size={36} className="text-muted-foreground" aria-hidden />
            <p className="max-w-sm text-sm text-muted-foreground">
              {podeEditar
                ? t("Escolha uma página na lateral ou crie uma nova para começar a anotar.")
                : t("Escolha uma página na lateral.")}
            </p>
            {podeEditar ? (
              <button
                type="button"
                onClick={() => void criar(null)}
                className="flex h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium shadow-sm hover:bg-secondary"
              >
                <Plus size={14} aria-hidden /> {t("Nova página")}
              </button>
            ) : null}
          </div>
        )}
      </section>

      <CapturaRapida
        aberto={capturando}
        aoFechar={() => setCapturando(false)}
        aoCapturar={capturar}
      />

      <MoverNota
        nota={nota}
        notas={notas}
        aoFechar={() => setMovendo(null)}
        aoEscolher={(pai) => {
          if (movendo) void mover(movendo, pai);
          setMovendo(null);
        }}
      />
    </div>
  );
}
