"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CapturaRapida } from "@/components/anotacoes/CapturaRapida";
import { EditorDeNotasCarregavel } from "@/components/anotacoes/EditorDeNotasCarregavel";
import { useArvoreDeNotas } from "@/hooks/anotacoes/useArvoreDeNotas";
import { useCapturaDeNotas } from "@/hooks/anotacoes/useCapturaDeNotas";
import { useEstadoDasNotas } from "@/hooks/anotacoes/useEstadoDasNotas";
import { useNota } from "@/hooks/anotacoes/useNota";
import { useT } from "@/hooks/i18n/useT";
import { montarArvore, type NoDaArvore, type ResumoDaNota } from "@/lib/anotacoes/paginas";
import { ArrowSquareOut, CaretDown, Note, Plus, PushPin } from "@/lib/ui/icons";

function achatar(nos: NoDaArvore[], nivel = 0): Array<{ nota: ResumoDaNota; nivel: number }> {
  return nos.flatMap((n) => [{ nota: n.nota, nivel }, ...achatar(n.filhas, nivel + 1)]);
}

/** Uma página aberta DENTRO do cartão: o mesmo editor e o mesmo salvamento sozinho da tela de Anotações. */
function PaginaNoCartao({
  id,
  notas,
  podeEditar,
  aoAbrir,
  aoCriarSubpagina,
  aoRemoverSubpagina,
  aoReordenarSubpaginas,
}: {
  id: string;
  notas: ResumoDaNota[];
  podeEditar: boolean;
  aoAbrir: (id: string) => void;
  aoCriarSubpagina: (paiId: string) => Promise<string | null>;
  aoRemoverSubpagina: (id: string) => void;
  aoReordenarSubpaginas: (ids: string[]) => void;
}) {
  const t = useT();
  const { pagina, estado, editar, carregando, falhou } = useNota(id);
  if (carregando) {
    return <div className="h-32 animate-pulse rounded-xl bg-secondary" aria-busy="true" />;
  }
  if (falhou || !pagina) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("Não foi possível carregar a página.")}
      </p>
    );
  }
  return (
    <div className="relative">
      {podeEditar && estado !== "salvo" ? (
        <span
          aria-live="polite"
          className="absolute top-0 right-0 text-[11px] text-muted-foreground"
        >
          {estado === "salvando"
            ? t("Salvando…")
            : estado === "erro"
              ? t("Não foi possível salvar")
              : t("Alterações não salvas")}
        </span>
      ) : null}
      <EditorDeNotasCarregavel
        compacto
        inicial={pagina.blocks}
        editavel={podeEditar}
        paginas={notas}
        paginaId={id}
        aoMudar={editar}
        aoAbrir={aoAbrir}
        aoCriarSubpagina={() => aoCriarSubpagina(id)}
        aoRemoverSubpagina={aoRemoverSubpagina}
        aoReordenarSubpaginas={aoReordenarSubpaginas}
      />
    </div>
  );
}

/**
 * O cartão "NOTAS" do Início: mostra uma página de Anotações e deixa escrever nela ali mesmo. O
 * seletor troca de página; a ESCOLHIDA POR ÚLTIMO fica fixada (guardada por pessoa) e é a que abre da
 * próxima vez. A tela de Anotações continua inteira no menu, com todas as páginas.
 *
 * Quem não é da agência só vê o cartão se alguma página foi liberada para ele.
 */
export function NotasDoInicio() {
  const t = useT();
  const router = useRouter();
  const arvore = useArvoreDeNotas();
  const estado = useEstadoDasNotas();
  const { notas, podeEditar } = arvore;
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [capturando, setCapturando] = useState(false);
  const { capturar, versao } = useCapturaDeNotas((id) => router.push(`/app/anotacoes?p=${id}`));

  const vivas = useMemo(() => notas.filter((n) => !n.deleted_at), [notas]);
  const opcoes = useMemo(() => achatar(montarArvore(vivas)), [vivas]);
  const alvoId = escolhida ?? estado.inicio;
  const alvo = vivas.find((n) => n.id === alvoId) ?? null;

  if (arvore.carregando || !estado.carregado) {
    return <div className="h-48 animate-pulse rounded-2xl bg-secondary" aria-busy="true" />;
  }
  if (arvore.falhou || (!podeEditar && vivas.length === 0)) return null;

  function escolher(id: string) {
    if (!id) return;
    setEscolhida(id);
    void estado.fixarNoInicio(id);
  }

  async function criarPrimeira() {
    const nova = await arvore.criar(null, t("Início"));
    if (nova) escolher(nova.id);
  }

  return (
    <section
      aria-labelledby="inicio-notas"
      className="flex min-w-0 flex-col rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2
          id="inicio-notas"
          className="flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <span className="text-muted-foreground">
            <Note size={18} aria-hidden />
          </span>
          {t("Notas")}
        </h2>
        <div className="flex min-w-0 items-center gap-2">
          {podeEditar ? (
            <button
              type="button"
              onClick={() => setCapturando(true)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-medium shadow-sm hover:bg-secondary"
            >
              <Plus size={14} aria-hidden /> {t("Captura rápida")}
            </button>
          ) : null}
          <div className="relative min-w-0">
            <PushPin
              size={14}
              weight="fill"
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-error"
            />
            <select
              value={alvo?.id ?? ""}
              onChange={(e) => escolher(e.target.value)}
              aria-label={t("Página das notas")}
              className="h-9 w-full max-w-[18rem] min-w-[11rem] appearance-none rounded-xl border bg-background pr-8 pl-8 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            >
              {!alvo ? <option value="">{t("Escolha uma página")}</option> : null}
              {opcoes.map(({ nota, nivel }) => (
                <option key={nota.id} value={nota.id}>
                  {"  ".repeat(nivel)}
                  {nota.icon ? `${nota.icon} ` : ""}
                  {nota.title || t("Sem título")}
                </option>
              ))}
            </select>
            <CaretDown
              size={14}
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
            />
          </div>
          {alvo ? (
            <Link
              href={`/app/anotacoes?p=${alvo.id}`}
              aria-label={t("Abrir em Anotações")}
              title={t("Abrir em Anotações")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ArrowSquareOut size={18} aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>

      {alvo ? (
        <div className="max-h-[36rem] overflow-y-auto pr-1">
          <PaginaNoCartao
            key={`${alvo.id}-${versao}`}
            id={alvo.id}
            notas={notas}
            podeEditar={podeEditar}
            aoAbrir={(id) => router.push(`/app/anotacoes?p=${id}`)}
            aoCriarSubpagina={async (paiId) => (await arvore.criar(paiId))?.id ?? null}
            aoRemoverSubpagina={(id) => void arvore.apagar(id)}
            aoReordenarSubpaginas={(ids) => {
              ids.forEach((id, i) => {
                if (notas.find((n) => n.id === id)?.position !== i + 1) {
                  void arvore.mudar(id, { position: i + 1 });
                }
              });
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            {vivas.length === 0
              ? t("Você ainda não tem páginas. Crie uma para despejar suas anotações aqui.")
              : t("Escolha no seletor a página que fica fixa aqui no Início.")}
          </p>
          {podeEditar && vivas.length === 0 ? (
            <button
              type="button"
              onClick={() => void criarPrimeira()}
              className="flex h-9 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium shadow-sm hover:bg-secondary"
            >
              <Plus size={14} aria-hidden /> {t("Criar a página “Início”")}
            </button>
          ) : null}
        </div>
      )}

      <CapturaRapida
        enterSalva
        aberto={capturando}
        aoFechar={() => setCapturando(false)}
        aoCapturar={capturar}
      />
    </section>
  );
}
