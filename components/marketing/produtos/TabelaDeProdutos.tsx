"use client";

import { registrarDesfazer } from "@/lib/motor/desfazer";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState, type ReactNode } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { AcaoEmMassa, BarraDeSelecao } from "@/components/motor/BarraDeSelecao";
import { CelulaDeCaixa } from "@/components/motor/CelulaDeCaixa";
import { CelulaDeTexto } from "@/components/motor/CelulaDeTexto";
import { SeletorDeOpcao } from "@/components/motor/SeletorDeOpcao";

import { AbasDeVisualizacao } from "@/components/motor/AbasDeVisualizacao";
import { BarraDeConsulta, type CampoDaBarra } from "@/components/motor/BarraDeConsulta";
import { ConfigurarVisualizacao } from "@/components/motor/ConfigurarVisualizacao";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { TabelaDoMotor, type ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { alternarId, faixaEntre, podarSelecao } from "@/lib/motor/selecao";
import { lerNumero } from "@/lib/marketing/calculadora";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import { useConsultaEmRascunho } from "@/hooks/motor/useConsultaEmRascunho";
import { useVisoesSalvas } from "@/hooks/motor/useVisoesSalvas";
import { useVisualizacao } from "@/hooks/motor/useVisualizacao";
import {
  aplicarConsulta,
  consultaAtiva,
  type CampoConsultavel,
} from "@/lib/motor/consulta";
import { proximaOrdenacao } from "@/lib/motor/ordenar-por-coluna";
import { moverColuna, resolverColunas, type PreferenciasDaTabela, alternarVisibilidade } from "@/lib/motor/layout";
import type { ResumoDeSubpagina } from "@/lib/marketing/paginas";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { Check, Package, TextAa, Trash } from "@/lib/ui/icons";

const ID_DA_PADRAO = "padrao";
const MODULO = "produtos-e-ofertas";
const BASE_DA_API = "/api/v1/marketing/ofertas/campos";
const TIPOS_DE_PRECO = ["unico", "mensal", "setup-mensal", "sob-consulta", "gratuito"] as const;
type Mudancas = Partial<{
  title: string;
  etapa: (typeof ETAPAS)[number];
  nivel: "simples" | "completa";
  carroChefe: boolean;
  tipoDePreco: (typeof TIPOS_DE_PRECO)[number];
  preco: number | null;
  janelaAtivoMeses: number | null;
}>;
interface DadosDoCache {
  subpaginas: Produto[];
  pode_editar: boolean;
}
const SO_TABELA = ["tabela"] as const;
const ETAPAS = ["isca", "entrada", "principal", "expansao", "recorrencia"] as const;
const COR_DA_ETAPA: Record<(typeof ETAPAS)[number], CorDaOpcao> = {
  isca: "gray",
  entrada: "blue",
  principal: "green",
  expansao: "orange",
  recorrencia: "purple",
};

type Produto = ResumoDeSubpagina;

/**
 * Os produtos e serviços numa TABELA, com o mesmo motor das Tarefas: busca, filtros, ordem,
 * agrupamento, colunas que se escondem e se reordenam, e visualizações salvas (abas) da empresa.
 * É a visão para quem tem muitos itens; o cartão continua sendo a vitrine.
 */
export function TabelaDeProdutos({
  produtos,
  base,
  podeEditar,
  vista,
  renderizarCartoes,
}: {
  produtos: readonly Produto[];
  base: string;
  podeEditar: boolean;
  vista: "cartoes" | "tabela";
  /** Desenha a vitrine de cartões com as linhas já filtradas e ordenadas (e os grupos, se houver). */
  renderizarCartoes: (
    linhas: Produto[],
    consultaAtiva: boolean,
    grupos?: Array<{ chave: string; titulo: ReactNode; linhas: Produto[] }>,
  ) => ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const [configurando, setConfigurando] = useState(false);
  const queryClient = useQueryClient();
  const [selecionadas, setSelecionadas] = useState<Set<string>>(() => new Set());
  const ultimoMarcado = useRef<string | null>(null);
  const chaveDoCache = ["marketing-subpaginas", MODULO] as const;

  /** Muda a tabela na hora (cache) e confirma no servidor; se o servidor recusar, desfaz. */
  async function gravar(
    keys: string[],
    corpo: () => Promise<unknown>,
    local: (p: Produto) => Produto,
  ) {
    const antes = queryClient.getQueryData<DadosDoCache>(chaveDoCache);
    queryClient.setQueryData<DadosDoCache>(chaveDoCache, (d) =>
      d ? { ...d, subpaginas: d.subpaginas.map((s) => (keys.includes(s.key) ? local(s) : s)) } : d,
    );
    try {
      await corpo();
      return true;
    } catch (e) {
      queryClient.setQueryData(chaveDoCache, antes);
      showApiError(e);
      return false;
    } finally {
      void queryClient.invalidateQueries({ queryKey: chaveDoCache });
    }
  }
  /** O que `m` mudou, com os valores que `p` tinha antes — a volta do Ctrl+Z. */
  const inversoDe = (p: Produto, m: Mudancas): Mudancas => {
    const o = p.oferta;
    const volta: Record<string, unknown> = {};
    if (m.title !== undefined) volta.title = p.title;
    if (o) {
      if (m.etapa !== undefined) volta.etapa = o.etapa;
      if (m.nivel !== undefined) volta.nivel = o.nivel;
      if (m.carroChefe !== undefined) volta.carroChefe = o.carroChefe;
      if (m.tipoDePreco !== undefined) volta.tipoDePreco = o.tipoDePreco;
      if (m.janelaAtivoMeses !== undefined) volta.janelaAtivoMeses = o.janelaAtivoMeses;
      if (m.preco !== undefined) volta.preco = o.preco === "—" ? null : o.valor;
    }
    return volta as Mudancas;
  };
  const editarSemDesfazer = (keys: string[], m: Mudancas) =>
    gravar(
      keys,
      () => apiClient.patch(BASE_DA_API, { keys, mudancas: m }),
      (p) => ({
        ...p,
        title: m.title ?? p.title,
        oferta: p.oferta
          ? {
              ...p.oferta,
              etapa: m.etapa ?? p.oferta.etapa,
              nivel: m.nivel ?? p.oferta.nivel,
              carroChefe: m.carroChefe ?? p.oferta.carroChefe,
              tipoDePreco: m.tipoDePreco ?? p.oferta.tipoDePreco,
              janelaAtivoMeses:
                m.janelaAtivoMeses !== undefined ? m.janelaAtivoMeses : p.oferta.janelaAtivoMeses,
              valor: m.preco !== undefined ? (m.preco ?? 0) : p.oferta.valor,
              preco:
                m.preco !== undefined
                  ? m.preco === null
                    ? "—"
                    : moedaDoNumero(m.preco)
                  : p.oferta.preco,
            }
          : p.oferta,
      }),
    );
  const editar = async (keys: string[], m: Mudancas) => {
    const antes = (queryClient.getQueryData<DadosDoCache>(chaveDoCache)?.subpaginas ?? []).filter((s) =>
      keys.includes(s.key),
    );
    const ok = await editarSemDesfazer(keys, m);
    if (ok && antes.length > 0) {
      registrarDesfazer({
        rotulo: antes.length === 1 ? antes[0]!.title : `${antes.length} ${t("produtos")}`,
        desfazer: async () => {
          for (const p of antes) await editarSemDesfazer([p.key], inversoDe(p, m));
        },
      });
    }
  };
  const publicar = (keys: string[], publicada: boolean) =>
    gravar(
      keys,
      () =>
        apiClient.post("/api/v1/marketing/pages/publicacao", {
          keys,
          acao: publicada ? "publicar" : "despublicar",
        }),
      (p) => ({ ...p, publicada }),
    );
  const apagar = async (keys: string[]) => {
    if (!window.confirm(t("Apagar os produtos selecionados? Isso não pode ser desfeito."))) return;
    await gravar(
      keys,
      () => apiClient.delete(BASE_DA_API, { keys }),
      (p) => p,
    );
    setSelecionadas(new Set());
    void queryClient.invalidateQueries({ queryKey: chaveDoCache });
  };

  const padrao = useVisualizacao("produtos");
  const { visoes, salvarConfig, criarVisao, editarVisao, apagarVisao, arquivarVisao } = useVisoesSalvas(
    "produtos",
    podeEditar,
  );
  const visaoAtiva = visoes.find((v) => v.id === parametros.get("v"));
  const ativaId = visaoAtiva?.id ?? ID_DA_PADRAO;
  const preferenciasSalvas: PreferenciasDaTabela = visaoAtiva
    ? visaoAtiva.config
    : padrao.preferencias;
  const atualizar = (mudar: (atual: PreferenciasDaTabela) => PreferenciasDaTabela) => {
    if (visaoAtiva) salvarConfig(visaoAtiva.id, mudar(visaoAtiva.config));
    else padrao.atualizar(mudar);
  };
  // Filtro, ordem e agrupamento: rascunho sobre o salvo; "Reset" volta, "Salvar" vira o padrão.
  const { preferencias, mudarConsulta, salvamento } = useConsultaEmRascunho({
    ativaId,
    salvas: preferenciasSalvas,
    atualizar,
    podeSalvar: podeEditar && (visaoAtiva?.editavel ?? true),
  });
  const escolherAba = (id: string) =>
    router.replace(id === ID_DA_PADRAO ? caminho : `${caminho}?v=${id}`, { scroll: false });

  const rotuloDaEtapa = (e: string) =>
    e === "isca"
      ? t("Isca")
      : e === "entrada"
        ? t("Entrada")
        : e === "principal"
          ? t("Principal")
          : e === "expansao"
            ? t("Expansão")
            : t("Recorrência");
  const rotuloDoPreco = (v: string) =>
    v === "unico"
      ? t("Único")
      : v === "mensal"
        ? t("Mensal")
        : v === "setup-mensal"
          ? t("Setup + mensal")
          : v === "sob-consulta"
            ? t("Sob consulta")
            : t("Gratuito");

  const opcoesDeEtapa = ETAPAS.map((e) => ({
    id: e,
    rotulo: rotuloDaEtapa(e),
    cor: COR_DA_ETAPA[e],
  }));
  const opcoesDeNivel = [
    { id: "simples", rotulo: t("Simples"), cor: "gray" as CorDaOpcao },
    { id: "completa", rotulo: t("Completa"), cor: "blue" as CorDaOpcao },
  ];
  const opcoesDePreco = ["unico", "mensal", "setup-mensal", "sob-consulta", "gratuito"].map(
    (v) => ({
      id: v,
      rotulo: rotuloDoPreco(v),
      cor: "gray" as CorDaOpcao,
    }),
  );
  const opcoesDeStatus = [
    { id: "publicada", rotulo: t("Publicada"), cor: "green" as CorDaOpcao },
    { id: "rascunho", rotulo: t("Rascunho"), cor: "gray" as CorDaOpcao },
  ];

  const colunas: ColunaDoMotor<Produto>[] = [
    {
      id: "nome",
      titulo: t("Nome"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 320,
      semOcultar: true,
      celula: (p) => (
        <div className="flex min-w-0 items-center gap-1">
          <div className="min-w-0 flex-1">
            <CelulaDeTexto
              valor={p.title}
              rotulo={t("Nome do produto")}
              podeEditar={podeEditar}
              aoSalvar={(title) => void editar([p.key], { title })}
            />
          </div>
          <Link
            href={`${base}/${p.key}`}
            className="inline-flex h-7 shrink-0 items-center rounded-md border bg-card px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase hover:bg-secondary hover:text-foreground"
          >
            {t("Abrir")}
          </Link>
        </div>
      ),
    },
    {
      id: "etapa",
      titulo: t("Etapa da escada"),
      icone: <Package size={14} aria-hidden />,
      largura: 160,
      celula: (p) =>
        p.oferta ? (
          <SeletorDeOpcao
            opcoes={opcoesDeEtapa}
            valorId={p.oferta.etapa}
            podeEditar={podeEditar}
            rotulo={t("Etapa da escada")}
            aoEscolher={(id) => void editar([p.key], { etapa: id as (typeof ETAPAS)[number] })}
          >
            <Etiqueta cor={COR_DA_ETAPA[p.oferta.etapa]}>{rotuloDaEtapa(p.oferta.etapa)}</Etiqueta>
          </SeletorDeOpcao>
        ) : null,
    },
    {
      id: "preco",
      titulo: t("Preço"),
      icone: <Package size={14} aria-hidden />,
      largura: 190,
      celula: (p) =>
        p.oferta ? (
          <CelulaDeTexto
            valor={p.oferta.valor > 0 ? moedaDoNumero(p.oferta.valor) : ""}
            exibir={p.oferta.preco}
            rotulo={t("Preço")}
            vazioRotulo="—"
            permitirVazio
            inputMode="decimal"
            podeEditar={podeEditar}
            aoSalvar={(texto) => {
              const n = texto.trim() === "" ? null : lerNumero(texto);
              if (texto.trim() !== "" && n === null) return;
              void editar([p.key], { preco: n });
            }}
          />
        ) : null,
    },
    {
      id: "janela-ativo",
      titulo: t("Cliente ativo (meses)"),
      icone: <Package size={14} aria-hidden />,
      largura: 170,
      padrao: false,
      celula: (p) =>
        p.oferta ? (
          <CelulaDeTexto
            valor={p.oferta.janelaAtivoMeses ? String(p.oferta.janelaAtivoMeses) : ""}
            exibir={p.oferta.janelaAtivoMeses ? `${p.oferta.janelaAtivoMeses}` : ""}
            rotulo={t("Meses em que o pagamento deste produto mantém o cliente ativo")}
            vazioRotulo={t("Padrão da empresa")}
            permitirVazio
            inputMode="numeric"
            podeEditar={podeEditar}
            aoSalvar={(texto) => {
              const n = texto.trim() === "" ? null : Math.round(Number(texto));
              if (n !== null && (!Number.isFinite(n) || n < 1 || n > 60)) return;
              void editar([p.key], { janelaAtivoMeses: n });
            }}
          />
        ) : null,
    },
    {
      id: "tipo-de-preco",
      titulo: t("Tipo de preço"),
      icone: <Package size={14} aria-hidden />,
      largura: 160,
      celula: (p) =>
        p.oferta ? (
          <SeletorDeOpcao
            opcoes={opcoesDePreco}
            valorId={p.oferta.tipoDePreco}
            podeEditar={podeEditar}
            rotulo={t("Tipo de preço")}
            aoEscolher={(id) =>
              void editar([p.key], { tipoDePreco: id as (typeof TIPOS_DE_PRECO)[number] })
            }
          >
            <Etiqueta cor="gray">{rotuloDoPreco(p.oferta.tipoDePreco)}</Etiqueta>
          </SeletorDeOpcao>
        ) : null,
    },
    {
      id: "carro-chefe",
      titulo: t("Carro-chefe"),
      icone: <Check size={14} aria-hidden />,
      largura: 130,
      celula: (p) =>
        p.oferta ? (
          <CelulaDeCaixa
            marcada={p.oferta.carroChefe}
            podeEditar={podeEditar}
            rotulo={t("Carro-chefe")}
            aoMudar={(carroChefe) => void editar([p.key], { carroChefe })}
          />
        ) : null,
    },
    {
      id: "nivel",
      titulo: t("Nível"),
      icone: <Package size={14} aria-hidden />,
      largura: 130,
      padrao: false,
      celula: (p) =>
        p.oferta ? (
          <SeletorDeOpcao
            opcoes={opcoesDeNivel}
            valorId={p.oferta.nivel}
            podeEditar={podeEditar}
            rotulo={t("Nível")}
            aoEscolher={(id) => void editar([p.key], { nivel: id as "simples" | "completa" })}
          >
            <Etiqueta cor={p.oferta.nivel === "completa" ? "blue" : "gray"}>
              {p.oferta.nivel === "completa" ? t("Completa") : t("Simples")}
            </Etiqueta>
          </SeletorDeOpcao>
        ) : null,
    },
    {
      id: "resumo",
      titulo: t("Resumo"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 320,
      padrao: false,
      celula: (p) => (
        <span className="block truncate px-2 text-sm text-muted-foreground">
          {p.oferta?.resumo ?? ""}
        </span>
      ),
    },
    {
      id: "status",
      titulo: t("Status"),
      icone: <Package size={14} aria-hidden />,
      largura: 140,
      celula: (p) => (
        <SeletorDeOpcao
          opcoes={opcoesDeStatus}
          valorId={p.publicada ? "publicada" : "rascunho"}
          podeEditar={podeEditar}
          rotulo={t("Status")}
          aoEscolher={(id) => void publicar([p.key], id === "publicada")}
        >
          <Etiqueta ponto cor={p.publicada ? "green" : "gray"}>
            {p.publicada ? t("Publicada") : t("Rascunho")}
          </Etiqueta>
        </SeletorDeOpcao>
      ),
    },
  ];

  const campos: Array<
    CampoConsultavel<Produto> & {
      titulo: string;
      opcoes?: { id: string; rotulo: string; cor?: CorDaOpcao }[];
    }
  > = [
    { id: "nome", titulo: t("Nome"), tipo: "texto", valorDe: (p) => p.title },
    {
      id: "etapa",
      titulo: t("Etapa da escada"),
      tipo: "opcao",
      valorDe: (p) => p.oferta?.etapa,
      opcoes: opcoesDeEtapa,
      ordemDoValor: (v) => ETAPAS.indexOf(v as (typeof ETAPAS)[number]),
      rotuloDoValor: rotuloDaEtapa,
    },
    { id: "preco", titulo: t("Preço"), tipo: "numero", valorDe: (p) => p.oferta?.valor },
    {
      id: "tipo-de-preco",
      titulo: t("Tipo de preço"),
      tipo: "opcao",
      valorDe: (p) => p.oferta?.tipoDePreco,
      opcoes: opcoesDePreco,
      rotuloDoValor: rotuloDoPreco,
    },
    {
      id: "carro-chefe",
      titulo: t("Carro-chefe"),
      tipo: "caixa",
      valorDe: (p) => p.oferta?.carroChefe ?? false,
      rotuloDoValor: (v) => (v === "1" ? t("Sim") : t("Não")),
    },
    {
      id: "nivel",
      titulo: t("Nível"),
      tipo: "opcao",
      valorDe: (p) => p.oferta?.nivel,
      opcoes: opcoesDeNivel,
    },
    {
      id: "status",
      titulo: t("Status"),
      tipo: "opcao",
      valorDe: (p) => (p.publicada ? "publicada" : "rascunho"),
      opcoes: opcoesDeStatus,
    },
  ];
  const camposDaBarra: CampoDaBarra[] = campos.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    tipo: c.tipo,
    opcoes: c.opcoes,
  }));

  const resolvidas = resolverColunas(colunas, preferencias);
  const mostradas = resolvidas.filter((c) => c.visivel);

  const resultado = useMemo(
    () =>
      aplicarConsulta(produtos, campos, preferencias, {
        hoje: new Date().toISOString().slice(0, 10),
      }),
    // `campos` é recriado a cada render; as entradas reais são estas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [produtos, preferencias],
  );
  const idsDaTabela = [...new Set(resultado.linhas.map((p) => p.key))];
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

  const grupos = resultado.grupos?.map((g) => {
    const campo = campos.find((c) => c.id === preferencias.agrupar);
    const rotulo =
      g.chave === ""
        ? t("Sem valor")
        : (campo?.opcoes?.find((o) => o.id === g.chave)?.rotulo ??
          campo?.rotuloDoValor?.(g.chave) ??
          g.rotulo);
    return { chave: g.chave || "__vazio", titulo: <strong>{rotulo}</strong>, linhas: g.linhas };
  });


  const abas = [
    {
      id: ID_DA_PADRAO,
      nome: padrao.preferencias.nome ?? t("Tabela"),
      tipo: "tabela" as const,
    },
    ...visoes.map((v) => ({ id: v.id, nome: v.name, tipo: v.type })),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <AbasDeVisualizacao
        abas={abas}
        ativaId={ativaId}
        podeEditar={podeEditar}
        tipos={SO_TABELA}
        aoEscolher={escolherAba}
        aoCriar={(nome) =>
          void criarVisao({ name: nome, type: "tabela", config: preferencias }).then(
            (v) => v && escolherAba(v.id),
          )
        }
        aoConfigurar={() => setConfigurando(true)}
      />
      <BarraDeConsulta
          salvamento={salvamento}
        campos={camposDaBarra}
        consulta={{
          filtros: preferencias.filtros,
          ordenacao: preferencias.ordenacao,
          agrupar: preferencias.agrupar,
          agruparPor: preferencias.agruparPor,
        }}
        aoMudar={mudarConsulta}
      />
      {vista === "tabela" ? (
        <TabelaDoMotor
          aoOrdenarPor={(coluna) =>
            mudarConsulta({
              filtros: preferencias.filtros,
              ordenacao: proximaOrdenacao(preferencias.ordenacao, coluna),
              agrupar: preferencias.agrupar,
              agruparPor: preferencias.agruparPor,
            })
          }
          ordenacao={preferencias.ordenacao}
          colunasOrdenaveis={new Set(camposDaBarra.map((c) => c.id))}
          linhas={resultado.linhas}
          idDe={(p) => p.key}
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
          aoReordenar={() => undefined}
          podeReordenar={false}
          selecionadas={vivas}
          aoSelecionar={podeEditar ? selecionar : undefined}
          aoSelecionarTodas={
            podeEditar
              ? (marcar) => {
                  setSelecionadas(marcar ? new Set(idsDaTabela) : new Set());
                  ultimoMarcado.current = null;
                }
              : undefined
          }
          rotuloDaTabela={t("Produtos e serviços")}
          vazio={
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("Nenhum produto combina com a busca e os filtros.")}
            </p>
          }
        />
      ) : produtos.length === 0 || resultado.linhas.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
          {t("Nenhum produto combina com a busca e os filtros.")}
        </p>
      ) : grupos ? (
        <div className="flex flex-col gap-6">
          {grupos.map((g) => (
            <section key={g.chave} className="flex flex-col gap-2">
              <h3 className="text-sm">{g.titulo}</h3>
              {renderizarCartoes(g.linhas, true)}
            </section>
          ))}
        </div>
      ) : (
        renderizarCartoes(resultado.linhas, consultaAtiva(preferencias))
      )}
      {podeEditar ? (
        <BarraDeSelecao
          quantidade={idsSelecionados.length}
          aoLimpar={() => setSelecionadas(new Set())}
        >
          <AcaoEmMassa rotulo={t("Etapa")} icone={<Package size={14} aria-hidden />}>
            {(fechar) => (
              <div>
                {opcoesDeEtapa.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      void editar(idsSelecionados, { etapa: o.id });
                      fechar();
                    }}
                    className="flex w-full rounded-md px-2 py-1.5 hover:bg-secondary"
                  >
                    <Etiqueta cor={o.cor}>{o.rotulo}</Etiqueta>
                  </button>
                ))}
              </div>
            )}
          </AcaoEmMassa>
          <AcaoEmMassa rotulo={t("Tipo de preço")} icone={<Package size={14} aria-hidden />}>
            {(fechar) => (
              <div>
                {opcoesDePreco.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      void editar(idsSelecionados, {
                        tipoDePreco: o.id as (typeof TIPOS_DE_PRECO)[number],
                      });
                      fechar();
                    }}
                    className="flex w-full rounded-md px-2 py-1.5 hover:bg-secondary"
                  >
                    <Etiqueta cor={o.cor}>{o.rotulo}</Etiqueta>
                  </button>
                ))}
              </div>
            )}
          </AcaoEmMassa>
          <AcaoEmMassa rotulo={t("Carro-chefe")} icone={<Check size={14} aria-hidden />}>
            {(fechar) => (
              <div>
                {[
                  { v: true, r: t("Marcar como carro-chefe") },
                  { v: false, r: t("Desmarcar carro-chefe") },
                ].map((o) => (
                  <button
                    key={String(o.v)}
                    type="button"
                    onClick={() => {
                      void editar(idsSelecionados, { carroChefe: o.v });
                      fechar();
                    }}
                    className="flex w-full rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
                  >
                    {o.r}
                  </button>
                ))}
              </div>
            )}
          </AcaoEmMassa>
          <AcaoEmMassa rotulo={t("Preço")} icone={<Package size={14} aria-hidden />}>
            {(fechar) => (
              <PrecoEmMassa
                aplicar={(n) => {
                  void editar(idsSelecionados, { preco: n });
                  fechar();
                }}
              />
            )}
          </AcaoEmMassa>
          <AcaoEmMassa
            rotulo={t("Publicar")}
            aoClicar={() => void publicar(idsSelecionados, true)}
          />
          <AcaoEmMassa
            rotulo={t("Tirar do ar")}
            aoClicar={() => void publicar(idsSelecionados, false)}
          />
          <AcaoEmMassa
            rotulo={t("Apagar")}
            icone={<Trash size={14} aria-hidden />}
            destrutivo
            aoClicar={() => void apagar(idsSelecionados)}
          />
        </BarraDeSelecao>
      ) : null}
      <ConfigurarVisualizacao
        aberto={configurando}
        aoFechar={() => setConfigurando(false)}
        nome={visaoAtiva?.name ?? padrao.preferencias.nome ?? t("Tabela")}
        tipo="tabela"
        tipos={SO_TABELA}
        podeEditar={podeEditar && (visaoAtiva?.editavel ?? true)}
        ehPadrao={!visaoAtiva}
        aoArquivar={
          visaoAtiva && visaoAtiva.editavel === false
            ? () => void arquivarVisao(visaoAtiva.id)
            : undefined
        }
        aoRenomear={(nome) =>
          visaoAtiva
            ? void editarVisao(visaoAtiva.id, { name: nome })
            : padrao.atualizar((p) => ({ ...p, nome }))
        }
        aoTrocarTipo={() => undefined}
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
                escolherAba(ID_DA_PADRAO);
              }
            : undefined
        }
      />
    </div>
  );
}

/** O painel "Preço" da barra de seleção: um valor (ou vazio, que limpa) para todos os selecionados. */
function PrecoEmMassa({ aplicar }: { aplicar: (preco: number | null) => void }) {
  const t = useT();
  const [texto, setTexto] = useState("");
  const n = texto.trim() === "" ? null : lerNumero(texto);
  return (
    <div className="space-y-2 p-1.5">
      <input
        value={texto}
        inputMode="decimal"
        placeholder="R$ 0,00"
        aria-label={t("Preço")}
        onChange={(e) => setTexto(e.target.value)}
        className="h-10 w-full rounded-xl border bg-card px-2 text-sm"
      />
      <button
        type="button"
        disabled={texto.trim() !== "" && n === null}
        onClick={() => aplicar(n)}
        className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {texto.trim() === "" ? t("Limpar preço") : t("Aplicar")}
      </button>
    </div>
  );
}
