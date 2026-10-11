"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { AbasDeVisualizacao } from "@/components/motor/AbasDeVisualizacao";
import { BarraDeConsulta, type CampoDaBarra } from "@/components/motor/BarraDeConsulta";
import { ConfigurarVisualizacao } from "@/components/motor/ConfigurarVisualizacao";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { TabelaDoMotor, type ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { useT } from "@/hooks/i18n/useT";
import { useVisoesSalvas } from "@/hooks/motor/useVisoesSalvas";
import { useVisualizacao } from "@/hooks/motor/useVisualizacao";
import {
  aplicarConsulta,
  type CampoConsultavel,
  type ConsultaDaTabela,
} from "@/lib/motor/consulta";
import { moverColuna, resolverColunas, type PreferenciasDaTabela } from "@/lib/motor/layout";
import type { ResumoDeSubpagina } from "@/lib/marketing/paginas";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { Check, Package, TextAa } from "@/lib/ui/icons";

const ID_DA_PADRAO = "padrao";
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
}: {
  produtos: readonly Produto[];
  base: string;
  podeEditar: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const [configurando, setConfigurando] = useState(false);

  const padrao = useVisualizacao("produtos");
  const { visoes, salvarConfig, criarVisao, editarVisao, apagarVisao } = useVisoesSalvas(
    "produtos",
    podeEditar,
  );
  const visaoAtiva = visoes.find((v) => v.id === parametros.get("v"));
  const ativaId = visaoAtiva?.id ?? ID_DA_PADRAO;
  const preferencias: PreferenciasDaTabela = visaoAtiva ? visaoAtiva.config : padrao.preferencias;
  const atualizar = (mudar: (atual: PreferenciasDaTabela) => PreferenciasDaTabela) => {
    if (visaoAtiva) salvarConfig(visaoAtiva.id, mudar(visaoAtiva.config));
    else padrao.atualizar(mudar);
  };
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
        <Link
          href={`${base}/${p.key}`}
          className="block truncate px-2 text-sm font-medium hover:text-primary hover:underline"
        >
          {p.title || t("Sem título")}
        </Link>
      ),
    },
    {
      id: "etapa",
      titulo: t("Etapa da escada"),
      icone: <Package size={14} aria-hidden />,
      largura: 160,
      celula: (p) =>
        p.oferta ? (
          <Etiqueta cor={COR_DA_ETAPA[p.oferta.etapa]}>{rotuloDaEtapa(p.oferta.etapa)}</Etiqueta>
        ) : null,
    },
    {
      id: "preco",
      titulo: t("Preço"),
      icone: <Package size={14} aria-hidden />,
      largura: 190,
      celula: (p) => <span className="block truncate px-2 text-sm">{p.oferta?.preco ?? "—"}</span>,
    },
    {
      id: "tipo-de-preco",
      titulo: t("Tipo de preço"),
      icone: <Package size={14} aria-hidden />,
      largura: 160,
      celula: (p) =>
        p.oferta ? <Etiqueta cor="gray">{rotuloDoPreco(p.oferta.tipoDePreco)}</Etiqueta> : null,
    },
    {
      id: "carro-chefe",
      titulo: t("Carro-chefe"),
      icone: <Check size={14} aria-hidden />,
      largura: 130,
      celula: (p) =>
        p.oferta?.carroChefe ? (
          <span className="inline-flex items-center gap-1 px-2 text-sm text-primary">
            <Check size={14} weight="bold" aria-hidden />
            {t("Sim")}
          </span>
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
          <Etiqueta cor={p.oferta.nivel === "completa" ? "blue" : "gray"}>
            {p.oferta.nivel === "completa" ? t("Completa") : t("Simples")}
          </Etiqueta>
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
        <Etiqueta ponto cor={p.publicada ? "green" : "gray"}>
          {p.publicada ? t("Publicada") : t("Rascunho")}
        </Etiqueta>
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

  function mudarConsulta(c: ConsultaDaTabela) {
    atualizar((p) => ({
      ...p,
      filtros: c.filtros?.length ? c.filtros : undefined,
      ordenacao: c.ordenacao?.length ? c.ordenacao : undefined,
      agrupar: c.agrupar,
      agruparPor: c.agrupar && c.agruparPor !== "dia" ? c.agruparPor : undefined,
    }));
  }

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
        campos={camposDaBarra}
        consulta={{
          filtros: preferencias.filtros,
          ordenacao: preferencias.ordenacao,
          agrupar: preferencias.agrupar,
          agruparPor: preferencias.agruparPor,
        }}
        aoMudar={mudarConsulta}
      />
      <TabelaDoMotor
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
        rotuloDaTabela={t("Produtos e serviços")}
        vazio={
          <p className="p-6 text-center text-sm text-muted-foreground">
            {t("Nenhum produto combina com a busca e os filtros.")}
          </p>
        }
      />
      <ConfigurarVisualizacao
        aberto={configurando}
        aoFechar={() => setConfigurando(false)}
        nome={visaoAtiva?.name ?? padrao.preferencias.nome ?? t("Tabela")}
        tipo="tabela"
        tipos={SO_TABELA}
        podeEditar={podeEditar}
        ehPadrao={!visaoAtiva}
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
          atualizar((p) => ({ ...p, visiveis: { ...p.visiveis, [id]: !atual.visivel } }));
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
