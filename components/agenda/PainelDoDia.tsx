"use client";

import Link from "next/link";
import * as React from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDetalhesDosCompromissos } from "@/hooks/agenda/useDetalhesDosCompromissos";
import { useT } from "@/hooks/i18n/useT";
import { ROTULO_DA_SITUACAO } from "@/lib/agenda/tipos";
import {
  PROPRIEDADES_DO_COMPROMISSO,
  PROPRIEDADES_PADRAO,
  ROTULO_DA_CATEGORIA,
  ROTULO_DA_VENDA_NA_AGENDA,
  ROTULO_DO_LINK,
  ROTULO_DO_LOCAL,
  precisaDeDetalhe,
  propriedadesValidas,
  type DetalheDoCompromisso,
  type IdDePropriedade,
} from "@/lib/agenda/propriedades-do-compromisso";
import { formatCents } from "@/lib/money";
import { Gear } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

import { corDaTrilha, fundoDaTrilha } from "./paleta";
import type { Agendamento, Pessoa } from "./tipos";

const CHAVE = "m1.agenda.propriedades";

/** A escolha de propriedades fica neste navegador (o calendário das Tarefas guarda na visualização). */
function usePropriedades(): [IdDePropriedade[], (x: IdDePropriedade[]) => void] {
  const [ids, setIds] = React.useState<IdDePropriedade[]>([...PROPRIEDADES_PADRAO]);
  React.useEffect(() => {
    try {
      const bruto = window.localStorage.getItem(CHAVE);
      if (bruto) setIds(propriedadesValidas(JSON.parse(bruto)));
    } catch {
      /* sem armazenamento: segue com o padrão */
    }
  }, []);
  const gravar = (novo: IdDePropriedade[]) => {
    setIds(novo);
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(novo));
    } catch {
      /* o navegador pode bloquear: vale só nesta sessão */
    }
  };
  return [ids, gravar];
}

const COR_DA_SITUACAO: Record<string, string> = {
  pending: "border-yellow-500/70 bg-yellow-500/10 text-yellow-800 dark:text-yellow-300",
  confirmed: "border-blue-500/60 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  completed: "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-300",
  no_show: "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300",
  cancelled: "border-gray-400/70 bg-gray-500/10 text-muted-foreground",
};
const COR_DA_VENDA: Record<string, string> = {
  interesse: "border-blue-500/60 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  comprometida: "border-yellow-500/70 bg-yellow-500/10 text-yellow-800 dark:text-yellow-300",
  concluida: "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-300",
  cancelada: "border-gray-400/70 bg-gray-500/10 text-muted-foreground",
};

function Etiqueta({ children, classe }: { children: React.ReactNode; classe?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        classe ?? "border-border bg-secondary/60 text-foreground",
      )}
    >
      {children}
    </span>
  );
}

const hora = (iso: string, fuso: string, tag: string) =>
  new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", timeZone: fuso }).format(
    new Date(iso),
  );
const diaHora = (iso: string, fuso: string, tag: string) =>
  new Intl.DateTimeFormat(tag, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: fuso,
  }).format(new Date(iso));

/**
 * O PAINEL DO DIA, igual ao do calendário das Tarefas: tocou no dia, os compromissos dele
 * aparecem embaixo, cada um com as propriedades que a pessoa escolheu.
 */
type PropsDoPainel = {
  rotuloDoDia: string;
  chaveDoDia: string;
  compromissos: Agendamento[];
  pessoas: Pessoa[];
  fuso: string;
  tag: string;
  onAbrir?: (id: string) => void;
  onNovo?: () => void;
};

export function PainelDoDia(props: PropsDoPainel) {
  const [escolhidas, gravar] = usePropriedades();
  // A busca dos detalhes mora num filho: o gancho de consulta só existe quando alguma propriedade
  // que dependa dela foi escolhida (o padrão não depende de nada).
  return precisaDeDetalhe(escolhidas) ? (
    <PainelComDetalhes {...props} escolhidas={escolhidas} gravar={gravar} />
  ) : (
    <PainelVisual {...props} escolhidas={escolhidas} gravar={gravar} />
  );
}

type PropsComEscolha = PropsDoPainel & {
  escolhidas: IdDePropriedade[];
  gravar: (x: IdDePropriedade[]) => void;
};

function PainelComDetalhes(props: PropsComEscolha) {
  const nossos = props.compromissos.filter((c) => c.origem !== "google_sync");
  const consulta = useDetalhesDosCompromissos(
    nossos.map((c) => c.id),
    true,
  );
  return <PainelVisual {...props} detalhes={consulta.data} carregando={consulta.isLoading} />;
}

