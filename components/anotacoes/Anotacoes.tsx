"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ArvoreDeNotas } from "@/components/anotacoes/ArvoreDeNotas";
import { LixeiraDeNotas } from "@/components/anotacoes/LixeiraDeNotas";
import { MoverNota } from "@/components/anotacoes/MoverNota";
import { PaginaDeNota } from "@/components/anotacoes/PaginaDeNota";
import { useArvoreDeNotas } from "@/hooks/anotacoes/useArvoreDeNotas";
import { useT } from "@/hooks/i18n/useT";
import { caminhoDaNota, idsDaSubarvore } from "@/lib/anotacoes/paginas";
import { Note, Plus } from "@/lib/ui/icons";

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
      </aside>

      <section className="min-w-0">
        {selecionada ? (
          <PaginaDeNota
            key={selecionada}
            id={selecionada}
            notas={notas}
            podeEditar={podeEditar}
            aoMudar={arvore.mudar}
            aoApagar={(id) => void apagar(id)}
            aoAbrir={abrir}
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
