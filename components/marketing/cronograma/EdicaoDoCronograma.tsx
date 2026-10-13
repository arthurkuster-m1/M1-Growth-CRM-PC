"use client";

import { useState } from "react";

import { CampoDeMoeda } from "@/components/marketing/CampoDeMoeda";
import { SeletorDeData } from "@/components/marketing/cronograma/SeletorDeData";
import { SeletorDePeriodo } from "@/components/motor/CalendarioDePeriodo";
import { somarDias } from "@/lib/inicio/datas";
import { useT } from "@/hooks/i18n/useT";
import { formatarMoeda, lerNumero } from "@/lib/marketing/calculadora";
import {
  MAXIMO_DA_JANELA,
  MAXIMO_DE_SEMANAS,
  STATUS_DO_ITEM,
  TIPOS_DE_META,
  domingoDaSemana,
  domingoDe,
  domingoDeHoje,
  semanaDaData,
  type CalculoDaMeta,
  type ConfigDoCronograma,
  type DadosDaMeta,
  type FonteDaMeta,
  type ItemDoCronograma,
  type MetaDoCronograma,
  type StatusDoItem,
  type TipoDeMeta,
} from "@/lib/marketing/cronograma";
import type { Periodo } from "@/lib/marketing/periodos";
import { ArrowDown, ArrowUp, Archive, Plus, Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const CAMPO =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20";
const BOTAO_ICONE =
  "grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground";

function Rotulo({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{texto}</span>
      {children}
    </label>
  );
}

function Grupo({
  titulo,
  dica,
  children,
}: {
  titulo: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="grid gap-3 rounded-2xl border bg-card p-4">
      <legend className="px-2 text-sm font-semibold">{titulo}</legend>
      {dica ? <p className="-mt-1 text-xs text-muted-foreground">{dica}</p> : null}
      {children}
    </fieldset>
  );
}

type AcoesDeItem = {
  aoCriarItem: (i: Omit<ItemDoCronograma, "id" | "ordem">) => Promise<unknown>;
  aoEditarItem: (id: string, i: Partial<Omit<ItemDoCronograma, "id">>) => Promise<unknown>;
  aoApagarItem: (id: string) => Promise<unknown>;
  /** A configuração (o domingo da semana 1) e como salvá-la: as ações são escolhidas por DATA. */
  config: ConfigDoCronograma;
  aoSalvarConfig: (c: ConfigDoCronograma) => Promise<unknown>;
};

/** O texto do campo de valor a partir do número guardado, no formato do tipo. */
function textoDoValor(valor: number | null, tipo: TipoDeMeta): string {
  if (valor === null) return "";
  if (tipo === "moeda") return formatarMoeda(String(Math.round(valor * 100)));
  return String(valor).replace(".", ",");
}

/** Um campo de valor da meta: máscara de R$ para moeda, número simples nos outros tipos. */
function CampoDeValor({
  tipo,
  texto,
  aoMudar,
  aoConfirmar,
  rotulo,
  dica,
}: {
  tipo: TipoDeMeta;
  texto: string;
  aoMudar: (texto: string) => void;
  aoConfirmar: (valor: number | null) => void;
  rotulo: string;
  dica?: string;
}) {
  const confirmar = () => aoConfirmar(texto.trim() === "" ? null : lerNumero(texto));
  if (tipo === "moeda") {
    return (
      <span onBlur={confirmar}>
        <CampoDeMoeda
          valor={texto}
          aoMudar={aoMudar}
          ariaLabel={rotulo}
          placeholder={dica ?? "R$ 0,00"}
          className={CAMPO}
        />
      </span>
    );
  }
  return (
    <div className="relative">
      <input
        value={texto}
        inputMode="decimal"
        maxLength={16}
        aria-label={rotulo}
        placeholder={dica ?? "0"}
        onChange={(e) => aoMudar(e.target.value.replace(/[^\d.,-]/g, ""))}
        onBlur={confirmar}
        className={cn(CAMPO, tipo === "percentual" && "pr-8")}
      />
      {tipo === "percentual" ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-muted-foreground">
          %
        </span>
      ) : null}
    </div>
  );
}

