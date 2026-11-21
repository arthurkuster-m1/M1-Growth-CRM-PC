"use client";

import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FolderSimple, Plus, Tag, Trash } from "@/lib/ui/icons";
import {
  Button,
  ItemOrdenavel,
  ListaOrdenavel,
  OrdenavelRaiz,
  Segmented,
  Sheet,
  Input,
  brl,
  arrayMove,
  useToast,
} from "@/components/financas/kit";
import {
  atualizarCategoria,
  atualizarGrupo,
  criarGrupo,
  excluirGrupo,
  useFinancas,
  type Categoria,
  type GrupoCategoria,
} from "@/lib/financas/dados";
import { planejarReordem, porOrdem } from "@/lib/financas/ordem";
import { FormCategoria, corDaCategoria } from "./FormCategoria";

type Vista = "grupos" | "lista";
const CHAVE_VISTA = "kuster.fin.cat.vista";
function vistaSalva(): Vista {
  try {
    return localStorage.getItem(CHAVE_VISTA) === "lista" ? "lista" : "grupos";
  } catch {
    return "grupos";
  }
}

/* ───────── CATEGORIAS ───────── */
export function CategoriasAba() {
  const { categorias, grupos, recarregar, aplicarOrdem } = useFinancas();
  const [editando, setEditando] = useState<Categoria | "nova" | null>(null);
  const [novaNoGrupo, setNovaNoGrupo] = useState<{
    tipo: "saida" | "entrada";
    grupoId: string | null;
  } | null>(null);
  const [novoGrupo, setNovoGrupo] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [gerindo, setGerindo] = useState(false);
  const [vista, setVista] = useState<Vista>(vistaSalva);
  const escolherVista = (v: Vista) => {
    setVista(v);
    try {
      localStorage.setItem(CHAVE_VISTA, v);
    } catch {
      /* sem armazenamento: tudo bem */
    }
  };

  const gruposVisiveis = useMemo(() => grupos.filter((g) => !g.sistema).sort(porOrdem), [grupos]);
  const usuario = useMemo(() => categorias.filter((c) => c.grupo !== "Sistema"), [categorias]);
  const saidas = usuario.filter((c) => c.tipo === "saida");
  const entradas = usuario.filter((c) => c.tipo === "entrada");
  /** Soltou um item: calcula a nova ordem da lista onde ele estava, mostra na hora e grava no banco. */
  function soltou(contexto: string, idAtivo: string, idSobre: string) {
    const [tipoDeLista, tipo, chave] = contexto.split("|") as [
      "grp" | "cat",
      "saida" | "entrada",
      string | undefined,
    ];
    const limpa = (x: string) => x.slice(x.lastIndexOf(":") + 1); // ids são "c:<uuid>" ou "g:<tipo>:<uuid>"
    const ativo = limpa(idAtivo),
      sobre = limpa(idSobre);
    let completa: { id: string; ordem: number; nome: string }[],
      dentro: { id: string; ordem: number; nome: string }[];
    if (tipoDeLista === "grp") {
      completa = gruposVisiveis;
      dentro = gruposDaSecao(tipo === "saida" ? saidas : entradas);
    } else {
      completa = usuario.filter((c) => c.tipo === tipo);
      const lista = tipo === "saida" ? saidas : entradas;
      dentro =
        chave === "lista"
          ? lista
          : chave === "sem"
            ? lista.filter((c) => !c.group_id || !gruposVisiveis.some((g) => g.id === c.group_id))
            : lista.filter((c) => c.group_id === chave);
    }
    const de = dentro.findIndex((x) => x.id === ativo),
      para = dentro.findIndex((x) => x.id === sobre);
    if (de < 0 || para < 0) return;
    const plano = planejarReordem(completa, arrayMove(dentro, de, para));
    if (plano.length === 0) return;
    const alvo = tipoDeLista === "grp" ? "grupo" : "categoria";
    aplicarOrdem(alvo, plano);
    const gravar = tipoDeLista === "grp" ? atualizarGrupo : atualizarCategoria;
    Promise.all(plano.map((x) => gravar(x.id, { ordem: x.ordem }))).catch(() => recarregar());
  }
  const gruposDaSecao = (lista: Categoria[]) =>
    gruposVisiveis.filter((g) => lista.some((c) => c.group_id === g.id));

  // Só categoria de ENTRADA tem número: a meta de ganho do mês. O orçamento de gastos é o teto do mês.
  const direita = (c: Categoria) => {
    if (c.tipo !== "entrada") return null;
    if (!c.orcamento_mensal_cents)
      return <span className="t-caption t-muted fi-cat-nowrap">sem meta</span>;
    return (
      <span className="fi-item__valor">
        {brl(c.orcamento_mensal_cents)}
        <span className="t-caption t-muted"> /mês</span>
      </span>
    );
  };

  const linhas = (
    tipo: "saida" | "entrada",
    lista: Categoria[],
    chave: string,
    mostrarGrupo: boolean,
  ) => (
    <ListaOrdenavel ids={lista.map((c) => `c:${c.id}`)}>
      <ul className="fi-list">
        {lista.map((c) => {
          const sub = [mostrarGrupo ? c.grupo : null, c.ativa ? null : "arquivada"]
            .filter(Boolean)
            .join(" · ");
          return (
            <ItemOrdenavel
              key={c.id}
              id={`c:${c.id}`}
              contexto={`cat|${tipo}|${chave}`}
              nome={c.nome}
              className={c.ativa ? "fi-item fi-item--cat" : "fi-item fi-item--cat is-arquivada"}
            >
              {({ alca }) => (
                <>
                  {alca}
                  <button type="button" className="fi-item__open" onClick={() => setEditando(c)}>
                    <span className="fi-item__icon" aria-hidden>
                      <Tag size={20} weight="fill" style={{ color: corDaCategoria(c.cor) }} />
                    </span>
                    <span className="fi-item__main">
                      <span className="t-body" style={{ fontWeight: 700 }}>
                        {c.nome}
                      </span>
                      {sub && <span className="t-body-sm t-muted">{sub}</span>}
                    </span>
                    <span className="fi-item__lado">{direita(c)}</span>
                  </button>
                </>
              )}
            </ItemOrdenavel>
          );
        })}
      </ul>
    </ListaOrdenavel>
  );

  const secao = (titulo: string, tipo: "saida" | "entrada", lista: Categoria[]) => {
    if (vista === "lista") {
      return (
        <section className="fi-stack" style={{ gap: 8 }} aria-label={titulo}>
          <h2 className="fi-list__title">{titulo}</h2>
          {lista.length === 0 ? (
            <p className="t-body t-muted">Nenhuma categoria.</p>
          ) : (
            linhas(tipo, lista, "lista", true)
          )}
        </section>
      );
    }
    const comCategorias = gruposDaSecao(lista);
    const semGrupo = lista.filter(
      (c) => !c.group_id || !gruposVisiveis.some((g) => g.id === c.group_id),
    );
    return (
      <section className="fi-stack" aria-label={titulo}>
        <h2 className="fi-list__title">{titulo}</h2>
        {lista.length === 0 && <p className="t-body t-muted">Nenhuma categoria.</p>}
        <ListaOrdenavel ids={comCategorias.map((g) => `g:${tipo}:${g.id}`)}>
          {comCategorias.map((g) => {
            const doGrupo = lista.filter((c) => c.group_id === g.id);
            const ativas = doGrupo.filter((c) => c.ativa);
            return (
              <ItemOrdenavel
                key={g.id}
                as="div"
                id={`g:${tipo}:${g.id}`}
                contexto={`grp|${tipo}`}
                nome={`o grupo ${g.nome}`}
                className="fi-stack fi-grupo-bloco"
              >
                {({ alca }) => (
                  <div data-testid={`grupo-${g.nome}`} className="fi-stack" style={{ gap: 8 }}>
                    <div className="fi-grupo-cab">
                      {alca}
                      <FolderSimple size={18} weight="duotone" aria-hidden />
                      <h3 className="t-h3">{g.nome}</h3>
                      {tipo === "entrada" && (
                        <span className="t-caption t-muted fi-grupo-cab__total">
                          {brl(ativas.reduce((a, c) => a + c.orcamento_mensal_cents, 0))} /mês
                        </span>
                      )}
                      <button
                        type="button"
                        className="fi-grupo-cab__mais"
                        aria-label={`Adicionar categoria em ${g.nome}`}
                        title={`Nova categoria em ${g.nome}`}
                        onClick={() => setNovaNoGrupo({ tipo, grupoId: g.id })}
                      >
                        <Plus size={18} weight="bold" aria-hidden />
                      </button>
                    </div>
                    {linhas(tipo, doGrupo, g.id, false)}
                  </div>
                )}
              </ItemOrdenavel>
            );
          })}
        </ListaOrdenavel>
        {semGrupo.length > 0 && (
          <div className="fi-stack" style={{ gap: 8 }} data-testid="grupo-sem">
            <div className="fi-grupo-cab">
              <FolderSimple size={18} aria-hidden />
              <h3 className="t-h3 t-muted">Sem grupo</h3>
            </div>
            {linhas(tipo, semGrupo, "sem", false)}
          </div>
        )}
      </section>
    );
  };

  return (
    <>
      <div className="fi-row fi-row--between fi-row--wrap">
        <p className="t-body t-muted" style={{ flex: 1, minWidth: 240 }}>
          Defina as categorias e o grupo de cada uma (o orçamento de gastos é o teto do mês, na
          Visão do mês; a meta de ganho é por categoria de entrada). Arraste pela alça (⋮⋮) para
          ordenar: a ordem das categorias é a ordem em que elas aparecem em Lançar (deixe as mais
          usadas em cima).
        </p>
        <div className="fi-row fi-row--wrap">
          <Button variant="secondary" size="sm" onClick={() => setGerindo(true)}>
            <FolderSimple size={16} weight="bold" />
            Grupos
          </Button>
          <Button size="sm" onClick={() => setEditando("nova")}>
            <Plus size={16} weight="bold" />
            Nova categoria
          </Button>
        </div>
      </div>
      <div className="fi-row fi-row--between fi-row--wrap">
        <Segmented
          value={vista}
          onChange={escolherVista}
          options={[
            { value: "grupos", label: "Por grupo" },
            { value: "lista", label: "Lista única" },
          ]}
        />
      </div>
      <OrdenavelRaiz onSoltar={soltou}>
        {secao("Saídas", "saida", saidas)}
        {secao("Entradas", "entrada", entradas)}
      </OrdenavelRaiz>
      <Sheet
        open={!!editando}
        onClose={() => setEditando(null)}
        title={editando === "nova" ? "Nova categoria" : "Editar categoria"}
      >
        {editando && (
          <FormCategoria
            key={editando === "nova" ? "nova" : editando.id}
            categoria={editando === "nova" ? null : editando}
            onClose={() => setEditando(null)}
            onSalvo={() => recarregar()}
          />
        )}
      </Sheet>
      <Sheet open={!!novaNoGrupo} onClose={() => setNovaNoGrupo(null)} title="Nova categoria">
        {novaNoGrupo && (
          <FormCategoria
            key={`${novaNoGrupo.tipo}|${novaNoGrupo.grupoId}`}
            categoria={null}
            tipoInicial={novaNoGrupo.tipo}
            tipoFixo
            grupoInicial={novaNoGrupo.grupoId ?? ""}
            onClose={() => setNovaNoGrupo(null)}
            onSalvo={() => recarregar()}
          />
        )}
      </Sheet>
      <Sheet open={novoGrupo} onClose={() => setNovoGrupo(false)} title="Novo grupo">
        {novoGrupo && <NovoGrupo onClose={() => setNovoGrupo(false)} onCriado={recarregar} />}
      </Sheet>
      {/* no <body>: a página tem animação com transform, que prenderia o "fixo" ao fim da página em vez de à tela */}
      {createPortal(
        <div className="fi-fab" data-aberto={menuAberto || undefined}>
          {menuAberto && (
            <div className="fi-fab__menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuAberto(false);
                  setEditando("nova");
                }}
              >
                <Tag size={18} aria-hidden />
                Nova categoria
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuAberto(false);
                  setNovoGrupo(true);
                }}
              >
                <FolderSimple size={18} aria-hidden />
                Novo grupo
              </button>
            </div>
          )}
          <button
            type="button"
            className="fi-fab__botao"
            aria-label="Criar categoria ou grupo"
            aria-haspopup="menu"
            aria-expanded={menuAberto}
            onClick={() => setMenuAberto((v) => !v)}
          >
            <Plus size={26} weight="bold" aria-hidden />
          </button>
        </div>,
        document.body,
      )}
      <Sheet open={gerindo} onClose={() => setGerindo(false)} title="Grupos de categorias">
        {gerindo && <GerirGrupos onMudou={recarregar} />}
      </Sheet>
    </>
  );
}

