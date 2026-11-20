"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CapturaRapida } from "@/components/anotacoes/CapturaRapida";
import { Botao, Esqueleto, Folha } from "@/components/anotacoes/kit-visual";
import { ListaDeNotas } from "@/components/anotacoes/ListaDeNotas";
import { LixeiraDeNotas } from "@/components/anotacoes/LixeiraDeNotas";
import { MoverNota } from "@/components/anotacoes/MoverNota";
import { PaginaDeNota } from "@/components/anotacoes/PaginaDeNota";
import { useArvoreDeNotas } from "@/hooks/anotacoes/useArvoreDeNotas";
import { useCapturaDeNotas } from "@/hooks/anotacoes/useCapturaDeNotas";
import { useEstadoDasNotas } from "@/hooks/anotacoes/useEstadoDasNotas";
import { useT } from "@/hooks/i18n/useT";
import { idsDaSubarvore } from "@/lib/anotacoes/paginas";
import { ArrowBendUpLeft, ArrowLeft, Eye, Plus, Trash } from "@/lib/ui/icons";

/**
 * ANOTAÇÕES — igual ao app da Família Kuster: o início é a lista de páginas (tabela ou cards);
 * clicar numa página abre ela INTEIRA (editor de blocos da Estratégia), sem menu lateral. A página
 * aberta fica na URL (`?p=`), então dá para voltar e compartilhar o link; "← Anotações" volta à lista.
 * A mesma tela serve à agência (na organização dela) e a cada cliente.
 */
export function Anotacoes({
  rotuloSuperior,
  descricao,
}: {
  /** Linha pequena acima do título da lista (ex.: "Modo agência"). */
  rotuloSuperior?: string;
  /** O texto de apoio sob o título. */
  descricao?: string;
} = {}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();
  const arvore = useArvoreDeNotas();
  const { notas, podeEditar } = arvore;

  const pedida = parametros.get("p");
  const selecionada = useMemo(
    () => (pedida && notas.find((n) => n.id === pedida && !n.deleted_at) ? pedida : null),
    [notas, pedida],
  );

  const estado = useEstadoDasNotas();
  const [capturando, setCapturando] = useState(false);
  const { capturar, versao } = useCapturaDeNotas(abrir);
  const [movendo, setMovendo] = useState<string | null>(null);
  const [opcoesDe, setOpcoesDe] = useState<string | null>(null);

  // Abrir uma página a coloca em "Recentes" (preferência pessoal, gravada em silêncio).
  const { registrarAbertura } = estado;
  useEffect(() => {
    if (selecionada) registrarAbertura(selecionada);
  }, [selecionada, registrarAbertura]);

  function abrir(id: string | null) {
    const url = id ? `${pathname}?p=${id}` : pathname;
    router.replace(url, { scroll: false });
  }

  async function criar(parentId: string | null) {
    const nova = await arvore.criar(parentId);
    if (!nova) return;
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
    toast(t("Página movida."), {
      action: { label: t("Desfazer"), onClick: () => void arvore.mudar(id, anterior) },
    });
  }

  function reordenar(mudancas: Array<{ id: string; position: number }>) {
    for (const m of mudancas) void arvore.mudar(m.id, { position: m.position });
  }

  const alvoOpcoes = opcoesDe ? (notas.find((n) => n.id === opcoesDe) ?? null) : null;
  const alvoMover = movendo ? (notas.find((n) => n.id === movendo) ?? null) : null;

  if (arvore.carregando) {
    return (
      <div className="an-raiz">
        <Esqueleto h={256} />
      </div>
    );
  }
  if (arvore.falhou) {
    return (
      <div className="an-raiz">
        <div className="an-cartao">
          <p className="an-t-corpo" role="alert" style={{ color: "var(--color-error-fg)" }}>
            {t("Não foi possível carregar as anotações.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="an-raiz" data-testid="anotacoes">
      {selecionada ? (
        <>
          <Botao
            variant="ghost"
            size="sm"
            className="an-voltar"
            icon={<ArrowLeft size={14} aria-hidden />}
            onClick={() => abrir(null)}
            data-testid="voltar-lista"
          >
            {t("Anotações")}
          </Botao>
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
            aoOpcoes={setOpcoesDe}
            aoCriarSubpagina={async (paiId) => {
              const nova = await arvore.criar(paiId);
              return nova?.id ?? null;
            }}
          />
        </>
      ) : (
        <div className="an-pilha" style={{ gap: 20 }}>
          <ListaDeNotas
            notas={notas}
            favoritas={estado.favoritas}
            podeEditar={podeEditar}
            rotuloSuperior={rotuloSuperior}
            descricao={
              descricao ??
              t("Clique numa página para abri-la e editar. Arraste pela alça (⋮⋮) para reordenar.")
            }
            aoAbrir={abrir}
            aoCriar={() => void criar(null)}
            aoCapturar={() => setCapturando(true)}
            aoOpcoes={setOpcoesDe}
            aoReordenar={reordenar}
          />
          {podeEditar ? (
            <LixeiraDeNotas
              notas={notas}
              aoRestaurar={(id) => void arvore.restaurar(id)}
              aoApagarDeVez={(id) => void arvore.apagarDeVez(id)}
            />
          ) : null}
        </div>
      )}

      <CapturaRapida
        aberto={capturando}
        aoFechar={() => setCapturando(false)}
        aoCapturar={capturar}
      />

      <MoverNota
        nota={alvoMover}
        notas={notas}
        aoFechar={() => setMovendo(null)}
        aoEscolher={(pai) => {
          if (movendo) void mover(movendo, pai);
          setMovendo(null);
        }}
      />

      <Folha
        open={alvoOpcoes !== null}
        onClose={() => setOpcoesDe(null)}
        title={
          alvoOpcoes
            ? `${alvoOpcoes.icon ?? "📄"} ${alvoOpcoes.title || t("Sem título")}`
            : t("Opções")
        }
      >
        {alvoOpcoes ? (
          <div className="an-pilha" style={{ gap: 8 }}>
            <Botao
              variant="secondary"
              block
              icon={<Plus size={14} aria-hidden />}
              onClick={() => {
                const id = alvoOpcoes.id;
                setOpcoesDe(null);
                void criar(id);
              }}
            >
              {t("Nova subpágina")}
            </Botao>
            {alvoOpcoes.kind === null ? (
              <Botao
                variant="secondary"
                block
                icon={<ArrowBendUpLeft size={14} aria-hidden />}
                onClick={() => {
                  setMovendo(alvoOpcoes.id);
                  setOpcoesDe(null);
                }}
              >
                {t("Mover para…")}
              </Botao>
            ) : null}
            <Botao
              variant="secondary"
              block
              icon={<Eye size={14} aria-hidden />}
              onClick={() => {
                void arvore.mudar(alvoOpcoes.id, {
                  visible_to_client: !alvoOpcoes.visible_to_client,
                });
                setOpcoesDe(null);
              }}
            >
              {alvoOpcoes.visible_to_client
                ? t("Esconder do cliente")
                : t("Mostrar para o cliente")}
            </Botao>
            <Botao
              variant="danger"
              block
              icon={<Trash size={14} aria-hidden />}
              onClick={() => {
                const id = alvoOpcoes.id;
                setOpcoesDe(null);
                void apagar(id);
              }}
              data-testid="opcao-lixeira"
            >
              {t("Mandar para a lixeira")}
            </Botao>
          </div>
        ) : null}
      </Folha>
    </div>
  );
}
