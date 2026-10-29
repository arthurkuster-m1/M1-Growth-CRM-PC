"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { AbasDeVisualizacao } from "@/components/motor/AbasDeVisualizacao";
import { BarraDeSelecao } from "@/components/motor/BarraDeSelecao";
import { BarraDeConsulta, type CampoDaBarra } from "@/components/motor/BarraDeConsulta";
import { ConfigurarVisualizacao } from "@/components/motor/ConfigurarVisualizacao";
import { TabelaDoMotor, type ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { useVisoesSalvas } from "@/hooks/motor/useVisoesSalvas";
import { useVisualizacao } from "@/hooks/motor/useVisualizacao";
import {
  aplicarConsulta,
  type CampoConsultavel,
  type ConsultaDaTabela,
} from "@/lib/motor/consulta";
import { proximaOrdenacao } from "@/lib/motor/ordenar-por-coluna";
import {
  moverColuna,
  resolverColunas,
  type PreferenciasDaTabela,
  alternarVisibilidade,
} from "@/lib/motor/layout";
import { alternarId, faixaEntre, podarSelecao } from "@/lib/motor/selecao";
import type { TipoDeVisualizacao } from "@/lib/motor/visualizacoes";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { CaretDown, CaretUp } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const ID_DA_PADRAO = "padrao";
const TIPOS = ["galeria", "tabela"] as const;

export interface CampoDaColecao<T> extends CampoConsultavel<T> {
  titulo: string;
  opcoes?: { id: string; rotulo: string; cor?: CorDaOpcao }[];
}

interface Props<T extends { id: string; position: number }> {
  /** A chave da tela nas visualizações salvas (ex.: "campanha-lps"). */
  tela: string;
  itens: readonly T[];
  carregando: boolean;
  podeEditar: boolean;
  vazio: string;
  rotuloDaTabela: string;
  campos: CampoDaColecao<T>[];
  colunas: ColunaDoMotor<T>[];
  /** O texto em que a busca procura. */
  textoDaBusca: (item: T) => string;
  /** O item como cartão (a edição completa). */
  /**
   * O item como cartão. `propriedades` são as propriedades que a visualização escolheu mostrar
   * (as colunas visíveis), já prontas para ir dentro do cartão.
   */
  cartao: (item: T, propriedades: ReactNode) => ReactNode;
  /** Classe da grade de cartões. */
  gradeDosCartoes?: string;
  /** Muda a posição de um item (a ordem manual). */
  aoMudarPosicao?: (id: string, posicao: number) => void;
  /** Um item acabou de nascer: leva a tela até ele e o destaca. */
  destacarId?: string | null;
  /**
   * As ações da barra que aparece ao selecionar várias linhas da tabela (editar em massa).
   * Recebe os ids selecionados e uma função que limpa a seleção.
   */
  acoesEmMassa?: (ids: string[], limpar: () => void) => ReactNode;
  /**
   * Visualização FIXA: a tela é sempre esta (cartões ou tabela), sem abas para criar, trocar ou
   * apagar. Filtros, ordem, agrupamento e propriedades continuam editáveis e ficam guardados
   * para esta `tela`.
   */
  visaoFixa?: "galeria" | "tabela";
  /** Sem o botão "Abrir" na coluna do título (o item não tem página própria). */
  semAbrir?: boolean;
  /** Controles extras na barra de cima (ex.: o seletor de conjunto). */
  barraExtra?: ReactNode;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Uma COLEÇÃO da campanha (landing pages, criativos, abordagens) com o motor das Tarefas:
 * abas de visualização salvas (Cartões ou Tabela), busca, filtros, ordenação e agrupamento, e
 * a ordem manual (arrastar na tabela, setas nos cartões) quando nada a esconde.
 */
export function ColecaoDaCampanha<T extends { id: string; position: number }>({
  tela,
  itens,
  carregando,
  podeEditar,
  vazio,
  rotuloDaTabela,
  campos,
  colunas,
  textoDaBusca,
  cartao,
  gradeDosCartoes = "grid grid-cols-1 gap-3 lg:grid-cols-2",
  aoMudarPosicao,
  destacarId,
  acoesEmMassa,
  visaoFixa,
  semAbrir = false,
  barraExtra,
}: Props<T>) {
  const t = useT();
  const [busca, setBusca] = useState("");
  const [configurando, setConfigurando] = useState(false);
  // `null` = a primeira aba da ordem (é a que a tela abre).
  const [aba, setAba] = useState<string | null>(null);
  const [forcarCartoes, setForcarCartoes] = useState(false);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(() => new Set());
  const ultimoMarcado = useRef<string | null>(null);

  const padrao = useVisualizacao(tela);
  const {
    visoes,
    carregando: carregandoAsVisoes,
    salvarConfig,
    criarVisao,
    editarVisao,
    apagarVisao,
    arquivarVisao,
  } = useVisoesSalvas(tela, podeEditar);
  // A ORDEM das abas é da empresa (a `position` de cada visualização); a aba de fábrica guarda
  // a própria posição nas preferências. A primeira da ordem é a que a tela abre.
  const posicaoDaPadrao = padrao.preferencias.posicao ?? -1_000_000;
  const ordemDasAbas = [
    { id: ID_DA_PADRAO, posicao: posicaoDaPadrao },
    ...visoes.map((v) => ({ id: v.id, posicao: v.position })),
  ].sort((a, b) => a.posicao - b.posicao);
  const abaValida =
    aba !== null && (aba === ID_DA_PADRAO || visoes.some((v) => v.id === aba)) ? aba : null;
  const ativaId = abaValida ?? ordemDasAbas[0]?.id ?? ID_DA_PADRAO;
  const visaoAtiva = ativaId === ID_DA_PADRAO ? undefined : visoes.find((v) => v.id === ativaId);
  const indiceDaAba = ordemDasAbas.findIndex((a) => a.id === ativaId);
  const moverAba = (direcao: -1 | 1) => {
    const ids = ordemDasAbas.map((a) => a.id);
    const i = ids.indexOf(ativaId);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    ids.forEach((id, k) => {
      const posicao = (k + 1) * 1000;
      if (id === ID_DA_PADRAO) padrao.atualizar((p) => ({ ...p, posicao }));
      else void editarVisao(id, { position: posicao });
    });
  };
  const tipoDaAba: TipoDeVisualizacao = visaoFixa
    ? visaoFixa
    : visaoAtiva
      ? visaoAtiva.type
      : padrao.preferencias.visualizacao === "tabela"
        ? "tabela"
        : "galeria";
  const vista = visaoFixa
    ? visaoFixa === "tabela"
      ? "tabela"
      : "cartoes"
    : forcarCartoes
      ? "cartoes"
      : tipoDaAba === "tabela"
        ? "tabela"
        : "cartoes";
  const preferencias: PreferenciasDaTabela =
    visaoAtiva && !visaoFixa ? visaoAtiva.config : padrao.preferencias;
  const atualizar = (mudar: (atual: PreferenciasDaTabela) => PreferenciasDaTabela) => {
    if (visaoAtiva && !visaoFixa) salvarConfig(visaoAtiva.id, mudar(visaoAtiva.config));
    else padrao.atualizar(mudar);
  };

  const ordenadosPorPosicao = useMemo(
    () => [...itens].sort((a, b) => a.position - b.position),
    [itens],
  );
  const termo = semAcento(busca).trim();
  const buscados = termo
    ? ordenadosPorPosicao.filter((i) => semAcento(textoDaBusca(i)).includes(termo))
    : ordenadosPorPosicao;
  const resultado = aplicarConsulta(buscados, campos, preferencias, {
    hoje: new Date().toISOString().slice(0, 10),
  });
  const grupos = resultado.grupos?.map((g) => {
    const campo = campos.find((c) => c.id === preferencias.agrupar);
    const rotulo =
      g.chave === ""
        ? t("Sem valor")
        : (campo?.opcoes?.find((o) => o.id === g.chave)?.rotulo ?? g.rotulo);
    return { chave: g.chave || "__vazio", titulo: <strong>{rotulo}</strong>, linhas: g.linhas };
  });
  const camposDaBarra: CampoDaBarra[] = campos.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    tipo: c.tipo,
    opcoes: c.opcoes,
  }));
  // A coluna do título ganha "Abrir": o item inteiro num painel no centro da tela.
  const colunasComAbrir: ColunaDoMotor<T>[] = colunas.map((c) =>
    c.semOcultar && !semAbrir
      ? {
          ...c,
          largura: c.largura + 70,
          celula: (linha: T) => (
            <div className="flex min-w-0 items-center gap-1">
              <div className="min-w-0 flex-1">{c.celula(linha)}</div>
              <button
                type="button"
                onClick={() => setAbertoId(linha.id)}
                className="inline-flex h-7 shrink-0 items-center rounded-md border bg-card px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase hover:bg-secondary hover:text-foreground"
              >
                {t("Abrir")}
              </button>
            </div>
          ),
        }
      : c,
  );
  const resolvidas = resolverColunas(colunasComAbrir, preferencias);
  const mostradas = resolvidas.filter((c) => c.visivel);
  /** As propriedades visíveis da visualização, como grade de rótulo e valor dentro do cartão. */
  const propriedadesDoCartao = (item: T): ReactNode => {
    const lista = mostradas.filter((c) => !c.semOcultar && c.id !== "nome");
    if (lista.length === 0) return null;
    return (
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-secondary/40 p-3 sm:grid-cols-3">
        {lista.map((c) => (
          <div key={c.id} className="min-w-0">
            <p className="truncate text-[11px] tracking-wide text-muted-foreground uppercase">
              {c.titulo}
            </p>
            <div className="-mx-1 min-w-0">{c.celula(item)}</div>
          </div>
        ))}
      </div>
    );
  };

  function mudarConsulta(c: ConsultaDaTabela) {
    atualizar((p) => ({
      ...p,
      filtros: c.filtros?.length ? c.filtros : undefined,
      ordenacao: c.ordenacao?.length ? c.ordenacao : undefined,
      agrupar: c.agrupar,
      agruparPor: c.agrupar && c.agruparPor !== "dia" ? c.agruparPor : undefined,
      ordemDosGrupos: c.agrupar && c.ordemDosGrupos === "desc" ? "desc" : undefined,
    }));
  }

  // A ordem manual só vale quando nada reorganiza a lista (filtro, ordem, grupo, busca).
  const ordemManual =
    podeEditar &&
    Boolean(aoMudarPosicao) &&
    termo === "" &&
    !preferencias.filtros?.length &&
    !preferencias.ordenacao?.length &&
    !preferencias.agrupar;

  function moverPara(id: string, destino: number) {
    if (!aoMudarPosicao) return;
    const resto = ordenadosPorPosicao.filter((i) => i.id !== id);
    const d = Math.max(0, Math.min(resto.length, destino));
    const antes = resto[d - 1]?.position;
    const depois = resto[d]?.position;
    const posicao =
      antes === undefined && depois === undefined
        ? 0
        : antes === undefined
          ? (depois as number) - 1000
          : depois === undefined
            ? antes + 1000
            : (antes + depois) / 2;
    aoMudarPosicao(id, posicao);
  }

  // O item aberto sumiu (foi apagado dentro do painel): fecha o painel e volta para a tabela.
  const itemAberto = abertoId ? itens.find((i) => i.id === abertoId) : undefined;
  useEffect(() => {
    if (abertoId && !itemAberto && !carregando) setAbertoId(null);
  }, [abertoId, itemAberto, carregando]);

  // Seleção (edição em massa): só ids que ainda existem.
  const idsDaTabela = resultado.linhas.map((i) => i.id);
  const vivas = podarSelecao(selecionadas, idsDaTabela);
  const idsSelecionados = idsDaTabela.filter((id) => vivas.has(id));
  const selecionar = (id: string, { faixa }: { faixa: boolean }) => {
    setSelecionadas((atual) => {
      const base = podarSelecao(atual, idsDaTabela);
      if (faixa && ultimoMarcado.current) {
        const proximo = new Set(base);
        for (const m of faixaEntre(idsDaTabela, ultimoMarcado.current, id)) proximo.add(m);
        return proximo;
      }
      return alternarId(base, id);
    });
    ultimoMarcado.current = id;
  };

  // Item recém-criado: leva a tela até ele (nos cartões) e o destaca por um instante.
  const [piscando, setPiscando] = useState<string | null>(null);
  useEffect(() => {
    if (!destacarId) return;
    setForcarCartoes(true);
    setPiscando(destacarId);
    const espera = setTimeout(() => {
      document
        .getElementById(`colecao-${destacarId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    const fim = setTimeout(() => setPiscando(null), 3500);
    return () => {
      clearTimeout(espera);
      clearTimeout(fim);
    };
  }, [destacarId]);

  const cartoes = (lista: readonly T[]) => (
    <div className={gradeDosCartoes}>
      {lista.map((item) => {
        const indice = ordenadosPorPosicao.findIndex((i) => i.id === item.id);
        return (
          <div
            key={item.id}
            id={`colecao-${item.id}`}
            className={cn(
              "relative rounded-2xl transition-shadow",
              piscando === item.id && "ring-2 ring-primary ring-offset-2",
            )}
          >
            {ordemManual && ordenadosPorPosicao.length > 1 ? (
              <div className="absolute top-2 right-2 z-10 flex gap-0.5 rounded-lg border bg-card/90 p-0.5 shadow-sm">
                <button
                  type="button"
                  aria-label={t("Mover para antes")}
                  disabled={indice <= 0}
                  onClick={() => moverPara(item.id, indice - 1)}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-30"
                >
                  <CaretUp size={14} weight="bold" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={t("Mover para depois")}
                  disabled={indice >= ordenadosPorPosicao.length - 1}
                  onClick={() => moverPara(item.id, indice + 1)}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-30"
                >
                  <CaretDown size={14} weight="bold" aria-hidden />
                </button>
              </div>
            ) : null}
            {cartao(item, propriedadesDoCartao(item))}
          </div>
        );
      })}
    </div>
  );

  const abasPorId = new Map([
    [
      ID_DA_PADRAO,
      {
        id: ID_DA_PADRAO,
        nome: padrao.preferencias.nome ?? t("Cartões"),
        tipo: (padrao.preferencias.visualizacao === "tabela"
          ? "tabela"
          : "galeria") as TipoDeVisualizacao,
      },
    ],
    ...visoes.map((v) => [v.id, { id: v.id, nome: v.name, tipo: v.type }] as const),
  ]);
  const abas = ordemDasAbas.flatMap((a) => {
    const x = abasPorId.get(a.id);
    return x ? [x] : [];
  });

  return (
    <div className="grid grid-cols-1 gap-3">
      {itens.length > 0 ? (
        <>
          {visaoFixa ? null : (
            <AbasDeVisualizacao
              abas={abas}
              ativaId={ativaId}
              podeEditar={podeEditar}
              tipos={TIPOS}
              aoEscolher={(id) => {
                setAba(id);
                setForcarCartoes(false);
              }}
              aoCriar={(nome, tipo) =>
                void criarVisao({ name: nome, type: tipo, config: preferencias }).then((v) => {
                  if (v) {
                    setAba(v.id);
                    setForcarCartoes(false);
                  }
                })
              }
              aoConfigurar={() => setConfigurando(true)}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {barraExtra}
            <label className="relative min-w-0 flex-1 basis-56">
              <span className="sr-only">{t("Buscar")}</span>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={t("Buscar")}
                className="h-10 w-full rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <BarraDeConsulta
              compacta
              campos={camposDaBarra}
              consulta={{
                filtros: preferencias.filtros,
                ordenacao: preferencias.ordenacao,
                agrupar: preferencias.agrupar,
                agruparPor: preferencias.agruparPor,
                ordemDosGrupos: preferencias.ordemDosGrupos,
              }}
              aoMudar={mudarConsulta}
            />
            {visaoFixa ? (
              <button
                type="button"
                onClick={() => setConfigurando(true)}
                className="inline-flex h-10 items-center rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary"
              >
                {t("Propriedades")}
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {itens.length === 0 && barraExtra ? (
        <div className="flex flex-wrap items-center gap-2">{barraExtra}</div>
      ) : null}

      {carregando || carregandoAsVisoes ? (
        <div className="h-24 animate-pulse rounded-xl bg-secondary" aria-busy="true" />
      ) : itens.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{vazio}</p>
      ) : resultado.linhas.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {t("Nada combina com a busca e os filtros.")}
        </p>
      ) : vista === "tabela" ? (
        <TabelaDoMotor
          linhas={resultado.linhas}
          idDe={(i) => i.id}
          colunas={mostradas}
          grupos={grupos}
          aoMoverColuna={(movido, alvo) =>
            atualizar((p) => ({
              ...p,
              ordem: moverColuna(
                resolvidas.filter((c) => !c.fixa).map((c) => c.id),
                movido,
                alvo,
              ),
            }))
          }
          aoRedimensionarColuna={(id, largura) =>
            atualizar((p) => ({ ...p, larguras: { ...p.larguras, [id]: largura } }))
          }
          aoOrdenarPor={(coluna) =>
            mudarConsulta({
              filtros: preferencias.filtros,
              ordenacao: proximaOrdenacao(preferencias.ordenacao, coluna),
              agrupar: preferencias.agrupar,
              agruparPor: preferencias.agruparPor,
              ordemDosGrupos: preferencias.ordemDosGrupos,
            })
          }
          ordenacao={preferencias.ordenacao}
          colunasOrdenaveis={new Set(campos.map((c) => c.id))}
          aoReordenar={(id, destino) => moverPara(id, destino)}
          podeReordenar={ordemManual}
          rotuloDaTabela={rotuloDaTabela}
          selecionadas={vivas}
          aoSelecionar={podeEditar && acoesEmMassa ? selecionar : undefined}
          aoSelecionarTodas={
            podeEditar && acoesEmMassa
              ? (marcar) => {
                  setSelecionadas(marcar ? new Set(idsDaTabela) : new Set());
                  ultimoMarcado.current = null;
                }
              : undefined
          }
        />
      ) : grupos ? (
        <div className="grid grid-cols-1 gap-5">
          {grupos.map((g) => (
            <section key={g.chave} className="grid gap-2">
              <h3 className="text-sm">{g.titulo}</h3>
              {cartoes(g.linhas)}
            </section>
          ))}
        </div>
      ) : (
        cartoes(resultado.linhas)
      )}

      {podeEditar && acoesEmMassa ? (
        <BarraDeSelecao
          quantidade={idsSelecionados.length}
          aoLimpar={() => setSelecionadas(new Set())}
        >
          {acoesEmMassa(idsSelecionados, () => setSelecionadas(new Set()))}
        </BarraDeSelecao>
      ) : null}

      <Dialog
        open={!semAbrir && itemAberto !== undefined}
        onOpenChange={(a) => !a && setAbertoId(null)}
      >
        <DialogContent className="max-h-[90vh] w-[min(96vw,820px)] max-w-none overflow-y-auto p-3 sm:max-w-none sm:rounded-2xl">
          <DialogTitle className="sr-only">{rotuloDaTabela}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("Edite os campos deste item.")}
          </DialogDescription>
          {itemAberto ? cartao(itemAberto, propriedadesDoCartao(itemAberto)) : null}
        </DialogContent>
      </Dialog>

      <ConfigurarVisualizacao
        aberto={configurando}
        aoFechar={() => setConfigurando(false)}
        nome={visaoAtiva?.name ?? padrao.preferencias.nome ?? t("Cartões")}
        tipo={tipoDaAba}
        tipos={TIPOS}
        podeEditar={podeEditar && (visaoAtiva?.editavel ?? true)}
        ehPadrao={!visaoAtiva || Boolean(visaoFixa)}
        aoArquivar={
          visaoAtiva && visaoAtiva.editavel === false
            ? () => void arquivarVisao(visaoAtiva.id)
            : undefined
        }
        aoMoverAba={moverAba}
        podeMoverAba={{
          esquerda: indiceDaAba > 0,
          direita: indiceDaAba >= 0 && indiceDaAba < ordemDasAbas.length - 1,
        }}
        aoRenomear={(nome) =>
          visaoAtiva
            ? void editarVisao(visaoAtiva.id, { name: nome })
            : padrao.atualizar((p) => ({ ...p, nome }))
        }
        aoTrocarTipo={(tipo) =>
          visaoAtiva
            ? void editarVisao(visaoAtiva.id, { type: tipo })
            : padrao.atualizar((p) => ({ ...p, visualizacao: tipo }))
        }
        propriedades={resolvidas.map((c) => ({
          id: c.id,
          titulo: c.titulo,
          icone: c.icone,
          visivel: c.visivel,
          obrigatoria: c.fixa || c.semOcultar,
        }))}
        aoMover={(movido, alvo) =>
          atualizar((p) => ({
            ...p,
            ordem: moverColuna(
              resolvidas.filter((c) => !c.fixa).map((c) => c.id),
              movido,
              alvo,
            ),
          }))
        }
        aoAlternar={(id) => {
          const atual = resolvidas.find((c) => c.id === id);
          if (!atual || atual.fixa || atual.semOcultar) return;
          atualizar((p) => alternarVisibilidade(p, resolvidas, id));
        }}
        aoMostrarTodas={(mostrar) =>
          atualizar((p) => ({
            ...p,
            visiveis: Object.fromEntries(
              resolvidas.filter((c) => !c.fixa && !c.semOcultar).map((c) => [c.id, mostrar]),
            ),
          }))
        }
        aoApagar={
          visaoAtiva
            ? () => {
                void apagarVisao(visaoAtiva.id);
                setConfigurando(false);
                setAba(null);
              }
            : undefined
        }
      />
    </div>
  );
}