/* ───────── Gerir grupos: criar, renomear, ordenar, excluir ───────── */
function GerirGrupos({ onMudou }: { onMudou: () => void }) {
  const { grupos, categorias } = useFinancas();
  const visiveis = useMemo(() => grupos.filter((g) => !g.sistema).sort(porOrdem), [grupos]);
  const [novo, setNovo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const toast = useToast();

  const traduzir = (e: Error) =>
    /duplicate|unique/i.test(e.message) ? "Já existe um grupo com esse nome." : e.message;
  async function criar() {
    if (!novo.trim()) return setErro("Dê um nome ao grupo.");
    setErro(null);
    try {
      await criarGrupo(novo, Math.max(0, ...grupos.map((g) => g.ordem)) + 10);
      setNovo("");
      toast("Grupo criado");
      onMudou();
    } catch (e) {
      setErro(traduzir(e as Error));
    }
  }
  const { aplicarOrdem } = useFinancas();
  function soltou(_contexto: string, idAtivo: string, idSobre: string) {
    const de = visiveis.findIndex((g) => g.id === idAtivo),
      para = visiveis.findIndex((g) => g.id === idSobre);
    if (de < 0 || para < 0) return;
    const plano = planejarReordem(visiveis, arrayMove(visiveis, de, para));
    if (plano.length === 0) return;
    aplicarOrdem("grupo", plano);
    Promise.all(plano.map((x) => atualizarGrupo(x.id, { ordem: x.ordem }))).catch((e: Error) => {
      setErro(traduzir(e));
      onMudou();
    });
  }
  return (
    <>
      <p className="t-body-sm t-muted">
        Os grupos organizam as categorias nesta tela e nos relatórios. A ordem daqui é a ordem em
        que aparecem.
      </p>
      {visiveis.length === 0 && <p className="t-body t-muted">Nenhum grupo ainda.</p>}
      <OrdenavelRaiz onSoltar={soltou}>
        <ListaOrdenavel ids={visiveis.map((g) => g.id)}>
          <ul className="fi-list">
            {visiveis.map((g) => (
              <ItemOrdenavel
                key={g.id}
                id={g.id}
                contexto="grupos-janela"
                nome={`o grupo ${g.nome}`}
                className="fi-grupo-linha"
              >
                {({ alca }) => (
                  <LinhaGrupo
                    g={g}
                    alca={alca}
                    qtd={categorias.filter((c) => c.group_id === g.id).length}
                    onMudou={onMudou}
                    onErro={(e) => setErro(traduzir(e))}
                  />
                )}
              </ItemOrdenavel>
            ))}
          </ul>
        </ListaOrdenavel>
      </OrdenavelRaiz>
      <div className="fi-field">
        <span className="fi-label">Novo grupo</span>
        <div className="fi-row">
          <Input
            aria-label="Nome do novo grupo"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder="Ex.: Lazer"
            onKeyDown={(e) => {
              if (e.key === "Enter") void criar();
            }}
          />
          <Button onClick={() => void criar()}>
            <Plus size={16} weight="bold" />
            Criar
          </Button>
        </div>
      </div>
      {erro && (
        <p className="fi-error-text" role="alert">
          {erro}
        </p>
      )}
    </>
  );
}

function LinhaGrupo({
  g,
  alca,
  qtd,
  onMudou,
  onErro,
}: {
  g: GrupoCategoria;
  alca: ReactNode;
  qtd: number;
  onMudou: () => void;
  onErro: (e: Error) => void;
}) {
  const [nome, setNome] = useState(g.nome);
  const [confirma, setConfirma] = useState(false);
  async function salvarNome() {
    const n = nome.trim();
    if (!n) {
      setNome(g.nome);
      return;
    }
    if (n === g.nome) return;
    try {
      await atualizarGrupo(g.id, { nome: n });
      onMudou();
    } catch (e) {
      setNome(g.nome);
      onErro(e as Error);
    }
  }
  async function apagar() {
    try {
      await excluirGrupo(g.id);
      onMudou();
    } catch (e) {
      onErro(e as Error);
    }
  }
  return (
    <>
      {alca}
      <Input
        aria-label={`Nome do grupo ${g.nome}`}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onBlur={() => void salvarNome()}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <span className="t-caption t-muted fi-grupo-linha__qtd">
        {qtd} {qtd === 1 ? "categoria" : "categorias"}
      </span>
      {confirma ? (
        <Button variant="danger" size="sm" onClick={() => void apagar()}>
          {qtd > 0 ? `Excluir (${qtd} ficam sem grupo)` : "Confirmar"}
        </Button>
      ) : (
        <button
          type="button"
          className="fi-ordenar__apagar"
          aria-label={`Excluir o grupo ${g.nome}`}
          onClick={() => setConfirma(true)}
        >
          <Trash size={18} />
        </button>
      )}
    </>
  );
}

function NovoGrupo({ onClose, onCriado }: { onClose: () => void; onCriado: () => void }) {
  const { grupos } = useFinancas();
  const toast = useToast();
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  async function criar() {
    if (!nome.trim()) return setErro("Dê um nome ao grupo.");
    try {
      await criarGrupo(nome, Math.max(0, ...grupos.map((g) => g.ordem)) + 10);
      toast("Grupo criado");
      onCriado();
      onClose();
    } catch (e) {
      const m = (e as Error).message;
      setErro(/duplicate|unique/i.test(m) ? "Já existe um grupo com esse nome." : m);
    }
  }
  return (
    <>
      <div className="fi-field">
        <span className="fi-label">Nome do grupo</span>
        <Input
          aria-label="Nome do novo grupo"
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Lazer"
          onKeyDown={(e) => {
            if (e.key === "Enter") void criar();
          }}
        />
      </div>
      {erro && (
        <p className="fi-error-text" role="alert">
          {erro}
        </p>
      )}
      <Button size="lg" block onClick={() => void criar()}>
        Criar grupo
      </Button>
    </>
  );
}
