"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { AbasDeVisualizacao } from "@/components/motor/AbasDeVisualizacao";
import { BarraDeConsulta, type CampoDaBarra } from "@/components/motor/BarraDeConsulta";
import { ConfigurarVisualizacao } from "@/components/motor/ConfigurarVisualizacao";
import { TabelaDoMotor, type ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { useT } from "@/hooks/i18n/useT";
import { useVisoesSalvas } from "@/hooks/motor/useVisoesSalvas";
import { useVisualizacao } from "@/hooks/motor/useVisualizacao";
import { aplicarConsulta, type CampoConsultavel, type ConsultaDaTabela } from "@/lib/motor/consulta";
import { moverColuna, resolverColunas, type PreferenciasDaTabela } from "@/lib/motor/layout";
import { proximaOrdenacao } from "@/lib/motor/ordenar-por-coluna";
import { Check, TextAa } from "@/lib/ui/icons";
import { rotuloDoIndicador } from "@/lib/plataformas-de-anuncio/meta/tabela-de-campanhas";
import type { LinhaDeCampanha } from "@/lib/plataformas-de-anuncio/types";

/**
 * As 15 colunas.
 *
 * ─── A regra que atravessa o arquivo inteiro: ausência vira "—" ─────────────
 *
 * Nenhum `?? 0` aqui. Campanha que não veiculou volta da plataforma sem `cpm`,
 * sem `ctr` e sem `cpc`, e campanha sem vídeo volta sem as métricas de vídeo —
 * quatro das sete campanhas da conta sondada estavam no primeiro caso. Escrever
 * "0,00%" onde não houve medição é uma afirmação falsa com aparência de dado, e
 * quem lê não tem como distinguir de um zero real. "—" é a verdade e não custa
 * nada.
 */

/**
 * `effective_status` → português.
 *
 * O vocabulário é da plataforma e vale a pena traduzir por inteiro: os valores
 * compostos (`CAMPAIGN_PAUSED`, `ADSET_PAUSED`) são justamente os que explicam
 * por que uma campanha "ativa" não está entregando, que é a pergunta que traz
 * alguém a esta tela.
 */
const ESTADO_LEGIVEL: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  DELETED: "Excluída",
  ARCHIVED: "Arquivada",
  IN_PROCESS: "Em processamento",
  WITH_ISSUES: "Com problemas",
  CAMPAIGN_PAUSED: "Campanha pausada",
  ADSET_PAUSED: "Conjunto pausado",
  DISAPPROVED: "Reprovada",
  PENDING_REVIEW: "Em análise",
  PREAPPROVED: "Pré-aprovada",
  PENDING_BILLING_INFO: "Aguardando dados de cobrança",
};

/** Verde só para quem está realmente entregando; âmbar para o que pede atenção. */
const TOM_DO_ESTADO: Record<string, string> = {
  ACTIVE: "text-emerald-600 dark:text-emerald-400",
  WITH_ISSUES: "text-amber-600 dark:text-amber-400",
  DISAPPROVED: "text-red-600 dark:text-red-400",
  PENDING_BILLING_INFO: "text-amber-600 dark:text-amber-400",
  PENDING_REVIEW: "text-amber-600 dark:text-amber-400",
};

const TRACO = "—";

function Numero({ valor, casas = 0 }: { valor: number | null; casas?: number }) {
  if (valor === null) return <span className="text-muted-foreground">{TRACO}</span>;
  return (
    <>
      {valor.toLocaleString("pt-BR", {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
      })}
    </>
  );
}

function Percentual({
  valor,
  casas = 2,
  titulo,
}: {
  valor: number | null;
  casas?: number;
  /**
   * Por que a célula está vazia, quando ela está vazia por FALTA e não por zero.
   *
   * Vem da ressalva da leitura (`avisos` da resposta): "—" sozinho não separa
   * "a plataforma não devolveu esta métrica" de "esta campanha não mediu", e é
   * essa diferença que muda a ação de quem opera.
   */
  titulo?: string;
}) {
  if (valor === null)
    return (
      <span className="text-muted-foreground" title={titulo}>
        {TRACO}
      </span>
    );
  return (
    <>
      {valor.toLocaleString("pt-BR", {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
      })}
      %
    </>
  );
}

const TELA = "meta-ads";
const ID_DA_PADRAO = "padrao";
const TIPOS = ["tabela"] as const;

