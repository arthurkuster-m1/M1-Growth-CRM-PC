"use client";

import { useId, useState, useTransition } from "react";

import {
  definirAgendaDosColegas,
  type ErroAgendaDosColegas,
} from "@/app/actions/settings/definirAgendaDosColegas";
import { definirVerAgendaDosColegas } from "@/app/actions/settings/definirVerAgendaDosColegas";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/hooks/i18n/useT";

/**
 * AGENDA DOS COLEGAS — duas regras da organização, só do administrador.
 *
 * VER (migration 0671): ligada, cada atendente vê a agenda de todos (o comportamento de sempre).
 * Desligada, o atendente vê só a própria; gerente e administrador veem todas.
 *
 * MEXER (migration 0343, issue #978): ligada, qualquer atendente cancela e remarca o compromisso
 * de qualquer colega. Desligada, cada atendente mexe só no que é dele.
 *
 * Nenhuma das duas reescreve dado: a regra é lida no ato e desfazer é apertar de novo. O interruptor
 * não é a autorização — quem decide é a função do banco; `podeMudar` só desabilita o controle.
 */

/** A frase de cada recusa. */
const TEXTO_DO_ERRO: Record<ErroAgendaDosColegas, string> = {
  sessao: "Sua sessão expirou. Entre de novo.",
  somente_leitura: "Acompanhamento somente leitura ou encerrado.",
  sem_empresa: "Nenhuma empresa ativa.",
  sem_permissao: "Só um administrador pode mudar essa regra.",
  mfa: "Confirme a verificação em duas etapas.",
  tente_de_novo: "Outra mudança estava em andamento. Tente de novo.",
  falha: "Não consegui salvar essa mudança agora.",
};

type Acao = (ligado: boolean) => Promise<
  { ok: true; ligado: boolean } | { ok: false; erro: ErroAgendaDosColegas }
>;

function Regra({
  titulo,
  explicacao,
  estado,
  ligadoInicial,
  podeMudar,
  acao,
  testId,
}: {
  titulo: string;
  explicacao: string;
  estado: (ligado: boolean) => string;
  ligadoInicial: boolean;
  podeMudar: boolean;
  acao: Acao;
  testId: string;
}) {
  const t = useT();
  const idDoRotulo = useId();
  const [ligado, setLigado] = useState(ligadoInicial);
  const [erro, setErro] = useState<ErroAgendaDosColegas | null>(null);
  const [salvando, iniciar] = useTransition();

  function aplicar(novo: boolean) {
    setErro(null);
    iniciar(async () => {
      const r = await acao(novo);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      // O estado vem do CORPO da action (o valor do banco), nunca de um refresh que perca a corrida.
      setLigado(r.ligado);
    });
  }

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center gap-3">
        <Switch
          checked={ligado}
          onCheckedChange={aplicar}
          disabled={!podeMudar || salvando}
          aria-labelledby={idDoRotulo}
          data-testid={`${testId}-interruptor`}
        />
        <span id={idDoRotulo} className="text-sm font-medium">
          {t(titulo)}
        </span>
      </div>
      <p className="text-sm text-text-muted">{t(explicacao)}</p>
      <p className="text-sm" data-testid={`${testId}-estado`}>
        {t(estado(ligado))}
      </p>
      {erro && (
        <p role="alert" className="text-sm text-destructive" data-testid={`${testId}-erro`}>
          {t(TEXTO_DO_ERRO[erro])}
        </p>
      )}
    </div>
  );
}

export function AgendaDosColegas({
  ligadoInicial,
  verInicial,
  podeMudar,
}: {
  /** "Podem mexer" (migration 0343). */
  ligadoInicial: boolean;
  /** "Podem ver" (migration 0671). */
  verInicial: boolean;
  /** Espelha o piso `admin` das duas funções do banco. Cortesia, não autorização. */
  podeMudar: boolean;
}) {
  const t = useT();
  return (
    <section className="space-y-5 rounded-xl border p-4" data-testid="agenda-dos-colegas-secao">
      <h2 className="font-semibold">{t("Agenda dos colegas")}</h2>

      <Regra
        testId="agenda-dos-colegas-ver"
        titulo="Atendentes podem ver a agenda dos colegas"
        explicacao="Desligado, cada atendente vê só os próprios compromissos — a agenda de cada pessoa fica só dela. Gerentes e administradores continuam vendo a agenda de todos e podem filtrar por atendente."
        estado={(l) =>
          l
            ? "Ligado: todo atendente vê a agenda de todos."
            : "Desligado: cada atendente vê só a própria agenda. Gerentes e administradores veem todas."
        }
        ligadoInicial={verInicial}
        podeMudar={podeMudar}
        acao={definirVerAgendaDosColegas}
      />

      <Regra
        testId="agenda-dos-colegas"
        titulo="Atendentes podem mexer na agenda dos colegas"
        explicacao="Ligado, qualquer atendente cancela e remarca o compromisso de qualquer colega. Desligado, cada atendente mexe só no compromisso de que é o responsável; gerentes e administradores seguem mexendo em tudo."
        estado={(l) =>
          l
            ? "Ligado: qualquer atendente mexe na agenda de qualquer colega."
            : "Desligado: cada atendente mexe só na própria agenda."
        }
        ligadoInicial={ligadoInicial}
        podeMudar={podeMudar}
        acao={definirAgendaDosColegas}
      />

      {!podeMudar && (
        <p className="text-sm text-text-muted">
          {t("Só um administrador pode mudar essas regras.")}
        </p>
      )}
    </section>
  );
}
