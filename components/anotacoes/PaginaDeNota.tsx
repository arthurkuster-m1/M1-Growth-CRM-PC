"use client";

import { useEffect, useRef, useState } from "react";

import { EditorDeNotasCarregavel } from "@/components/anotacoes/EditorDeNotasCarregavel";
import { EtiquetasDaNota } from "@/components/anotacoes/EtiquetasDaNota";
import { Botao, Esqueleto } from "@/components/anotacoes/kit-visual";
import { CardsDasNotas } from "@/components/anotacoes/ListaDeNotas";
import { SeletorDeIcone } from "@/components/anotacoes/SeletorDeIcone";
import { Switch } from "@/components/ui/switch";
import { useNota } from "@/hooks/anotacoes/useNota";
import { useT } from "@/hooks/i18n/useT";
import { caminhoDaNota, type ResumoDaNota } from "@/lib/anotacoes/paginas";
import { CaretRight, DotsThree, Eye, Plus, Star, Trash } from "@/lib/ui/icons";

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
  aoOpcoes,
  favorita,
  aoFavoritar,
}: {
  id: string;
  favorita: boolean;
  aoFavoritar: (favorita: boolean) => void;
  notas: ResumoDaNota[];
  podeEditar: boolean;
  aoMudar: (
    id: string,
    mudanca: Partial<Pick<ResumoDaNota, "title" | "icon" | "visible_to_client" | "tags">>,
    opcoes?: { cascade?: boolean },
  ) => Promise<boolean>;
  aoApagar: (id: string) => void;
  aoAbrir: (id: string) => void;
  aoCriarSubpagina: (paiId: string) => Promise<string | null>;
  /** A "⋯" de um cartão de subpágina. */
  aoOpcoes: (id: string) => void;
}) {
  const t = useT();
  const { pagina, estado, editar, carregando, falhou } = useNota(id);
  const resumo = notas.find((n) => n.id === id);
  const caminho = caminhoDaNota(notas, id);
  const filhas = notas
    .filter((n) => n.parent_id === id && !n.deleted_at)
    .sort((a, b) => a.position - b.position);
  const temFilhas = filhas.length > 0;
  const etiquetasUsadas = [...new Set(notas.flatMap((n) => n.tags))];

  const [titulo, setTitulo] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tituloAtual = titulo ?? resumo?.title ?? "";

  // o menu "⋯": visibilidade, subpáginas, lixeira
  const [menu, setMenu] = useState(false);
  const caixaMenu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const fora = (e: PointerEvent) => {
      if (!caixaMenu.current?.contains(e.target as Node)) setMenu(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenu(false);
      }
    };
    document.addEventListener("pointerdown", fora, true);
    document.addEventListener("keydown", tecla, true);
    return () => {
      document.removeEventListener("pointerdown", fora, true);
      document.removeEventListener("keydown", tecla, true);
    };
  }, [menu]);

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

  if (carregando) return <Esqueleto h={192} />;
  if (falhou || !pagina || !resumo) {
    return (
      <p className="an-t-corpo" role="alert" style={{ color: "var(--color-error-fg)" }}>
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
  const tom =
    estado === "salvando"
      ? "salvando"
      : estado === "pendente"
        ? "aviso"
        : estado === "erro"
          ? "erro"
          : "salvo";

  return (
    <div className="an-pagina" data-testid="pagina-aberta">
      {caminho.length > 1 ? (
        <nav aria-label={t("Caminho")} className="an-migalha">
          {caminho.slice(0, -1).map((c) => (
            <span key={c.id}>
              <button type="button" onClick={() => aoAbrir(c.id)}>
                {c.icon ? `${c.icon} ` : ""}
                {c.title || t("Sem título")}
              </button>
              <CaretRight size={10} aria-hidden />
            </span>
          ))}
          <b>{resumo.title || t("Sem título")}</b>
        </nav>
      ) : null}

      <header className="an-cabeca">
        <div className="an-cabeca__linha">
          <SeletorDeIcone
            icone={resumo.icon}
            podeEditar={podeEditar}
            aoEscolher={(icone) => void aoMudar(id, { icon: icone })}
          />
          {podeEditar ? (
            <input
              className="an-titulo-pagina"
              value={tituloAtual}
              onChange={(e) => digitarTitulo(e.target.value)}
              onBlur={fecharTitulo}
              maxLength={200}
              placeholder={t("Sem título")}
              aria-label={t("Título da página")}
              data-testid="titulo-pagina"
            />
          ) : (
            <h1 className="an-titulo-pagina">{resumo.title || t("Sem título")}</h1>
          )}
          <button
            type="button"
            className="an-favorito"
            onClick={() => aoFavoritar(!favorita)}
            aria-pressed={favorita}
            aria-label={favorita ? t("Tirar dos favoritos") : t("Favoritar")}
            title={favorita ? t("Tirar dos favoritos") : t("Favoritar")}
            data-testid="favoritar"
          >
            <Star
              size={20}
              weight={favorita ? "fill" : "regular"}
              className={favorita ? "an-favorito__ligado" : undefined}
              aria-hidden
            />
          </button>
          {podeEditar ? (
            <span
              className="an-ponto"
              data-tom={tom}
              role="status"
              aria-label={textoDoEstado}
              title={textoDoEstado}
              data-testid="ponto-salvamento"
            />
          ) : null}
          {podeEditar ? (
            <div className="an-menu-pagina" ref={caixaMenu}>
              <button
                type="button"
                className="an-favorito"
                onClick={() => setMenu((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menu}
                aria-label={t("Mais opções da página")}
                title={t("Mais opções")}
                data-testid="menu-pagina"
              >
                <DotsThree size={22} weight="bold" aria-hidden />
              </button>
              {menu ? (
                <div
                  className="an-menu an-menu--pagina"
                  role="menu"
                  data-testid="menu-pagina-itens"
                >
                  <div className="an-menu__linha-comp">
                    <Eye size={16} aria-hidden />
                    <span className="an-menu__texto">
                      <b>{t("Visível ao cliente")}</b>
                      <small>{t("o cliente só lê")}</small>
                    </span>
                    <Switch
                      checked={resumo.visible_to_client}
                      onCheckedChange={(valor) =>
                        void aoMudar(id, { visible_to_client: valor }, { cascade: false })
                      }
                      aria-label={t("Visível ao cliente")}
                    />
                  </div>
                  {temFilhas ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="an-menu__item an-menu__item--linha"
                      onClick={() => {
                        void aoMudar(
                          id,
                          { visible_to_client: resumo.visible_to_client },
                          { cascade: true },
                        );
                        setMenu(false);
                      }}
                    >
                      <span className="an-menu__texto">
                        <b>
                          {resumo.visible_to_client
                            ? t("Liberar também as subpáginas")
                            : t("Esconder também as subpáginas")}
                        </b>
                      </span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    className="an-menu__item an-menu__item--linha is-perigo"
                    onClick={() => {
                      setMenu(false);
                      aoApagar(id);
                    }}
                    data-testid="menu-lixeira"
                  >
                    <Trash size={16} aria-hidden />
                    <span className="an-menu__texto">
                      <b>{t("Mandar para a lixeira")}</b>
                    </span>
                  </button>
                  <p className="an-menu__estado" aria-live="polite" data-testid="estado-salvamento">
                    {textoDoEstado}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <EtiquetasDaNota
          etiquetas={resumo.tags}
          podeEditar={podeEditar}
          sugestoes={etiquetasUsadas}
          aoMudar={(tags) => void aoMudar(id, { tags })}
        />
      </header>

      <EditorDeNotasCarregavel inicial={pagina.blocks} editavel={podeEditar} aoMudar={editar} />

      {temFilhas || podeEditar ? (
        <section aria-label={t("Subpáginas")} className="an-subpaginas">
          <div className="an-lista-cab" style={{ alignItems: "center" }}>
            <h2 className="an-t-h2">{t("Subpáginas")}</h2>
            {podeEditar ? (
              <Botao
                variant="secondary"
                size="sm"
                icon={<Plus size={14} weight="bold" aria-hidden />}
                onClick={() => void aoCriarSubpagina(id).then((novo) => novo && aoAbrir(novo))}
                data-testid="nova-subpagina"
              >
                {t("Nova subpágina")}
              </Botao>
            ) : null}
          </div>
          {temFilhas ? (
            <CardsDasNotas
              paginas={filhas}
              favoritas={[]}
              podeEditar={podeEditar}
              aoAbrir={aoAbrir}
              aoOpcoes={aoOpcoes}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