interface Props {
  linhas: LinhaDeCampanha[];
  /**
   * A moeda da CONTA, não a da instalação.
   *
   * Um token pode alcançar conta em USD e conta em BRL ao mesmo tempo. Formatar
   * tudo em real mostraria "R$ 364,63" para um gasto que foi em dólar — número
   * errado com aparência de certo, que é o pior erro possível numa tela de
   * custo. Vem de `/me/adaccounts`, por conta.
   */
  moeda: string;
  /**
   * Ressalvas da leitura, como a rota as devolve (`avisos`): a célula do Connect rate diz no
   * hover por que está vazia, em vez de um "—" mudo.
   */
  avisos?: string[];
}

/**
 * As campanhas do Meta Ads no MESMO motor das outras tabelas do produto — propriedades que se
 * mostram, escondem e reordenam; filtros, ordem e agrupamento; abas salvas — para a tela ser
 * usada como o Gerenciador de Anúncios. Os números continuam vindo da plataforma na hora.
 */
export function TabelaDeCampanhas({ linhas, moeda, avisos }: Props) {
  const t = useT();
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const [busca, setBusca] = useState("");
  const [configurando, setConfigurando] = useState(false);

  const padrao = useVisualizacao(TELA);
  const { visoes, salvarConfig, criarVisao, editarVisao, apagarVisao } = useVisoesSalvas(TELA, true);
  const ordemDasAbas = [
    { id: ID_DA_PADRAO, posicao: padrao.preferencias.posicao ?? -1_000_000 },
    ...visoes.map((v) => ({ id: v.id, posicao: v.position })),
  ].sort((a, b) => a.posicao - b.posicao);
  const pedida = parametros.get("v");
  const visaoAtiva =
    pedida === ID_DA_PADRAO
      ? undefined
      : (visoes.find((v) => v.id === pedida) ??
        (pedida ? undefined : visoes.find((v) => v.id === ordemDasAbas[0]?.id)));
  const ativaId = visaoAtiva?.id ?? ID_DA_PADRAO;
  const preferencias: PreferenciasDaTabela = visaoAtiva ? visaoAtiva.config : padrao.preferencias;
  const atualizar = (mudar: (atual: PreferenciasDaTabela) => PreferenciasDaTabela) => {
    if (visaoAtiva) salvarConfig(visaoAtiva.id, mudar(visaoAtiva.config));
    else padrao.atualizar(mudar);
  };
  const escolherAba = (id: string) => {
    const novos = new URLSearchParams(parametros.toString());
    novos.set("v", id);
    router.replace(`${caminho}?${novos.toString()}`, { scroll: false });
  };
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
  const indiceDaAba = ordemDasAbas.findIndex((a) => a.id === ativaId);

  const ressalvaDoConnectRate = avisos?.length ? avisos.join(" ") : undefined;

  const dinheiro = (valor: number | null, casas = 2) => {
    if (valor === null) return <span className="text-muted-foreground">{TRACO}</span>;
    return (
      <>
        {valor.toLocaleString("pt-BR", {
          style: "currency",
          currency: moeda,
          minimumFractionDigits: casas,
          maximumFractionDigits: casas,
        })}
      </>
    );
  };

  const estado = (valor: string | null) => {
    if (!valor) return <span className="text-muted-foreground">{TRACO}</span>;
    return <span className={TOM_DO_ESTADO[valor] ?? ""}>{t(ESTADO_LEGIVEL[valor] ?? valor)}</span>;
  };

  const direita = "block px-2 text-right text-sm tabular-nums";
  const numerica = (
    id: string,
    titulo: string,
    largura: number,
    celula: (l: LinhaDeCampanha) => React.ReactNode,
    extra?: { padrao?: boolean; dica?: string },
  ): ColunaDoMotor<LinhaDeCampanha> => ({
    id,
    titulo,
    icone: <TextAa size={14} aria-hidden />,
    largura,
    padrao: extra?.padrao,
    celula: (l) => (
      <span className={direita} title={extra?.dica}>
        {celula(l)}
      </span>
    ),
  });

  const colunas: ColunaDoMotor<LinhaDeCampanha>[] = [
    {
      id: "nome",
      titulo: t("Campanha"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 340,
      semOcultar: true,
      celula: (l) => (
        <span className="block truncate px-2 text-sm font-medium" title={l.nome}>
          {l.nome}
        </span>
      ),
    },
    {
      id: "status",
      titulo: t("Status"),
      icone: <Check size={14} aria-hidden />,
      largura: 130,
      celula: (l) => <span className="block px-2 text-sm">{estado(l.status)}</span>,
    },
    {
      id: "veiculacao",
      titulo: t("Veiculação"),
      icone: <Check size={14} aria-hidden />,
      largura: 150,
      celula: (l) => <span className="block px-2 text-sm">{estado(l.veiculacao)}</span>,
    },
    {
      id: "objetivo",
      titulo: t("Objetivo"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 200,
      padrao: false,
      celula: (l) => <span className="block truncate px-2 text-sm">{l.objetivo ?? TRACO}</span>,
    },
    numerica("resultado", t("Resultado"), 150, (l) => {
      const rotulo = rotuloDoIndicador(l.resultado.indicador);
      return (
        <>
          <Numero valor={l.resultado.valor} />
          {rotulo ? (
            <span className="block text-xs font-normal text-muted-foreground">{t(rotulo)}</span>
          ) : null}
        </>
      );
    }),
    numerica("custo-resultado", t("Custo por Resultado"), 170, (l) =>
      dinheiro(l.resultado.custoPorResultado),
    ),
    numerica("gasto", t("Valor Gasto"), 140, (l) => dinheiro(l.gasto)),
    numerica("impressoes", t("Impressões"), 130, (l) => <Numero valor={l.impressoes} />),
    numerica("alcance", t("Alcance"), 120, (l) => <Numero valor={l.alcance} />),
    numerica("cpm", t("CPM"), 110, (l) => dinheiro(l.cpm)),
    numerica("ctr", t("CTR"), 100, (l) => <Percentual valor={l.ctr} />),
    numerica(
      "connect-rate",
      t("Connect rate"),
      130,
      (l) => <Percentual valor={l.connectRate} titulo={ressalvaDoConnectRate} />,
      { dica: t("Visualizações da página ÷ cliques no link") },
    ),
    numerica("frequencia", t("Frequência"), 120, (l) => <Numero valor={l.frequencia} casas={2} />),
    numerica("cpc", t("CPC"), 110, (l) => dinheiro(l.cpc)),
    numerica("hook-rate", `${t("Hook Rate")} ${t("(reproduções)")}`, 170, (l) => <Percentual valor={l.hookRate} />, {
      dica: t("Reproduções de vídeo ÷ impressões"),
    }),
    numerica("thruplays", t("ThruPlays"), 120, (l) => <Numero valor={l.thruPlays} />),
  ];

  const opcoesDeEstado = Object.entries(ESTADO_LEGIVEL).map(([id, rotulo]) => ({
    id,
    rotulo: t(rotulo),
  }));
  const campos: Array<CampoConsultavel<LinhaDeCampanha> & { titulo: string; opcoes?: { id: string; rotulo: string }[] }> = [
    { id: "nome", titulo: t("Campanha"), tipo: "texto", valorDe: (l) => l.nome },
    {
      id: "status",
      titulo: t("Status"),
      tipo: "opcao",
      valorDe: (l) => l.status,
      opcoes: opcoesDeEstado,
      rotuloDoValor: (v) => t(ESTADO_LEGIVEL[v] ?? v),
    },
    {
      id: "veiculacao",
      titulo: t("Veiculação"),
      tipo: "opcao",
      valorDe: (l) => l.veiculacao,
      opcoes: opcoesDeEstado,
      rotuloDoValor: (v) => t(ESTADO_LEGIVEL[v] ?? v),
    },
    { id: "objetivo", titulo: t("Objetivo"), tipo: "texto", valorDe: (l) => l.objetivo },
    { id: "resultado", titulo: t("Resultado"), tipo: "numero", valorDe: (l) => l.resultado.valor },
    { id: "custo-resultado", titulo: t("Custo por Resultado"), tipo: "numero", valorDe: (l) => l.resultado.custoPorResultado },
    { id: "gasto", titulo: t("Valor Gasto"), tipo: "numero", valorDe: (l) => l.gasto },
    { id: "impressoes", titulo: t("Impressões"), tipo: "numero", valorDe: (l) => l.impressoes },
    { id: "alcance", titulo: t("Alcance"), tipo: "numero", valorDe: (l) => l.alcance },
    { id: "cpm", titulo: t("CPM"), tipo: "numero", valorDe: (l) => l.cpm },
    { id: "ctr", titulo: t("CTR"), tipo: "numero", valorDe: (l) => l.ctr },
    { id: "connect-rate", titulo: t("Connect rate"), tipo: "numero", valorDe: (l) => l.connectRate },
    { id: "frequencia", titulo: t("Frequência"), tipo: "numero", valorDe: (l) => l.frequencia },
    { id: "cpc", titulo: t("CPC"), tipo: "numero", valorDe: (l) => l.cpc },
    { id: "hook-rate", titulo: t("Hook Rate"), tipo: "numero", valorDe: (l) => l.hookRate },
    { id: "thruplays", titulo: t("ThruPlays"), tipo: "numero", valorDe: (l) => l.thruPlays },
  ];
  const camposDaBarra: CampoDaBarra[] = campos.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    tipo: c.tipo,
    opcoes: c.opcoes,
  }));

  const resolvidas = resolverColunas(colunas, preferencias);
  const mostradas = resolvidas.filter((c) => c.visivel);

  const termo = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const buscadas = useMemo(
    () =>
      termo
        ? linhas.filter((l) =>
            l.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(termo),
          )
        : linhas,
    [linhas, termo],
  );
  const resultado = useMemo(
    () => aplicarConsulta(buscadas, campos, preferencias, { hoje: new Date().toISOString().slice(0, 10) }),
    // `campos` é recriado a cada render; as entradas reais são estas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buscadas, preferencias, moeda],
  );
  const grupos = resultado.grupos?.map((g) => {
    const campo = campos.find((c) => c.id === preferencias.agrupar);
    const rotulo =
      g.chave === ""
        ? t("Sem valor")
        : (campo?.opcoes?.find((o) => o.id === g.chave)?.rotulo ?? g.rotulo);
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

  const abasPorId = new Map([
    [ID_DA_PADRAO, { id: ID_DA_PADRAO, nome: padrao.preferencias.nome ?? t("Todas"), tipo: "tabela" as const }],
    ...visoes.map((v) => [v.id, { id: v.id, nome: v.name, tipo: v.type }] as const),
  ]);
  const abas = ordemDasAbas.flatMap((a) => {
    const aba = abasPorId.get(a.id);
    return aba ? [aba] : [];
  });

  return (
    <div className="flex flex-col gap-3">
      <AbasDeVisualizacao
        abas={abas}
        ativaId={ativaId}
        podeEditar
        tipos={TIPOS}
        aoEscolher={escolherAba}
        aoCriar={(nome, tipo) =>
          void criarVisao({ name: nome, type: tipo, config: preferencias }).then((v) => v && escolherAba(v.id))
        }
        aoConfigurar={() => setConfigurando(true)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-60">
          <span className="sr-only">{t("Buscar")}</span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t("Buscar campanha")}
            className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
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
          }}
          aoMudar={mudarConsulta}
        />
      </div>

      <TabelaDoMotor
        linhas={resultado.linhas}
        idDe={(l) => l.campanhaId}
        colunas={mostradas}
        grupos={grupos}
        aoMoverColuna={(movido, alvo) =>
          atualizar((p) => ({
            ...p,
            ordem: moverColuna(resolvidas.filter((c) => !c.fixa).map((c) => c.id), movido, alvo),
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
          })
        }
        ordenacao={preferencias.ordenacao}
        colunasOrdenaveis={new Set(campos.map((c) => c.id))}
        aoReordenar={() => undefined}
        podeReordenar={false}
        rotuloDaTabela={t("Campanhas")}
        vazio={
          <p className="p-6 text-center text-sm text-muted-foreground">
            {linhas.length === 0
              ? t(
                  "Nenhuma campanha neste período. Ou a conta ainda não tem campanhas, ou elas foram criadas depois da data escolhida.",
                )
              : t("Nenhuma campanha combina com a busca e os filtros.")}
          </p>
        }
      />

      <ConfigurarVisualizacao
        aberto={configurando}
        aoFechar={() => setConfigurando(false)}
        nome={visaoAtiva?.name ?? padrao.preferencias.nome ?? t("Todas")}
        tipo={visaoAtiva?.type ?? "tabela"}
        tipos={TIPOS}
        podeEditar
        ehPadrao={!visaoAtiva}
        aoRenomear={(nome) =>
          visaoAtiva ? void editarVisao(visaoAtiva.id, { name: nome }) : padrao.atualizar((p) => ({ ...p, nome }))
        }
        aoTrocarTipo={() => undefined}
        aoMoverAba={moverAba}
        podeMoverAba={{
          esquerda: indiceDaAba > 0,
          direita: indiceDaAba >= 0 && indiceDaAba < ordemDasAbas.length - 1,
        }}
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
            ordem: moverColuna(resolvidas.filter((c) => !c.fixa).map((c) => c.id), movido, alvo),
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
