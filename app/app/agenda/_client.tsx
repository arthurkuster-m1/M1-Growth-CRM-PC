"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ConfiguracaoDaAgenda } from "./_components/ConfiguracaoDaAgenda";
import { BotaoConfirmado, BotaoExcluir, BotaoResultado } from "@/components/agenda/AcoesDoCompromisso";
import { abrirNovoCompromisso } from "@/lib/agenda/abrir-novo";
import { AbasDaAgenda } from "@/components/agenda/AbasDaAgenda";
import { EntradaDaAgenda } from "@/components/agenda/EntradaDaAgenda";
import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";

import { useT } from "@/hooks/i18n/useT";

import { addDays, format, startOfWeek } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as React from "react";

import { AvisoDaConexaoGoogle } from "./_components/AvisoDaConexaoGoogle";
import { CartaoDaConexaoGoogle } from "./_components/CartaoDaConexaoGoogle";

import { AgendaInterativa } from "@/components/agenda/AgendaInterativa";
import { FiltroDePessoas } from "@/components/agenda/FiltroDePessoas";
import { HistoricoDaAgenda } from "@/components/agenda/HistoricoDaAgenda";
import type { Agendamento, VisaoDaAgenda } from "@/components/agenda/tipos";
import { EmptyAgenda } from "@/components/empty";
import { ancoraLocalDoDia } from "@/lib/agenda/semana-semente";
import { dataDeParede } from "@/lib/agenda/fuso";
import { recorteDaGrade as recorteDaGradeDe } from "@/lib/agenda/recorte-da-grade";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAgendamentos } from "@/hooks/agenda/useAgendamentos";
import {
  useCancelarAgendamento,
  useRegistrarDesfecho,
} from "@/hooks/agenda/useRemarcarAgendamento";
import { usePessoasDaAgenda } from "@/hooks/agenda/usePessoasDaAgenda";
import { ArrowsClockwise, CalendarPlus, CaretLeft, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const VISOES: Array<{ id: VisaoDaAgenda; rotulo: string }> = [
  { id: "dia", rotulo: "Dia" },
  { id: "semana", rotulo: "Semana" },
  { id: "mes", rotulo: "Mês" },
];

/**
 * A tela da Agenda.
 *
 * ⚠️ SEM DADO NENHUM até a frente 1 (API + motor) integrar. A tela cai no
 * estado vazio de propósito, e a razão é de SEGURANÇA PERCEBIDA, não de
 * pureza:
 *
 * dado falso PLAUSÍVEL numa tela real de produto multi-tenant é
 * indistinguível de VAZAMENTO. "Ana Prado", "Marina Alves", "Visita ao imóvel"
 * são nomes brasileiros críveis nos nichos que este produto atende — e o
 * relato que chega de quem vê isso não é "tem dado de teste na tela", é
 * "estou vendo paciente de outra clínica na minha agenda". O time então queima
 * horas caçando um furo de RLS que não existe. Achado do QAVivo, decisão 18.
 *
 * Repare na inversão, porque ela é o ponto: os MESMOS nomes são ACERTO na
 * vitrine (`/vitrine-agenda`), onde tornam o desenho julgável, e o pior
 * formato possível aqui. Mesmo dado, valor oposto conforme onde está pendurado.
 *
 * E o vazio é mais VERDADEIRO: numa instalação nova a agenda está vazia mesmo.
 * De quebra exercita o estado vazio, que é onde mora a primeira impressão.
 *
 * `data-fonte` declara isso no DOM para ser verificável de fora — e
 * `tests/unit/telas-sem-dado-de-mentira.test.ts` impede que alguém religue os
 * imports sem querer.
 */
export function AgendaClient({
  fusoDaAgenda,
  fusoDeApresentacao,
  hojeNaOrganizacao,
  usuarioId,
  googleConfigurado,
  contaConectada,
  enderecoDeRetorno,
  faltaNoGoogle,
  linkDeConfiguracaoDoGoogle,
  tiposIniciais,
  agendamentosIniciais,
  podeMarcar,
  configuracaoDasRegras,
  configuracaoDosTipos,
  podeGerenciarEquipe,
  podeConvidarAtendentes,
}: {
  /** As regras da Agenda (Google, presença, colegas, dias fora da rotina), conteúdo de servidor. */
  configuracaoDasRegras?: React.ReactNode;
  podeConvidarAtendentes?: boolean;
  /** A configuração dos tipos de atendimento (conteúdo de servidor), no fim da página. */
  configuracaoDosTipos?: React.ReactNode;
  podeGerenciarEquipe?: boolean;
  /**
   * O fuso RESOLVIDO da organização (`fusoUtilizavel(activeOrg.timezone)`,
   * calculado em `page.tsx`). É a régua da grade: sem ele a agenda desenha
   * hora de parede no relógio do navegador (issue #1362).
   */
  fusoDaAgenda: string;
  fusoDeApresentacao: string | null;
  /**
   * A data de HOJE no fuso da ORGANIZAÇÃO, resolvida pelo servidor
   * (`yyyy-MM-dd`). É a mesma que gerou a semente de compromissos.
   */
  hojeNaOrganizacao: string;
  /** Id de quem está logado — a única fonte para o rótulo "Você". */
  usuarioId: string;
  googleConfigurado: boolean;
  contaConectada?: string | null;
  enderecoDeRetorno?: string;
  faltaNoGoogle: string[];
  /** Preenchido só para quem administra a instalação — ver `page.tsx`. */
  linkDeConfiguracaoDoGoogle?: string;
  /** Tipos ativos, resolvidos no servidor: não há rota que os liste ainda. */
  tiposIniciais: Array<{
    id: string;
    nome: string;
    duracaoMin: number;
    donoId: string | null;
    localKind: string | null;
    localDetalhes: string | null;
  }>;
  /** A semana corrente, resolvida no servidor: `GET /agendamentos` não existe. */
  agendamentosIniciais: Agendamento[];
  /**
   * Quem está logado pode MARCAR — o mesmo piso da rota (`requireRole("agent")`
   * em `app/api/v1/agenda/agendamentos/route.ts`).
   *
   * É a MESMA porta, com o MESMO piso, em todos os gestos de escrita desta tela:
   * o botão "Novo agendamento", o clique num bloco livre da grade, o encaixe
   * ("Outro horário") do painel e o "Marcar compromisso" que chega por
   * `?contato=`. Oferecer qualquer uma delas a quem só lê é oferecer um 403 —
   * com a recusa chegando DEPOIS do gesto, que é o defeito que este nome veio
   * fechar. Esconder aqui é cortesia: quem decide segue sendo a rota.
   */
  podeMarcar: boolean;
}) {
  const localeDaData = useLocaleDeData();
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sincronizando, setSincronizando] = React.useState(false);
  const sincronizarComGoogle = async () => {
    setSincronizando(true);
    try {
      const r = await fetch("/api/v1/agenda/google/sincronizar", { method: "POST" });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        toast.error(j?.error?.message ?? t("Não foi possível sincronizar com o Google agora."));
      } else {
        toast.success(t("Sincronizado com o Google."));
        await queryClient.invalidateQueries();
        router.refresh();
      }
    } catch {
      toast.error(t("Não foi possível sincronizar com o Google agora."));
    } finally {
      setSincronizando(false);
    }
  };
  // CANCELAR pede motivo, e o motivo é obrigatório na rota. Não é burocracia: é
  // o que a equipe lê ao ver o horário vago.
  const [cancelandoId, setCancelandoId] = React.useState<string | null>(null);
  const [motivo, setMotivo] = React.useState("");
  const cancelar = useCancelarAgendamento();
  const desfecho = useRegistrarDesfecho();
  // ⚠️ ERA `tiposIniciais[0] ?? null` — uma constante, sem seletor em lugar
  // nenhum. `page.tsx` ordena os tipos por NOME, então a tela marcava sempre o
  // primeiro em ordem alfabética e não havia como marcar outro: numa org com
  // "Atendimento", "Consulta", "Reunião", só "Atendimento" era alcançável pela
  // tela. As categorias existiam no banco, no seed e na API — e a tela oferecia
  // uma. Achado escrevendo a spec de marcar, não lendo o código.
  // ⚠️ E O TIPO ESCOLHIDO ERA SÓ ESTADO DO REACT — o outro lado do mesmo achado.
  // A escolha na grade ia para um `useState` sem URL, sem armazenamento e sem
  // leitor de query nenhuma: no F5 ela morria e a grade voltava ao primeiro tipo
  // em ordem alfabética (#1657). Quem estava olhando "Avaliação" recarregava e
  // via "Atendimento" — e, sem jornada publicada para o primeiro, a tela inteira
  // dizia "a jornada de atendimento ainda não foi publicada". Evidência na
  // issue: as runs 36061761510 e 36164033754, que acharam o defeito pelo aviso
  // nascendo entre duas leituras de bounding box no e2e do arraste (#1656).
  //
  // O tipo passa a viver na URL (`?tipo=`), no mesmo formato do `?id=` da Inbox
  // (#1629). LER no inicializador, e não num efeito: o servidor pinta a página
  // com a MESMA query que o cliente lê, então primeira pintura e recarregamento
  // concordam — sem um piscar voltando ao primeiro tipo. `?tipo=` de um tipo já
  // desativado cai no `?? tiposIniciais[0]` da linha seguinte, que é o
  // comportamento de sempre para quem não escolheu nada.
  const busca = useSearchParams();
  const caminho = usePathname();
  const [tipoId, setTipoId] = React.useState<string | null>(
    () => busca.get("tipo") ?? tiposIniciais[0]?.id ?? null,
  );
  const tipo = tiposIniciais.find((t) => t.id === tipoId) ?? tiposIniciais[0] ?? null;
  // "Novo agendamento" abre a página única do compromisso (a mesma de qualquer tela).
  const abrirMarcacao = React.useCallback(() => {
    abrirNovoCompromisso({ eventTypeId: tipo?.id ?? null });
  }, [tipo?.id]);
  /**
   * ESCOLHER O TIPO GRAVA NA URL — a outra metade do `useState` acima.
   *
   * `window.history.replaceState` e não `router.replace`, pela razão medida na
   * Inbox (#1629): a History API troca a query SEM pedir um novo Server
   * Component a cada clique — e esta rota tem cinco consultas de servidor atrás
   * dela (`page.tsx`), que rodariam a cada troca de tipo. `replace` e não
   * `push`: trocar de tipo não é uma navegação nova, e com `push` o "voltar"
   * do navegador acumularia um passo por clique.
   */
  const escolherTipo = React.useCallback(
    (id: string) => {
      setTipoId(id);
      const parametros = new URLSearchParams(busca.toString());
      if (id) parametros.set("tipo", id);
      else parametros.delete("tipo");
      const query = parametros.toString();
      window.history.replaceState(null, "", query ? `${caminho}?${query}` : caminho);
    },
    [busca, caminho],
  );
  const [visao, setVisao] = React.useState<VisaoDaAgenda>("semana");
  /**
   * No CELULAR a agenda abre no DIA, não na semana.
   *
   * Duas razões, e a segunda é consequência da primeira. A semana em 360px é
   * ilegível — por isso a grade esconde as outras colunas abaixo de `md`. Mas o
   * passo de navegação da semana é de SETE dias: quem visse um dia só e tocasse
   * em avançar pularia a semana inteira, sem alcançar os outros seis. Abrindo no
   * dia, o passo é 1 e cada toque anda um dia.
   *
   * Em `useEffect`, e não no estado inicial, porque `window` não existe no
   * servidor: decidir a visão na primeira renderização faria o HTML do servidor
   * discordar do cliente. Roda uma vez, na montagem, então não desfaz escolha
   * de quem trocou a visão depois.
   */
  React.useEffect(() => {
    // O aviso da regra é justo em geral; aqui trocar a visão É o ponto do efeito.
    // A largura só existe no cliente, e decidir antes divergiria da hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.matchMedia("(max-width: 767px)").matches) setVisao("dia");
  }, []);
  const [isolada, setIsolada] = React.useState<string | null>(null);
  /**
   * A ÂNCORA NASCE DO RELÓGIO DA ORGANIZAÇÃO, não do navegador.
   *
   * Era `useState(() => new Date())`. O servidor desenha a semana no fuso da
   * organização (decisão do dono em #1350) e o cliente recalculava no fuso do
   * NAVEGADOR: das 21h de sábado à meia-noite em São Paulo, com servidor em UTC,
   * os dois discordavam e a tela piscava a semana seguinte — e, para quem abre o
   * CRM fora do fuso da empresa, discordava sempre.
   *
   * O que atravessa a fronteira é a DATA (`hojeNaOrganizacao`), nunca o
   * instante: `domingo 00:00` em São Paulo é `sábado 22:00` em UTC-5, e
   * `startOfWeek` sobre esse instante, em hora local, cairia na semana anterior.
   * `ancoraLocalDoDia` transforma a data numa `Date` local ao meio-dia — a doze
   * horas de qualquer borda de horário de verão.
   */
  const [ancora, setAncora] = React.useState(() => ancoraLocalDoDia(hojeNaOrganizacao));

  // AS PESSOAS SÃO REAIS, e vêm da lista MÍNIMA da agenda — `/api/v1/agenda/pessoas`
  // (`ROTA_DA_LISTA_DE_PESSOAS`, `lib/agenda/lista-de-pessoas.ts`), papel mínimo
  // `agent` e só id/nome. Com a trilha de cor derivada do `user_id`.
  //
  // ⚠️ ESTA LINHA DIZIA `/api/v1/team`, E A FRASE MENTIA. Ela descrevia o estado
  // de antes do item 1 da issue 896, quando a agenda pedia a equipe à rota de
  // administração — que é `manager+` e devolve e-mail e último acesso — e o
  // Atendente levava 403 só por abrir a tela (virava aviso de falta de
  // permissão sobre uma grade que continuava lá). A rota mínima consertou isso;
  // a prosa ficou. Medido nesta rodada:
  //   grep -rn "api/v1/team" app/app/agenda/ | grep -v "\(//\|\*\)"  → vazio
  // É por isso que a frase foi reescrita em vez de apagada: quem lê o código
  // para entender o 403 do Atendente precisa saber que ele JÁ não existe, e um
  // comentário que afirma o contrário é o defeito de novo.
  const { data: pessoas = [] } = usePessoasDaAgenda();

  // A JANELA ACOMPANHA O MÊS QUE O PAINEL MOSTRA.
  //
  // ⚠️ Isto era `hoje + 30 dias`, fixo na abertura. O mês visível era estado
  // LOCAL do painel, a consulta não ia junto, e "Próximo mês" desligava assim
  // que acabavam os dias já pedidos — daqui a dois meses o calendário parava
  // e a ocupação do Google acusava período sem cobertura, mesmo com a janela
  // de agendamento do tipo (60 dias por padrão, até 365) ainda valendo.
  //
  // A estabilidade continua: a chave do React Query só muda quando o mês, o
  // tipo ou a abertura mudam — nunca a cada render. `new Date()` aqui corre
  // uma vez por essas mudanças, não no corpo.
  // Mesmo relógio da grade: o mini-calendário abre no mês da ORGANIZAÇÃO.

  // OS AGENDAMENTOS SÃO REAIS, e agora TAMBÉM se atualizam sem recarregar.
  //
  // ⚠️ O comentário que estava aqui dizia que `GET /api/v1/agenda/agendamentos`
  // "ainda não existe (a rota tem POST, PATCH e DELETE)". Era verdade quando foi
  // escrito e VENCEU: `grep -n "^export async function" app/api/v1/agenda/agendamentos/route.ts`
  // devolve GET:95. A prosa descrevia um estado, o estado mudou, e a frase ficou
  // — junto com o `useAgendamentos`, que existia inteiro e não era montado por
  // ninguém (1 ocorrência no repo: a própria definição).
  //
  // A prop do RSC segue sendo a PRIMEIRA pintura (sem piscar, sem spinner) e o
  // hook assume dali: `useMarcarAgendamento` já invalida `["agenda"]`, então
  // marcar pela tela repinta a grade sozinho.
  // O recorte acompanha o que a grade DESENHA — mesma visão, mesma âncora.
  // Instante ISO, nunca o filtro `dia`: o cabeçalho do hook mede por que
  // (`dia=` corta em UTC e some com o compromisso das 22h no fuso de São Paulo).
  // A conta mora em `lib/agenda/recorte-da-grade.ts`, junto com a do desenho:
  // a visão Mês desenha seis semanas, e buscar só o mês deixava vazios os dias
  // do mês vizinho que ela mostra.
  const recorteDaGrade = React.useMemo(() => {
    const { de, ate } = recorteDaGradeDe(visao, ancora);
    return { de: de.toISOString(), ate: ate.toISOString() };
  }, [visao, ancora]);

  // A janela que o SERVIDOR pintou. Sem esta comparação, navegar para outra
  // semana mostraria os compromissos DESTA por um instante — o fallback estaria
  // respondendo a uma pergunta que ninguém fez. Cair para lista vazia é pior de
  // aparência e melhor de verdade: a grade fica vazia por um piscar, em vez de
  // mostrar compromisso no dia errado.
  // ⚠️ `useState` com inicializador, e NÃO `useRef(...).current`.
  //
  // A intenção é a mesma — congelar a janela da primeira pintura —, mas ler
  // `.current` durante o render é violação de regra do React, e o `pnpm lint`
  // reprova com "Cannot access refs during render". Foi o CI que me disse: eu
  // tinha rodado typecheck e vitest e NÃO tinha rodado lint. O `verify` cai nos
  // três, e eu só olhei dois.
  //
  // `useState(() => x)[0]` faz o mesmo congelamento sem tocar em ref no render.
  const [recorteDoServidor] = React.useState(() => recorteDaGrade);
  const naJanelaDoServidor =
    recorteDaGrade.de === recorteDoServidor.de && recorteDaGrade.ate === recorteDoServidor.ate;

  const { data: agendamentosVivos } = useAgendamentos(recorteDaGrade);
  const todos: Agendamento[] =
    agendamentosVivos ?? (naJanelaDoServidor ? agendamentosIniciais : []);

  const agendamentos = React.useMemo(
    () => (isolada === null ? todos : todos.filter((a) => a.responsavelId === isolada)),
    [isolada, todos],
  );

  // A GRADE não mostra cancelado — ele fica só na aba "Cancelados" do
  // histórico, que lê `agendamentos` (cheio) e o separa sozinha em `separar()`.
  // Mesma fonte, dois recortes: a grade responde "o que está de pé", o
  // histórico responde "o que aconteceu", cancelado incluso.
  const agendamentosDaGrade = React.useMemo(
    () => agendamentos.filter((a) => a.situacao !== "cancelled"),
    [agendamentos],
  );

  /**
   * O que é ACIONÁVEL — o que a lista "Próximos" pode oferecer botão para fazer.
   *
   * Ocupação vinda do Google fica de fora: ela é bloco de terceiro, o id é de
   * `calendar_external_events`, e as rotas de remarcar/cancelar procuram em
   * `calendar_appointments`. Ver o comentário longo no `HistoricoDaAgenda`
   * abaixo, com o 404 medido.
   *
   * A GRADE recebe `agendamentosDaGrade` (tudo menos cancelado) — é lá que a ocupação
   * precisa aparecer, e é lá que ela já é desenhada inerte.
   */
  const agendamentosAcionaveis = React.useMemo(
    () => agendamentos.filter((a) => a.origem !== "google_sync"),
    [agendamentos],
  );

  const passo = visao === "mes" ? 30 : visao === "semana" ? 7 : 1;
  // O PADRÃO de formato também muda de idioma, não só o locale: em português
  // "d 'de' MMMM" tem a preposição escrita à mão dentro do padrão, e em
  // espanhol ela também é "de" — mas quem garante isso é a chave no dicionário,
  // não a coincidência. Passando o padrão por `t()`, um idioma que ordene a
  // data de outro jeito não precisa de código novo aqui.
  const periodo =
    visao === "mes"
      ? format(ancora, t("MMMM 'de' yyyy"), { locale: localeDaData })
      : visao === "semana"
        ? `${format(startOfWeek(ancora, { weekStartsOn: 0 }), t("d 'de' MMM"), { locale: localeDaData })} — ${format(addDays(startOfWeek(ancora, { weekStartsOn: 0 }), 6), t("d 'de' MMM"), { locale: localeDaData })}`
        : format(ancora, t("EEEE, d 'de' MMMM"), { locale: localeDaData });

  return (
    <div
      data-testid="tela-agenda"
      data-fonte={agendamentosIniciais.length > 0 ? "api" : "api-sem-dado"}
      data-fuso={fusoDeApresentacao ?? "organizacao"}
      className="flex h-full w-full min-w-0 max-w-full flex-col gap-6 overflow-x-clip p-4 sm:p-6"
    >
      {/*
        Em Suspense porque `useSearchParams` obriga: sem a fronteira, o Next
        reprova o build da rota. Fallback nulo porque a ausência do aviso é o
        estado normal — quem chega pela navegação não tem query nenhuma.
      */}
      <React.Suspense fallback={null}>
        <AvisoDaConexaoGoogle />
        <EntradaDaAgenda />
      </React.Suspense>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <AbasDaAgenda ativa="agenda" />
          <h1 className="text-2xl font-semibold tracking-tight">{t("Agenda")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("O que está marcado, com quem, e quem atende — seu e da equipe.")}
          </p>
        </div>
        <div className="flex min-w-0 items-center justify-center gap-2 sm:justify-end">
          {/*
            DESABILITADO COM O MOTIVO À VISTA, e não ligado a um `onClick` vazio.
            Enquanto a frente 1 não expõe `/api/v1/agenda` não há o que marcar, e
            um botão primário, com cor de ação e sem `disabled`, que não faz nada
            ao clique é pior do que não existir: quem clica conclui que o produto
            está quebrado e não tem o que reportar além de "não abre". É o
            anti-pattern de controle decorativo, e esta base já pagou por ele.

            O motivo vai em texto ao lado, não só no `title`: atributo de
            hover não existe para quem usa toque, que é o dono de clínica no
            celular.
          */}
          {podeMarcar && !tipo && (
            // Sem NENHUM tipo de agendamento cadastrado não há o que marcar — e
            // isto é diferente de "a API não existe": a ação faz sentido, falta
            // configuração. Por isso o motivo à vista, e não um botão mudo.
            //
            // `podeMarcar` vem ANTES de `!tipo`, e a ordem é o ponto: para quem
            // só lê não existe botão desabilitado a explicar, então o motivo
            // seria conversa sobre um gesto que não está na tela dele.
            <span
              data-testid="motivo-novo-agendamento"
              className="hidden text-xs text-text-subtle sm:inline"
            >
              {t("Cadastre um tipo de agendamento para começar")}
            </span>
          )}
          {/* PRIMEIRA PORTA da escrita nesta tela. Quem só lê não vê o botão: o
              403 da rota nunca chega a ser oferecido, e o rótulo segue igual (a
              spec e2e o acha por papel/rótulo, e não muda). */}
          {contaConectada && podeMarcar && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-xl px-3 text-xs lg:h-8"
              data-testid="sincronizar-google"
              disabled={sincronizando}
              onClick={sincronizarComGoogle}
            >
              <ArrowsClockwise size={14} weight="bold" aria-hidden />
              <span>{sincronizando ? t("Sincronizando…") : t("Sincronizar com Google")}</span>
            </Button>
          )}
          {podeMarcar && (
            <Button
              size="sm"
              className="h-9 gap-1.5 rounded-xl px-3 text-xs lg:h-8"
              disabled={!tipo}
              // `data-testid` porque o RÓTULO deixou de ser estável: até este PR
              // ele era literal, e `agenda-escopo-da-organizacao.spec.ts` o acha
              // por `getByRole("button", { name: /Novo agendamento/i })`. Com o
              // texto passando por `t()`, casar por rótulo passa a depender do
              // idioma da conta de teste — hoje passa porque a conta nasce em
              // português, mas é acoplamento que não precisa existir. O testid é
              // o caminho estável; trocar a spec para usá-lo é decisão de quem a
              // escreveu, e vai anotada no PR.
              data-testid="novo-agendamento"
              title={tipo ? undefined : t("Cadastre um tipo de agendamento para começar")}
              onClick={abrirMarcacao}
            >
              <CalendarPlus size={14} weight="bold" aria-hidden />
              <span>{t("Novo agendamento")}</span>
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full min-w-0 items-center justify-center gap-1.5 sm:w-auto sm:justify-start">
          {/* "Hoje" é o hoje DA ORGANIZAÇÃO. Com `new Date()` o botão desfazia a âncora do servidor
              e devolvia a semana do navegador. Fica ao lado da seleção de data. */}
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl px-3 text-xs lg:h-8"
            onClick={() => setAncora(ancoraLocalDoDia(hojeNaOrganizacao))}
          >
            {t("Hoje")}
          </Button>
          {/* seta, nome do dia ou da semana no centro, seta */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("Período anterior")}
            data-testid="periodo-anterior"
            onClick={() => setAncora((d) => addDays(d, -passo))}
          >
            <CaretLeft size={16} weight="bold" aria-hidden />
          </Button>
          {/* `first-letter:uppercase` e NÃO `capitalize`: o `capitalize` do CSS maiúscula toda
              palavra, e o date-fns em pt-br devolve "23 de ago" — virava "23 De Ago". */}
          <span
            data-testid="periodo"
            className="min-w-0 flex-1 text-center text-sm font-semibold text-balance first-letter:uppercase sm:min-w-[11rem] sm:flex-none"
          >
            {periodo}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("Próximo período")}
            data-testid="periodo-seguinte"
            onClick={() => setAncora((d) => addDays(d, passo))}
          >
            <CaretRight size={16} weight="bold" aria-hidden />
          </Button>
        </div>

        {/* `flex-wrap` pelo mesmo motivo da vitrine, e aqui é conserto de CLASSE e
            não de instância: esta linha passou no gate por sorte de largura (a
            organização de teste tem cinco pessoas), não por estar certa. Com mais
            gente no filtro, ela estoura igual — e o `overflow-x: hidden` corta o
            alternador de visão em silêncio. */}
        <div className="flex flex-wrap items-center gap-3">
          <FiltroDePessoas pessoas={pessoas} isolada={isolada} onIsolar={setIsolada} />
          <div
            data-testid="alternador-de-visao"
            // No celular a agenda é só do dia: o alternador de visão não aparece.
            className="hidden items-center gap-0.5 rounded-xl border border-border bg-surface p-0.5 md:flex"
          >
            {VISOES.map((v) => (
              <button
                key={v.id}
                type="button"
                data-testid={`visao-${v.id}`}
                aria-pressed={visao === v.id}
                onClick={() => setVisao(v.id)}
                className={cn(
                  // `min-h-11 px-3` até `lg` — o alternador de visão media
                  // **24px de altura** em 360px (`py-1` em volta de `text-xs`),
                  // pouco mais da metade do piso de 44px da Apple HIG. É o
                  // controle que decide o que a agenda mostra, e no celular ele
                  // era uma tira fina entre dois outros controles.
                  //
                  // `lg:` devolve o compacto onde quem aciona é cursor, no mesmo
                  // corte que `components/ui/button.tsx` já usa.
                  "min-h-11 rounded-sm px-3 py-1 text-xs transition-colors duration-fast ease-out lg:min-h-0 lg:px-2.5",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
                  visao === v.id
                    ? "bg-accent font-semibold text-accent-foreground"
                    : "text-text-muted hover:bg-surface-elevated hover:text-text",
                )}
              >
                {t(v.rotulo)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/*
        O HISTÓRICO na tela do produto, e não só na vitrine. Ele aparece mesmo
        sem dado: as quatro abas com contador zero respondem "não há nada" sem
        gastar um clique, e some-lo faria a tela parecer menor do que é.
      */}

      {/* CANCELAR pede motivo, e o motivo é OBRIGATÓRIO na rota (mínimo 3).
          Não é burocracia: é o que a equipe lê ao ver o horário vago. "Cancelado"
          sem motivo faz alguém ligar para o cliente perguntando o que houve — ou,
          pior, não ligar. */}
      <Sheet
        open={cancelandoId !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setCancelandoId(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("Cancelar agendamento")}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3" data-testid="painel-de-cancelamento">
            <p className="text-sm text-text-muted">
              {(() => {
                const alvo = todos.find((a) => a.id === cancelandoId);
                if (!alvo) return t("Este agendamento não está mais na lista.");
                const quem = alvo.quemSeraAtendido ? ` ${t("de")} ${alvo.quemSeraAtendido}` : "";
                return `${alvo.titulo}${quem}, ${format(
                  dataDeParede(new Date(alvo.comeca), fusoDaAgenda),
                  t("d 'de' MMMM 'às' HH:mm"),
                  { locale: localeDaData },
                )}.`;
              })()}
            </p>
            <label
              className="block text-xs font-medium text-text-muted"
              htmlFor="motivo-do-cancelamento"
            >
              {t("Por que está cancelando?")}
            </label>
            <textarea
              id="motivo-do-cancelamento"
              data-testid="motivo-do-cancelamento"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-surface p-2 text-sm outline-hidden focus:border-border-strong"
              placeholder={t("O paciente pediu para remarcar por telefone")}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCancelandoId(null)}>
                {t("Voltar")}
              </Button>
              <Button
                size="sm"
                data-testid="confirmar-cancelamento"
                // O mínimo de 3 é o da rota. Desabilitar aqui evita um 422 que a
                // pessoa não tem como prever — o botão diz o que falta pelo estado.
                disabled={motivo.trim().length < 3 || cancelar.isPending}
                onClick={() => {
                  const id = cancelandoId;
                  if (!id) return;
                  void cancelar
                    .mutateAsync({
                      id,
                      revision: agendamentos.find((a) => a.id === id)?.revision,
                      reason: motivo.trim(),
                    })
                    .then(
                      () => setCancelandoId(null),
                      () => undefined,
                    );
                }}
              >
                {cancelar.isPending ? t("Cancelando…") : t("Cancelar agendamento")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/*
        ⚠️ A LISTA DAQUI NÃO É A MESMA DA GRADE, e a diferença é uma linha.

        `GradeDaAgenda` conhece `origem` e desenha o bloco do Google inerte
        (`disabled`, sem arraste, rótulo "Ocupado"). `HistoricoDaAgenda` NÃO
        conhece origem: ela decide o botão por `disabled={!onRemarcar}`, que é
        uma prop do componente inteiro e não da linha. Passar a mesma lista aos
        dois faz a ocupação do Google chegar em "Próximos" com **Remarcar e
        Cancelar habilitados** — e cancelar responde 404, porque o id é de
        `calendar_external_events` e a rota procura em `calendar_appointments`.

        Medido pela tela em 2026-09-03, na triagem do PR #474:

          DELETE /api/v1/agenda/agendamentos
          → 404 {"error":{"code":"not_found","message":"Agendamento não encontrado."}}
          toast vermelho aos 1,5s, o painel continua aberto, a linha continua na
          lista, e `calendar_external_events.status` segue `confirmed`.

        É o "controle decorativo" que o comentário de `GradeDaAgenda` diz que
        esta base já pagou uma vez, replantado no componente irmão — e o #474 o
        tornou PERMANENTE: antes dele a linha só existia no primeiro frame da
        semana corrente (a semente do servidor) e sumia no primeiro refetch.

        Filtrar é o conserto certo, e não é escolha estética: bloco anônimo do
        Google não é um compromisso NOSSO. Não há o que remarcar, não há o que
        cancelar, e "Ocupado · 15:00–16:00" numa lista de próximos atendimentos
        não informa nada que a grade — que O DESENHA no horário — já não diga
        melhor. A ocupação continua inteira onde ela serve.
      */}
      <HistoricoDaAgenda
        agendamentos={agendamentosAcionaveis}
        pessoas={pessoas}
        agora={new Date()}
        renderAcoes={(a, { aba, jaComecou }) => (
          <>
            {podeMarcar && aba !== "cancelados" && (a.situacao === "pending" || a.situacao === "confirmed") ? (
              <BotaoConfirmado id={a.id} />
            ) : null}
            {podeMarcar && aba === "passados" && a.situacao !== "completed" && a.situacao !== "no_show" ? (
              <BotaoResultado id={a.id} jaComecou={jaComecou} />
            ) : null}
            {podeMarcar ? <BotaoExcluir id={a.id} /> : null}
          </>
        )}
        // Mesma régua da grade ao lado: sem isto a lista imprime o relógio do
        // navegador e a MESMA tela diz duas horas para o mesmo compromisso.
        fuso={fusoDaAgenda}
        className="max-h-[320px]"
        // ⚠️ ESTAS DUAS PROPS FALTAVAM, e a ausência tinha cara de permissão.
        // `HistoricoDaAgenda` usa `disabled={!onRemarcar}`; sem elas os botões
        // nasciam cinzas em toda linha, de toda organização — e o `title` dizia
        // "Disponível quando a agenda estiver conectada", que é falso: PATCH e
        // DELETE não tocam o Google. Só a IA conseguia remarcar ou cancelar.
        // Remarcar abre a página do compromisso: é lá que se escolhe a nova data e o horário.
        onRemarcar={(id) => {
          router.push(`/app/agenda?compromisso=${id}`);
        }}
        onCancelar={(id) => {
          setMotivo("");
          setCancelandoId(id);
        }}
        // E ESTAS DUAS TAMBÉM FALTAVAM — o conserto acima alcançou 2 dos 4
        // botões do MESMO componente, e "Realizado"/"Faltou" ficaram cinzas,
        // com a mesma frase falsa, por mais tempo ainda. Conserto por instância
        // custa a segunda passada; a varredura custaria um `grep`.
        //
        // Sem cerimônia de confirmação, ao contrário de cancelar: registrar
        // desfecho não avisa ninguém e se desfaz voltando o status. Cancelar
        // exige motivo porque é o que a equipe lê ao ver o horário vago.
        // CONFIRMAR usa o mesmo `desfecho` que realizado/faltou: os três são o
        // mesmo PATCH com outro `status`. Criar um hook próprio duplicaria a
        // invalidação de cache e o tratamento de erro por nada.
        onConfirmar={(id) =>
          desfecho.mutate({
            id,
            revision: agendamentos.find((a) => a.id === id)?.revision,
            status: "confirmed",
          })
        }
        onRealizado={(id) =>
          desfecho.mutate({
            id,
            revision: agendamentos.find((a) => a.id === id)?.revision,
            status: "completed",
          })
        }
        onFaltou={(id) =>
          desfecho.mutate({
            id,
            revision: agendamentos.find((a) => a.id === id)?.revision,
            status: "no_show",
          })
        }
      />

      {/* ⚠️ O VAZIO NÃO ESCONDE MAIS A GRADE, e o achado veio do CI.
          Isto era um ternário: com zero agendamentos, `EmptyAgenda` entrava NO
          LUGAR de `GradeDaAgenda`. Numa instalação nova — que é o estado de
          primeira impressão — a pessoa abria a Agenda e não via calendário
          NENHUM: sem semana, sem horários, e com o alternador de visão ligado a
          nada, que é controle decorativo.

          A mensagem continua, porque ela é boa: diz de ONDE vem o próximo
          agendamento em vez de constatar a ausência. Ela virou aviso ACIMA da
          grade, e a grade fica.

          Achado porque a cerca nova das três visões passou aqui (banco com
          dados de execuções anteriores) e reprovou no CI, onde o banco nasce
          limpo. O mesmo formato do defeito que `agenda-tela-do-produto` já
          tinha pago: verde por banco sujo. */}
      {agendamentos.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-4">
          <EmptyAgenda />
        </div>
      ) : null}
      {/* A GRADE INTERATIVA — clicar num bloco livre marca ali, arrastar um card
          remarca. Toda a fiação (a consulta de horários da janela desenhada, a
          proposta de remarcação, o otimismo com volta atrás) mora em
          `AgendaInterativa`; aqui fica só o que esta tela já sabia. */}
      <AgendaInterativa
        fuso={fusoDaAgenda}
        visao={visao}
        ancora={ancora}
        agora={new Date()}
        pessoas={pessoas}
        agendamentos={agendamentosDaGrade}
        recorte={recorteDaGrade}
        tipos={tiposIniciais.map((t) => ({ id: t.id, nome: t.nome, duracaoMin: t.duracaoMin }))}
        tipo={tipo ? { id: tipo.id, duracaoMin: tipo.duracaoMin } : null}
        onEscolherTipo={escolherTipo}
        // SEGUNDA PORTA: o clique num bloco livre da grade. Sem `onMarcarEm`, a
        // `AgendaInterativa` não monta a interação, e a grade volta a ser o que
        // ela é para quem só lê — uma leitura, sem bloco clicável.
        onMarcarEm={
          podeMarcar
            ? (instante) => {
                // Clicar num bloco livre abre o NOVO compromisso já nesse horário.
                abrirNovoCompromisso({ startsAt: instante, eventTypeId: tipo?.id ?? null });
              }
            : undefined
        }
        /* Tocar num card abre o detalhe. A prop já atravessava `AgendaInterativa`
           e `GradeDaAgenda` e chegava `undefined` aqui: o toque não fazia nada, e
           o detalhe só abria por `?compromisso=`, que apenas o Histórico e o Radar
           linkavam. Reusa o MESMO parâmetro que `EntradaDaAgenda` já lê — e `push`,
           não `replace`, porque é o que o Histórico faz com `<Link>` e é o que faz
           o botão voltar do celular fechar o detalhe. E o `?tipo=` vai JUNTO:
           sem ele, abrir um card trocava a URL por só `?compromisso=`, o fecho
           não achava tipo nenhum para manter e o F5 seguinte voltava ao
           primeiro (#1657). */
        onAbrirAgendamento={(id) => {
          const parametros = new URLSearchParams();
          if (tipo) parametros.set("tipo", tipo.id);
          parametros.set("compromisso", id);
          router.push(`/app/agenda?${parametros.toString()}`);
        }}
        className="min-h-0 flex-1"
      />

      <CartaoDaConexaoGoogle
        configurado={googleConfigurado}
        falta={faltaNoGoogle}
        linkDeConfiguracao={linkDeConfiguracaoDoGoogle}
        contaConectada={contaConectada}
        enderecoDeRetorno={enderecoDeRetorno}
      />

      {configuracaoDosTipos ? (
        <ConfiguracaoDaAgenda
          regras={configuracaoDasRegras}
          podeConvidar={podeConvidarAtendentes === true}
          tipos={configuracaoDosTipos}
          podeGerenciarEquipe={podeGerenciarEquipe === true}
          fuso={fusoDaAgenda}
        />
      ) : null}
    </div>
  );
}
