"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ConfiguracaoDaAgenda } from "./_components/ConfiguracaoDaAgenda";
import { abrirNovoCompromisso } from "@/lib/agenda/abrir-novo";
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
import type { Agendamento, VisaoDaAgenda } from "@/components/agenda/tipos";
import { ancoraLocalDoDia } from "@/lib/agenda/semana-semente";
import { recorteDaGrade as recorteDaGradeDe } from "@/lib/agenda/recorte-da-grade";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAgendamentos } from "@/hooks/agenda/useAgendamentos";
import { usePessoasDaAgenda } from "@/hooks/agenda/usePessoasDaAgenda";
import { ArrowsClockwise, CalendarPlus, CaretDown, CaretLeft, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/** As visões do menu, na ordem do Google Agenda. */
const VISOES: Array<{ id: VisaoDaAgenda; rotulo: string }> = [
  { id: "dia", rotulo: "Dia" },
  { id: "tres_dias", rotulo: "3 dias" },
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

  // A GRADE não mostra cancelado: ela responde "o que está de pé". A lista de próximos,
  // aguardando, passados e cancelados saiu desta página (pedido de 26/10/2026) — o que
  // cumpre essa função está no Início e na página do compromisso.
  const agendamentosDaGrade = React.useMemo(
    () => agendamentos.filter((a) => a.situacao !== "cancelled"),
    [agendamentos],
  );

  const passo = visao === "mes" ? 30 : visao === "semana" ? 7 : visao === "tres_dias" ? 3 : 1;
  // O PADRÃO de formato também muda de idioma, não só o locale: em português
  // "d 'de' MMMM" tem a preposição escrita à mão dentro do padrão, e em
  // espanhol ela também é "de" — mas quem garante isso é a chave no dicionário,
  // não a coincidência. Passando o padrão por `t()`, um idioma que ordene a
  // data de outro jeito não precisa de código novo aqui.
  const periodo =
    visao === "mes"
      ? format(ancora, t("MMMM 'de' yyyy"), { locale: localeDaData })
      : visao === "tres_dias"
        ? `${format(ancora, t("d 'de' MMM"), { locale: localeDaData })} — ${format(addDays(ancora, 2), t("d 'de' MMM"), { locale: localeDaData })}`
        : visao === "semana"
          ? `${format(startOfWeek(ancora, { weekStartsOn: 0 }), t("d 'de' MMM"), { locale: localeDaData })} — ${format(addDays(startOfWeek(ancora, { weekStartsOn: 0 }), 6), t("d 'de' MMM"), { locale: localeDaData })}`
          : format(ancora, t("EEEE, d 'de' MMMM"), { locale: localeDaData });

  return (
    <div
      data-testid="tela-agenda"
      data-fonte={agendamentosIniciais.length > 0 ? "api" : "api-sem-dado"}
      data-fuso={fusoDeApresentacao ?? "organizacao"}
      className="flex h-full w-full max-w-full min-w-0 flex-col gap-6 overflow-x-clip p-4 sm:p-6"
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
          <h1 className="text-2xl font-semibold tracking-tight">{t("Agenda")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("O que está marcado, com quem, e quem atende — seu e da equipe.")}
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col items-center gap-3 sm:w-auto sm:flex-row sm:justify-end sm:gap-2">
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
              className="h-10 w-full max-w-xs gap-2 rounded-xl px-4 text-sm sm:h-9 sm:w-auto sm:max-w-none sm:px-3 sm:text-xs lg:h-8"
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
              className="h-10 w-full max-w-xs gap-2 rounded-xl px-4 text-sm sm:h-9 sm:w-auto sm:max-w-none sm:px-3 sm:text-xs lg:h-8"
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
          {/* O MENU DE VISÕES, como no Google Agenda: um botão com a visão atual que abre a lista
              (Dia, 3 dias, Semana, Mês). Vale no celular e no computador. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                data-testid="alternador-de-visao"
                aria-label={t("Escolher a visualização")}
                className="h-10 gap-2 rounded-xl px-4 text-sm sm:h-9 sm:px-3 sm:text-xs lg:h-8"
              >
                <span data-testid="visao-atual">
                  {t(VISOES.find((v) => v.id === visao)?.rotulo ?? "Semana")}
                </span>
                <CaretDown size={12} weight="bold" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              {VISOES.map((v) => (
                <DropdownMenuItem
                  key={v.id}
                  data-testid={`visao-${v.id}`}
                  aria-checked={visao === v.id}
                  onSelect={() => setVisao(v.id)}
                  className={cn(visao === v.id && "font-semibold")}
                >
                  {t(v.rotulo)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

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