function LinhaDeMeta({
  meta,
  aoEditar,
  aoApagar,
}: {
  meta: MetaDoCronograma;
  aoEditar: (patch: Partial<DadosDaMeta>) => Promise<unknown>;
  aoApagar: () => Promise<unknown>;
}) {
  const t = useT();
  const [alvo, setAlvo] = useState(textoDoValor(meta.valor_alvo, meta.tipo));
  const [atual, setAtual] = useState(textoDoValor(meta.valor_atual, meta.tipo));
  const rotuloDoTipo = (tipo: TipoDeMeta) =>
    tipo === "moeda"
      ? t("Dinheiro (R$)")
      : tipo === "percentual"
        ? t("Porcentagem (%)")
        : t("Quantidade");

  return (
    <div className="grid gap-2 rounded-xl bg-secondary/40 p-3">
      <div className="grid gap-2 sm:grid-cols-[1.6fr_1fr_1fr_auto]">
        <input
          defaultValue={meta.titulo}
          aria-label={t("Meta")}
          maxLength={120}
          onBlur={(e) =>
            e.target.value.trim() &&
            e.target.value !== meta.titulo &&
            void aoEditar({ titulo: e.target.value })
          }
          className={CAMPO}
        />
        <select
          value={meta.tipo}
          aria-label={t("Tipo da meta")}
          onChange={(e) => void aoEditar({ tipo: e.target.value as TipoDeMeta })}
          className={CAMPO}
        >
          {TIPOS_DE_META.map((tipo) => (
            <option key={tipo} value={tipo}>
              {rotuloDoTipo(tipo)}
            </option>
          ))}
        </select>
        {meta.tipo === "numero" ? (
          <input
            defaultValue={meta.unidade}
            aria-label={t("Unidade")}
            placeholder={t("Unidade (ex.: leads)")}
            maxLength={20}
            onBlur={(e) =>
              e.target.value !== meta.unidade && void aoEditar({ unidade: e.target.value })
            }
            className={CAMPO}
          />
        ) : (
          <span />
        )}
        <button
          type="button"
          aria-label={t("Apagar meta")}
          onClick={() => void aoApagar()}
          className={cn(BOTAO_ICONE, "hover:text-error-fg")}
        >
          <Trash size={16} aria-hidden />
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Rotulo texto={t("De onde vem o número de hoje")}>
          <select
            value={meta.fonte}
            aria-label={t("De onde vem o número de hoje")}
            onChange={(e) => void aoEditar({ fonte: e.target.value as FonteDaMeta })}
            className={CAMPO}
          >
            <option value="manual">{t("Digitado por mim")}</option>
            <option value="leads">{t("Leads do CRM")}</option>
            <option value="vendas">{t("Vendas fechadas")}</option>
            <option value="faturamento">{t("Faturamento recebido")}</option>
            <option value="a_receber">{t("A receber (comprometido)")}</option>
            <option value="investido">{t("Investimento em anúncios")}</option>
            <option value="cpl">{t("CPL (custo por lead)")}</option>
            <option value="roas">{t("ROAS (retorno sobre o investido)")}</option>
          </select>
        </Rotulo>
        {meta.fonte !== "manual" ? (
          <>
            <Rotulo texto={t("Período")}>
              <select
                value={meta.periodo}
                aria-label={t("Período")}
                onChange={(e) => void aoEditar({ periodo: e.target.value as Periodo })}
                className={CAMPO}
              >
                <option value="hoje">{t("Hoje")}</option>
                <option value="ontem">{t("Ontem")}</option>
                <option value="ultimos_5_dias">{t("Últimos 5 dias")}</option>
                <option value="ultimos_7_dias">{t("Últimos 7 dias")}</option>
                <option value="ultimos_30_dias">{t("Últimos 30 dias")}</option>
                <option value="semana">{t("Esta semana")}</option>
                <option value="mes">{t("Este mês")}</option>
                <option value="mes_passado">{t("Mês passado")}</option>
              </select>
            </Rotulo>
            {meta.fonte !== "cpl" && meta.fonte !== "roas" ? (
              <Rotulo texto={t("Cálculo")}>
                <select
                  value={meta.calculo}
                  aria-label={t("Cálculo")}
                  onChange={(e) => void aoEditar({ calculo: e.target.value as CalculoDaMeta })}
                  className={CAMPO}
                >
                  <option value="soma">{t("Soma do período")}</option>
                  <option value="media_diaria">{t("Média por dia")}</option>
                </select>
              </Rotulo>
            ) : (
              <span />
            )}
          </>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Rotulo texto={t("Onde queremos chegar")}>
          <CampoDeValor
            tipo={meta.tipo}
            texto={alvo}
            aoMudar={setAlvo}
            aoConfirmar={(v) => v !== meta.valor_alvo && void aoEditar({ valor_alvo: v })}
            rotulo={t("Onde queremos chegar")}
          />
        </Rotulo>
        <Rotulo
          texto={
            meta.fonte === "manual"
              ? t("Onde estamos hoje")
              : t("Onde estamos hoje (automático, do CRM)")
          }
        >
          {meta.fonte !== "manual" ? (
            <p className="flex h-10 items-center rounded-xl border border-dashed px-3 text-sm text-muted-foreground tabular-nums">
              {t("Atualiza sozinho — aparece no cronograma")}
            </p>
          ) : (
            <CampoDeValor
              tipo={meta.tipo}
              texto={atual}
              aoMudar={setAtual}
              aoConfirmar={(v) => v !== meta.valor_atual && void aoEditar({ valor_atual: v })}
              rotulo={t("Onde estamos hoje")}
            />
          )}
        </Rotulo>
      </div>
    </div>
  );
}

function NovaMeta({ aoCriar }: { aoCriar: (m: DadosDaMeta) => Promise<unknown> }) {
  const t = useT();
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoDeMeta>("moeda");
  const [unidade, setUnidade] = useState("");
  const [alvo, setAlvo] = useState("");
  const rotuloDoTipo = (v: TipoDeMeta) =>
    v === "moeda"
      ? t("Dinheiro (R$)")
      : v === "percentual"
        ? t("Porcentagem (%)")
        : t("Quantidade");

  return (
    <div className="grid gap-2 rounded-xl border border-dashed p-3">
      <div className="grid gap-2 sm:grid-cols-[1.6fr_1fr_1fr]">
        <input
          value={titulo}
          maxLength={120}
          placeholder={t("Nova meta (ex.: Faturamento mensal)")}
          aria-label={t("Nova meta")}
          onChange={(e) => setTitulo(e.target.value)}
          className={CAMPO}
        />
        <select
          value={tipo}
          aria-label={t("Tipo da meta")}
          onChange={(e) => {
            setTipo(e.target.value as TipoDeMeta);
            setAlvo("");
          }}
          className={CAMPO}
        >
          {TIPOS_DE_META.map((v) => (
            <option key={v} value={v}>
              {rotuloDoTipo(v)}
            </option>
          ))}
        </select>
        {tipo === "numero" ? (
          <input
            value={unidade}
            maxLength={20}
            aria-label={t("Unidade")}
            placeholder={t("Unidade (ex.: leads)")}
            onChange={(e) => setUnidade(e.target.value)}
            className={CAMPO}
          />
        ) : (
          <span />
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Rotulo texto={t("Onde queremos chegar")}>
          <CampoDeValor
            tipo={tipo}
            texto={alvo}
            aoMudar={setAlvo}
            aoConfirmar={() => undefined}
            rotulo={t("Onde queremos chegar")}
          />
        </Rotulo>
        <button
          type="button"
          disabled={titulo.trim() === ""}
          onClick={async () => {
            await aoCriar({
              titulo,
              tipo,
              unidade: tipo === "numero" ? unidade : "",
              valor_alvo: alvo.trim() === "" ? null : lerNumero(alvo),
              valor_atual: null,
              fonte: "manual" as const,
              periodo: "mes" as const,
              calculo: "soma" as const,
              descricao: "",
            });
            setTitulo("");
            setAlvo("");
          }}
          className="inline-flex h-10 items-center gap-1.5 self-end rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Plus size={14} weight="bold" aria-hidden />
          {t("Adicionar")}
        </button>
      </div>
    </div>
  );
}

function LinhaDeAcao({
  item,
  fases,
  acoes,
  aoMover,
}: {
  item: ItemDoCronograma;
  fases: string[];
  acoes: AcoesDeItem;
  /** Subir/descer dentro da fase; `undefined` = já está na ponta. */
  aoMover: { subir?: () => void; descer?: () => void };
}) {
  const t = useT();
  const rotuloDoStatus = (s: StatusDoItem) =>
    s === "planejado" ? t("Planejado") : s === "andamento" ? t("Em andamento") : t("Concluído");
  return (
    <div className="grid gap-2 rounded-xl border bg-background p-3">
      <input
        defaultValue={item.acao}
        aria-label={t("Ação")}
        maxLength={200}
        onBlur={(e) =>
          e.target.value.trim() &&
          e.target.value !== item.acao &&
          void acoes.aoEditarItem(item.id, { acao: e.target.value })
        }
        className={CAMPO}
      />
      <PeriodoDaAcao
        inicio={item.semana_inicio}
        fim={item.semana_fim}
        config={acoes.config}
        aoSalvarConfig={acoes.aoSalvarConfig}
        aoMudar={(s) =>
          void acoes.aoEditarItem(item.id, { semana_inicio: s.inicio, semana_fim: s.fim })
        }
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.2fr_1.2fr_auto_auto_auto_auto_auto]">
        <select
          value={item.status}
          aria-label={t("Situação")}
          onChange={(e) =>
            void acoes.aoEditarItem(item.id, { status: e.target.value as StatusDoItem })
          }
          className={CAMPO}
        >
          {STATUS_DO_ITEM.map((s) => (
            <option key={s} value={s}>
              {rotuloDoStatus(s)}
            </option>
          ))}
        </select>
        <select
          value={item.fase}
          aria-label={t("Fase")}
          onChange={(e) => void acoes.aoEditarItem(item.id, { fase: e.target.value })}
          className={CAMPO}
        >
          <option value="">{t("Sem fase")}</option>
          {fases.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={item.destaque}
            onChange={(e) => void acoes.aoEditarItem(item.id, { destaque: e.target.checked })}
          />
          {t("Destacar")}
        </label>
        <div className="flex items-center">
          <button
            type="button"
            aria-label={t("Subir ação")}
            title={t("Subir")}
            disabled={!aoMover.subir}
            onClick={aoMover.subir}
            className={cn(BOTAO_ICONE, "disabled:opacity-30")}
          >
            <ArrowUp size={16} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t("Descer ação")}
            title={t("Descer")}
            disabled={!aoMover.descer}
            onClick={aoMover.descer}
            className={cn(BOTAO_ICONE, "disabled:opacity-30")}
          >
            <ArrowDown size={16} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          aria-label={t("Arquivar ação")}
          disabled={item.status !== "concluido"}
          title={
            item.status === "concluido"
              ? t("Tirar do gráfico (fica guardada)")
              : t("Só ações concluídas podem ser arquivadas")
          }
          onClick={() => void acoes.aoEditarItem(item.id, { arquivado: true })}
          className={cn(BOTAO_ICONE, "disabled:opacity-30")}
        >
          <Archive size={16} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={t("Apagar ação")}
          onClick={() => void acoes.aoApagarItem(item.id)}
          className={cn(BOTAO_ICONE, "hover:text-error-fg")}
        >
          <Trash size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/**
 * O PERÍODO de uma ação-chave, escolhido por DATA (seletor de período). O sistema calcula sozinho
 * em que semana do projeto cada ponta cai ("Semana 3 a 5"). Sem o domingo da semana 1 definido, a
 * primeira data escolhida vira o início do projeto.
 */
function PeriodoDaAcao({
  inicio,
  fim,
  config,
  aoSalvarConfig,
  aoMudar,
}: {
  inicio: number;
  fim: number;
  config: ConfigDoCronograma;
  aoSalvarConfig: (c: ConfigDoCronograma) => Promise<unknown>;
  aoMudar: (semanas: { inicio: number; fim: number }) => void;
}) {
  const t = useT();
  const hoje = domingoDeHoje();
  const de = config.data_inicio ? domingoDaSemana(config.data_inicio, inicio) : hoje;
  const ate = somarDias(config.data_inicio ? domingoDaSemana(config.data_inicio, fim) : hoje, 6);
  return (
    <div className="grid gap-1">
      <SeletorDePeriodo
        de={de}
        ate={ate}
        rotulo={t("Período da ação")}
        aoMudar={async (p) => {
          let cfg = config;
          if (!cfg.data_inicio) {
            // A primeira data escolhida define a semana 1 do projeto.
            cfg = { ...cfg, data_inicio: domingoDe(p.de) };
            await aoSalvarConfig(cfg);
          }
          const a = semanaDaData(cfg, p.de) ?? 1;
          const b = Math.max(a, semanaDaData(cfg, p.ate) ?? a);
          aoMudar({ inicio: a, fim: b });
        }}
      />
      <p className="text-xs text-muted-foreground">
        {config.data_inicio
          ? inicio === fim
            ? `${t("Semana")} ${inicio}`
            : `${t("Semanas")} ${inicio} ${t("a")} ${fim}`
          : t("A primeira data escolhida define a semana 1 do projeto.")}
      </p>
    </div>
  );
}

/** Número de semana digitado: aceita o campo vazio enquanto a pessoa escreve. */
function semanaDoTexto(texto: string, padrao: number): number {
  const n = Math.floor(Number(texto));
  return Number.isFinite(n) && n >= 1 ? Math.min(MAXIMO_DE_SEMANAS, n) : padrao;
}

function NovaAcao({
  fase,
  semanaSugerida,
  aoCriar,
  config,
  aoSalvarConfig,
}: {
  fase: string;
  semanaSugerida: number;
  aoCriar: AcoesDeItem["aoCriarItem"];
  config: ConfigDoCronograma;
  aoSalvarConfig: (c: ConfigDoCronograma) => Promise<unknown>;
}) {
  const t = useT();
  const [acao, setAcao] = useState("");
  const [semanas, setSemanas] = useState({ inicio: semanaSugerida, fim: semanaSugerida });
  return (
    <div className="grid gap-2 rounded-xl border border-dashed p-3 sm:grid-cols-[2fr_1.4fr_auto]">
      <input
        value={acao}
        maxLength={200}
        placeholder={t("Nova ação-chave")}
        aria-label={t("Nova ação-chave")}
        onChange={(e) => setAcao(e.target.value)}
        className={CAMPO}
      />
      <PeriodoDaAcao
        inicio={semanas.inicio}
        fim={semanas.fim}
        config={config}
        aoSalvarConfig={aoSalvarConfig}
        aoMudar={setSemanas}
      />
      <button
        type="button"
        disabled={acao.trim() === ""}
        onClick={async () => {
          await aoCriar({
            acao,
            fase,
            semana_inicio: semanas.inicio,
            semana_fim: Math.max(semanas.inicio, semanas.fim),
            status: "planejado",
            destaque: false,
            notas: "",
            arquivado: false,
          });
          setAcao("");
        }}
        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium whitespace-nowrap text-primary-foreground disabled:opacity-50"
      >
        <Plus size={14} weight="bold" aria-hidden />
        {t("Adicionar")}
      </button>
    </div>
  );
}

function CartaoDeFase({
  nome,
  itens,
  fases,
  acoes,
  aoRenomear,
  aoMoverFase,
  aoMoverItem,
}: {
  nome: string;
  itens: ItemDoCronograma[];
  fases: string[];
  acoes: AcoesDeItem;
  aoRenomear: (de: string, para: string) => void;
  /** Subir/descer a fase inteira; `undefined` = já está na ponta (ou é "sem fase"). */
  aoMoverFase?: { subir?: () => void; descer?: () => void };
  aoMoverItem: (id: string, direcao: -1 | 1) => void;
}) {
  const t = useT();
  const concluidas = itens.filter((i) => i.status === "concluido");
  const sugerida = itens.length ? Math.max(...itens.map((i) => i.semana_fim)) : 1;
  return (
    <div className="grid gap-3 rounded-2xl border bg-secondary/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {nome ? (
          <input
            defaultValue={nome}
            aria-label={t("Nome da fase")}
            maxLength={80}
            onBlur={(e) => {
              const novo = e.target.value.trim();
              if (novo && novo !== nome) aoRenomear(nome, novo);
              else e.target.value = nome;
            }}
            className={cn(CAMPO, "max-w-xs font-semibold")}
          />
        ) : (
          <span className="px-1 text-sm font-semibold">{t("Sem fase")}</span>
        )}
        {aoMoverFase ? (
          <span className="inline-flex items-center">
            <button
              type="button"
              aria-label={t("Subir fase")}
              title={t("Subir fase")}
              disabled={!aoMoverFase.subir}
              onClick={aoMoverFase.subir}
              className={cn(BOTAO_ICONE, "disabled:opacity-30")}
            >
              <ArrowUp size={16} aria-hidden />
            </button>
            <button
              type="button"
              aria-label={t("Descer fase")}
              title={t("Descer fase")}
              disabled={!aoMoverFase.descer}
              onClick={aoMoverFase.descer}
              className={cn(BOTAO_ICONE, "disabled:opacity-30")}
            >
              <ArrowDown size={16} aria-hidden />
            </button>
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {concluidas.length}/{itens.length} {t("concluídas")}
        </span>
        {concluidas.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              for (const i of concluidas) void acoes.aoEditarItem(i.id, { arquivado: true });
            }}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium hover:bg-secondary"
          >
            <Archive size={14} aria-hidden />
            {t("Arquivar concluídas")}
          </button>
        ) : null}
      </div>
      {itens.map((i, k) => (
        <LinhaDeAcao
          key={i.id}
          item={i}
          fases={fases}
          acoes={acoes}
          aoMover={{
            subir: k > 0 ? () => aoMoverItem(i.id, -1) : undefined,
            descer: k < itens.length - 1 ? () => aoMoverItem(i.id, 1) : undefined,
          }}
        />
      ))}
      <NovaAcao
        fase={nome}
        semanaSugerida={sugerida}
        aoCriar={acoes.aoCriarItem}
        config={acoes.config}
        aoSalvarConfig={acoes.aoSalvarConfig}
      />
    </div>
  );
}

/** Edição das METAS, das FASES com suas AÇÕES-CHAVE e da configuração do cronograma geral. */
export function EdicaoDoCronograma({
  config,
  itens,
  metas,
  aoSalvarConfig,
  aoCriarItem,
  aoEditarItem,
  aoApagarItem,
  aoCriarMeta,
  aoEditarMeta,
  aoApagarMeta,
}: {
  config: ConfigDoCronograma;
  itens: ItemDoCronograma[];
  metas: MetaDoCronograma[];
  aoSalvarConfig: (c: ConfigDoCronograma) => Promise<unknown>;
  aoCriarItem: AcoesDeItem["aoCriarItem"];
  aoEditarItem: AcoesDeItem["aoEditarItem"];
  aoApagarItem: AcoesDeItem["aoApagarItem"];
  aoCriarMeta: (m: DadosDaMeta) => Promise<unknown>;
  aoEditarMeta: (id: string, m: Partial<DadosDaMeta>) => Promise<unknown>;
  aoApagarMeta: (id: string) => Promise<unknown>;
}) {
  const t = useT();
  const [cfg, setCfg] = useState(config);
  const [janelaTxt, setJanelaTxt] = useState(String(config.total_semanas));
  const [fasesVazias, setFasesVazias] = useState<string[]>([]);
  const [novaFase, setNovaFase] = useState("");
  const [verArquivadas, setVerArquivadas] = useState(false);
  const acoes: AcoesDeItem = {
    aoCriarItem,
    aoEditarItem,
    aoApagarItem,
    config,
    aoSalvarConfig,
  };

  const ativos = itens.filter((i) => !i.arquivado);
  const arquivados = itens.filter((i) => i.arquivado);
  const nomesDeFase: string[] = [];
  for (const i of ativos) {
    const n = i.fase.trim();
    if (n && !nomesDeFase.includes(n)) nomesDeFase.push(n);
  }
  for (const n of fasesVazias) if (!nomesDeFase.includes(n)) nomesDeFase.push(n);
  const semFase = ativos.filter((i) => i.fase.trim() === "");

  // ── Ordem: subir/descer ação dentro da fase e fase inteira (sem apagar e recriar) ──
  const naOrdem = (lista: ItemDoCronograma[]) => [...lista].sort((a, b) => a.ordem - b.ordem);
  /** Regrava `ordem` (10, 20, 30…) só dos itens que mudaram de posição. */
  const gravarOrdem = (lista: ItemDoCronograma[]) => {
    lista.forEach((i, k) => {
      const ordem = (k + 1) * 10;
      if (i.ordem !== ordem) void aoEditarItem(i.id, { ordem });
    });
  };
  /** Todas as ações ativas na ordem das fases na tela, e dentro de cada fase pela `ordem`. */
  const ordemGeral = (fases: string[]) => [
    ...fases.flatMap((n) => naOrdem(ativos.filter((i) => i.fase.trim() === n))),
    ...naOrdem(semFase),
  ];
  const moverItem = (id: string, direcao: -1 | 1) => {
    const alvo = ativos.find((i) => i.id === id);
    if (!alvo) return;
    const dela = naOrdem(ativos.filter((i) => i.fase.trim() === alvo.fase.trim()));
    const k = dela.findIndex((i) => i.id === id);
    const j = k + direcao;
    if (k < 0 || j < 0 || j >= dela.length) return;
    [dela[k], dela[j]] = [dela[j]!, dela[k]!];
    const fases = nomesDeFase;
    const resto = ordemGeral(fases).filter((i) => i.fase.trim() !== alvo.fase.trim());
    // Reconstrói mantendo a posição da fase: troca só dentro dela.
    const montada: ItemDoCronograma[] = [];
    for (const n of [...fases, ""]) {
      if (n === alvo.fase.trim()) montada.push(...dela);
      else montada.push(...resto.filter((i) => i.fase.trim() === n));
    }
    gravarOrdem(montada);
  };
  const moverFase = (nome: string, direcao: -1 | 1) => {
    const k = nomesDeFase.indexOf(nome);
    const j = k + direcao;
    if (k < 0 || j < 0 || j >= nomesDeFase.length) return;
    const novas = [...nomesDeFase];
    [novas[k], novas[j]] = [novas[j]!, novas[k]!];
    setFasesVazias((f) => novas.filter((n) => f.includes(n)));
    gravarOrdem(ordemGeral(novas));
  };

  const renomear = (de: string, para: string) => {
    for (const i of ativos.filter((x) => x.fase.trim() === de)) {
      void aoEditarItem(i.id, { fase: para });
    }
    setFasesVazias((f) => f.map((n) => (n === de ? para : n)));
  };
  const adicionarFase = () => {
    const nome = novaFase.trim();
    if (!nome || nomesDeFase.includes(nome)) return;
    setFasesVazias((f) => [...f, nome]);
    setNovaFase("");
  };

  return (
    <div className="grid gap-4">
      <Grupo
        titulo={t("Metas (o topo da página)")}
        dica={t("Escolha o tipo: o valor é formatado e a barra de progresso é calculada sozinha.")}
      >
        {metas.map((m) => (
          <LinhaDeMeta
            key={`${m.id}-${m.tipo}`}
            meta={m}
            aoEditar={(patch) => aoEditarMeta(m.id, patch)}
            aoApagar={() => aoApagarMeta(m.id)}
          />
        ))}
        <NovaMeta aoCriar={aoCriarMeta} />
      </Grupo>

      <Grupo
        titulo={t("Fases e ações-chave")}
        dica={t(
          "Cada fase reúne várias ações-chave. Escolha o período por data: o sistema mostra em que semana do projeto ele cai. Use as setas para reordenar fases e ações.",
        )}
      >
        {nomesDeFase.map((nome, k) => (
          <CartaoDeFase
            key={nome}
            nome={nome}
            itens={naOrdem(ativos.filter((i) => i.fase.trim() === nome))}
            fases={nomesDeFase}
            acoes={acoes}
            aoRenomear={renomear}
            aoMoverFase={{
              subir: k > 0 ? () => moverFase(nome, -1) : undefined,
              descer: k < nomesDeFase.length - 1 ? () => moverFase(nome, 1) : undefined,
            }}
            aoMoverItem={moverItem}
          />
        ))}
        {semFase.length > 0 ? (
          <CartaoDeFase
            nome=""
            itens={naOrdem(semFase)}
            fases={nomesDeFase}
            acoes={acoes}
            aoRenomear={renomear}
            aoMoverItem={moverItem}
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3">
          <input
            value={novaFase}
            maxLength={80}
            placeholder={t("Nova fase (ex.: Estruturação)")}
            aria-label={t("Nova fase")}
            onChange={(e) => setNovaFase(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionarFase()}
            className={cn(CAMPO, "max-w-sm")}
          />
          <button
            type="button"
            disabled={novaFase.trim() === ""}
            onClick={adicionarFase}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium whitespace-nowrap text-primary-foreground disabled:opacity-50"
          >
            <Plus size={14} weight="bold" aria-hidden />
            {t("Adicionar fase")}
          </button>
        </div>

        {arquivados.length > 0 ? (
          <div className="grid gap-2">
            <button
              type="button"
              aria-expanded={verArquivadas}
              onClick={() => setVerArquivadas((v) => !v)}
              className="w-fit text-sm font-medium text-primary hover:underline"
            >
              {verArquivadas
                ? t("Esconder arquivadas")
                : `${t("Ver arquivadas")} (${arquivados.length})`}
            </button>
            {verArquivadas
              ? arquivados.map((i) => (
                  <div
                    key={i.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary/40 p-3 text-sm"
                  >
                    <span className="min-w-0 flex-1">
                      {i.fase ? <span className="text-muted-foreground">{i.fase} · </span> : null}
                      {i.acao}
                    </span>
                    <button
                      type="button"
                      onClick={() => void aoEditarItem(i.id, { arquivado: false })}
                      className="h-9 rounded-xl border px-3 text-sm font-medium hover:bg-secondary"
                    >
                      {t("Desarquivar")}
                    </button>
                    <button
                      type="button"
                      aria-label={t("Apagar ação")}
                      onClick={() => void aoApagarItem(i.id)}
                      className={cn(BOTAO_ICONE, "hover:text-error-fg")}
                    >
                      <Trash size={16} aria-hidden />
                    </button>
                  </div>
                ))
              : null}
          </div>
        ) : null}
      </Grupo>

      <Grupo titulo={t("Configuração")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Rotulo texto={t("Quantas semanas aparecem na tela")}>
            <input
              inputMode="numeric"
              value={janelaTxt}
              onChange={(e) => setJanelaTxt(e.target.value.replace(/\D/g, "").slice(0, 2))}
              className={CAMPO}
            />
          </Rotulo>
          <Rotulo texto={t("Domingo da semana 1")}>
            <SeletorDeData
              valor={cfg.data_inicio ?? ""}
              rotulo={t("Domingo da semana 1")}
              aoMudar={(d) => setCfg({ ...cfg, data_inicio: d ? domingoDe(d) : null })}
            />
          </Rotulo>
          <Rotulo texto={t("Frase do cronograma geral")}>
            <input
              value={cfg.subtitulo_geral}
              maxLength={200}
              onChange={(e) => setCfg({ ...cfg, subtitulo_geral: e.target.value })}
              className={CAMPO}
            />
          </Rotulo>
          <Rotulo texto={t("Frase das tarefas da semana")}>
            <input
              value={cfg.subtitulo_semana}
              maxLength={200}
              onChange={(e) => setCfg({ ...cfg, subtitulo_semana: e.target.value })}
              className={CAMPO}
            />
          </Rotulo>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("O cronograma não tem fim: arraste as semanas para o lado para ver as próximas.")}
        </p>
        <button
          type="button"
          onClick={() => {
            const n = Math.min(
              MAXIMO_DA_JANELA,
              Math.max(1, Number(janelaTxt) || cfg.total_semanas),
            );
            setJanelaTxt(String(n));
            void aoSalvarConfig({ ...cfg, total_semanas: n });
          }}
          className="h-10 w-fit rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {t("Salvar configuração")}
        </button>
      </Grupo>
    </div>
  );
}