function PainelVisual({
  escolhidas,
  gravar,
  detalhes,
  carregando = false,
  rotuloDoDia,
  chaveDoDia,
  compromissos,
  pessoas,
  fuso,
  tag,
  onAbrir,
  onNovo,
}: PropsComEscolha & {
  detalhes?: Map<string, DetalheDoCompromisso>;
  carregando?: boolean;
}) {
  const t = useT();
  const tem = (id: IdDePropriedade) => escolhidas.includes(id);
  const alternar = (id: IdDePropriedade) =>
    gravar(
      PROPRIEDADES_DO_COMPROMISSO.map((p) => p.id).filter((x) => (x === id ? !tem(id) : tem(x))),
    );

  return (
    <section
      data-testid="painel-do-dia"
      data-dia={chaveDoDia}
      aria-label={rotuloDoDia}
      className="m-2 rounded-2xl border border-border bg-surface p-3"
    >
      <div className="mb-2 flex flex-col gap-1">
        <h3 className="truncate text-sm font-semibold whitespace-nowrap capitalize">
          {rotuloDoDia}
        </h3>
        <div className="flex items-center justify-between gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-testid="escolher-propriedades"
                className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium whitespace-nowrap text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Gear size={13} aria-hidden />
                {t("Propriedades")}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-80 w-64 overflow-y-auto p-1.5">
              {PROPRIEDADES_DO_COMPROMISSO.map((p) => (
                <label
                  key={p.id}
                  className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-secondary"
                >
                  <input type="checkbox" checked={tem(p.id)} onChange={() => alternar(p.id)} />
                  {t(p.rotulo)}
                </label>
              ))}
            </PopoverContent>
          </Popover>
          {onNovo ? (
            <button
              type="button"
              onClick={onNovo}
              data-testid="novo-no-dia"
              className="h-7 rounded-lg px-2.5 text-xs font-medium whitespace-nowrap text-primary hover:bg-secondary"
            >
              {t("Novo agendamento")}
            </button>
          ) : null}
        </div>
      </div>

      {compromissos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("Nenhum compromisso neste dia.")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {compromissos.map((c) => {
            const trilha = pessoas.find((p) => p.id === c.responsavelId)?.trilha ?? 1;
            const abre = onAbrir !== undefined && c.origem !== "google_sync";
            const d = detalhes?.get(c.id);
            return (
              <li key={c.id} data-testid={`item-do-dia-${c.id}`}>
                <button
                  type="button"
                  disabled={!abre}
                  onClick={() => onAbrir?.(c.id)}
                  style={{ background: fundoDaTrilha(trilha, 22) }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium [overflow-wrap:anywhere]"
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: corDaTrilha(trilha) }}
                  />
                  <span className="shrink-0 tabular-nums">{hora(c.comeca, fuso, tag)}</span>
                  <span className="min-w-0">{c.titulo}</span>
                </button>
                {c.origem === "google_sync" ? null : (
                  <div className="mt-1 flex flex-col gap-1 px-1 text-xs">
                    <Propriedades
                      c={c}
                      d={d}
                      carregando={carregando}
                      escolhidas={escolhidas}
                      pessoas={pessoas}
                      fuso={fuso}
                      tag={tag}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

function Propriedades({
  c,
  d,
  carregando,
  escolhidas,
  pessoas,
  fuso,
  tag,
}: {
  c: Agendamento;
  d: DetalheDoCompromisso | undefined;
  carregando: boolean;
  escolhidas: IdDePropriedade[];
  pessoas: Pessoa[];
  fuso: string;
  tag: string;
}) {
  const t = useT();
  const tem = (id: IdDePropriedade) => escolhidas.includes(id);
  const vazio = <span className="text-muted-foreground">—</span>;
  const duracao = Math.round((Date.parse(c.termina) - Date.parse(c.comeca)) / 60_000);
  const botao =
    "inline-flex h-7 items-center rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap hover:bg-secondary";
  const linhas: React.ReactNode[] = [];
  const add = (id: IdDePropriedade, rotulo: string, conteudo: React.ReactNode) => {
    if (tem(id))
      linhas.push(
        <Linha key={id} rotulo={t(rotulo)}>
          {conteudo}
        </Linha>,
      );
  };

  add(
    "data",
    "Data",
    new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeZone: fuso }).format(
      new Date(c.comeca),
    ),
  );
  add(
    "horario",
    "Horário",
    `${hora(c.comeca, fuso, tag)} – ${hora(c.termina, fuso, tag)} · ${duracao} min`,
  );
  add(
    "status",
    "Status",
    <Etiqueta classe={COR_DA_SITUACAO[c.situacao]}>
      {t(ROTULO_DA_SITUACAO[c.situacao] ?? c.situacao)}
    </Etiqueta>,
  );
  add("responsavel", "Responsável", pessoas.find((p) => p.id === c.responsavelId)?.nome ?? vazio);
  add("cliente", "Cliente", c.quemSeraAtendido ?? vazio);

  // As propriedades que dependem da busca: enquanto ela não volta, uma linha só diz isso.
  const pedeDetalhe = PROPRIEDADES_DO_COMPROMISSO.some((p) => p.detalhe && tem(p.id));
  if (pedeDetalhe && !d) {
    linhas.push(
      <span key="aguarde" className="text-muted-foreground">
        {carregando ? t("Carregando propriedades…") : t("Propriedades indisponíveis.")}
      </span>,
    );
  } else if (d) {
    add(
      "tipo",
      "Tipo",
      d.tipo ? (
        <Etiqueta>
          {d.tipo.cor ? (
            <span
              aria-hidden
              className="mr-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: d.tipo.cor }}
            />
          ) : null}
          {d.tipo.nome}
        </Etiqueta>
      ) : (
        vazio
      ),
    );
    add(
      "categoria",
      "Categoria",
      d.tipo ? (
        <Etiqueta>{t(ROTULO_DA_CATEGORIA[d.tipo.categoria] ?? d.tipo.categoria)}</Etiqueta>
      ) : (
        vazio
      ),
    );
    add("observacoes", "Observações", d.observacoes ?? vazio);
    add(
      "link_reuniao",
      "Reunião",
      d.link_reuniao ? (
        <a href={d.link_reuniao} target="_blank" rel="noopener noreferrer" className={botao}>
          {t("Abrir link")}
        </a>
      ) : (
        vazio
      ),
    );
    add(
      "tipo_de_local",
      "Local",
      d.tipo_de_local ? t(ROTULO_DO_LOCAL[d.tipo_de_local] ?? d.tipo_de_local) : vazio,
    );
    add("local", "Endereço", d.local ?? vazio);
    add(
      "status_do_link",
      "Status do link",
      d.status_do_link ? (
        <Etiqueta>{t(ROTULO_DO_LINK[d.status_do_link] ?? d.status_do_link)}</Etiqueta>
      ) : (
        vazio
      ),
    );
    add(
      "ligar",
      "Telefone",
      d.telefone ? (
        <a href={`tel:${d.telefone}`} className={botao}>
          {t("Ligar")}
        </a>
      ) : (
        vazio
      ),
    );
    add("email", "E-mail", d.email ?? vazio);
    add(
      "conversa",
      "Conversa",
      d.conversa_id ? (
        <Link href={`/app/inbox?id=${d.conversa_id}`} className={botao}>
          {t("Abrir no Inbox")}
        </Link>
      ) : (
        vazio
      ),
    );
    add("funil", "Funil", d.funil ?? vazio);
    add("status_do_funil", "Status do funil", d.etapa ? <Etiqueta>{d.etapa}</Etiqueta> : vazio);
    add(
      "status_da_venda",
      "Status da venda",
      d.venda ? (
        <Etiqueta classe={COR_DA_VENDA[d.venda.status]}>
          {t(ROTULO_DA_VENDA_NA_AGENDA[d.venda.status] ?? d.venda.status)}
        </Etiqueta>
      ) : (
        vazio
      ),
    );
    add("valor", "Valor", d.venda ? formatCents(d.venda.valor_cents, d.venda.moeda) : vazio);
    add(
      "resultado",
      "Resultado",
      c.situacao === "completed" || c.situacao === "no_show" ? (
        <>
          {c.situacao === "completed" ? t("Compareceu") : t("Faltou")}
          {d.resultado_registrado_em ? ` · ${diaHora(d.resultado_registrado_em, fuso, tag)}` : ""}
        </>
      ) : (
        vazio
      ),
    );
    add(
      "cancelamento",
      "Cancelamento",
      d.cancelado_em ? (
        <>
          {diaHora(d.cancelado_em, fuso, tag)}
          {d.motivo_do_cancelamento ? ` · ${d.motivo_do_cancelamento}` : ""}
        </>
      ) : (
        vazio
      ),
    );
    add(
      "remarcado_de",
      "Remarcado de",
      d.remarcado_de ? diaHora(d.remarcado_de, fuso, tag) : vazio,
    );
    add(
      "lembrete",
      "Lembrete",
      d.lembrete_enviado_em
        ? `${t("Enviado")} · ${diaHora(d.lembrete_enviado_em, fuso, tag)}`
        : t("Não enviado"),
    );
    add(
      "google",
      "Google",
      d.google_erro ? (
        <Etiqueta classe={COR_DA_SITUACAO.no_show}>{t("Erro na sincronização")}</Etiqueta>
      ) : d.google_sincronizado_em ? (
        `${t("Sincronizado")} · ${diaHora(d.google_sincronizado_em, fuso, tag)}`
      ) : (
        t("Não sincronizado")
      ),
    );
  }

  return <>{linhas}</>;
}
