"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  BOTAO_ICONE,
  CAMPO,
  CampoDeValor,
  PeriodoDaAcao,
  Rotulo,
  textoDoValor,
} from "@/components/marketing/cronograma/EdicaoDoCronograma";
import { SeletorDeData } from "@/components/marketing/cronograma/SeletorDeData";
import { SeletorDePeriodo } from "@/components/motor/CalendarioDePeriodo";
import { CaixaRedonda } from "@/components/ui/CaixaRedonda";
import { SelectDoApp } from "@/components/ui/SelectDoApp";
import { useT } from "@/hooks/i18n/useT";
import type { useEdicaoDoCronograma } from "@/hooks/marketing/useEdicaoDoCronograma";
import { chaveDoDia } from "@/lib/inicio/datas";
import {
  FONTES_DA_META,
  FUSO_DO_CRONOGRAMA,
  MAXIMO_DA_JANELA,
  STATUS_DO_ITEM,
  TIPOS_DE_META,
  domingoDe,
  type CalculoDaMeta,
  type ConfigDoCronograma,
  type FonteDaMeta,
  type ItemDoCronograma,
  type MetaDoCronograma,
  type StatusDoItem,
  type TipoDeMeta,
} from "@/lib/marketing/cronograma";
import { moverAcao, moverFase, naOrdem, nomesDasFases } from "@/lib/marketing/cronograma-ordem";
import type { Periodo } from "@/lib/marketing/periodos";
import { ArrowDown, ArrowUp, Archive, Plus, Trash, X } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/** O que a gaveta mostra: uma meta, uma ação, uma fase, a configuração ou as arquivadas. */
export type VistaDaGaveta =
  | { tipo: "meta" | "acao"; id: string }
  | { tipo: "fase"; nome: string }
  | { tipo: "config" }
  | { tipo: "arquivadas" };

type Acoes = ReturnType<typeof useEdicaoDoCronograma>;

/**
 * Um campo de texto que vai gravando enquanto se digita (uma pausa de 0,7 s, ou sair do campo, ou
 * Enter): o painel ao lado já mostra o resultado, sem botão "salvar".
 */
function CampoDeTexto({
  valor,
  aoSalvar,
  rotulo,
  maximo,
  multilinha = false,
  placeholder,
  vazioPermitido = false,
}: {
  valor: string;
  aoSalvar: (texto: string) => void;
  rotulo: string;
  maximo: number;
  multilinha?: boolean;
  placeholder?: string;
  vazioPermitido?: boolean;
}) {
  const [texto, setTexto] = useState(valor);
  const campo = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salvar = useRef(aoSalvar);
  useEffect(() => {
    salvar.current = aoSalvar;
  });
  // Mudou por fora (um Ctrl+Z, outra pessoa) e o campo não está em uso: acompanha.
  useEffect(() => {
    if (document.activeElement !== campo.current) setTexto(valor);
  }, [valor]);

  const gravar = (novo: string) => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
    const limpo = novo.trim();
    if (limpo === valor.trim()) return;
    if (limpo === "" && !vazioPermitido) return;
    salvar.current(limpo);
  };
  const aoMudar = (novo: string) => {
    setTexto(novo);
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => gravar(novo), 700);
  };
  useEffect(
    () => () => {
      if (espera.current) clearTimeout(espera.current);
    },
    [],
  );

  const comum = {
    value: texto,
    maxLength: maximo,
    "aria-label": rotulo,
    placeholder,
    className: cn(CAMPO, multilinha && "resize-y"),
    onBlur: () => gravar(texto),
  };
  return multilinha ? (
    <textarea
      {...comum}
      ref={(el) => {
        campo.current = el;
      }}
      rows={3}
      onChange={(e) => aoMudar(e.target.value)}
    />
  ) : (
    <input
      {...comum}
      ref={(el) => {
        campo.current = el;
      }}
      onChange={(e) => aoMudar(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && gravar(texto)}
    />
  );
}

// ── Meta ─────────────────────────────────────────────────────────────────────────
function FormularioDaMeta({
  meta,
  acoes,
  aoFechar,
}: {
  meta: MetaDoCronograma;
  acoes: Acoes;
  aoFechar: () => void;
}) {
  const t = useT();
  const [alvo, setAlvo] = useState(textoDoValor(meta.valor_alvo, meta.tipo));
  const [atual, setAtual] = useState(textoDoValor(meta.valor_atual, meta.tipo));
  const editar = (patch: Parameters<Acoes["editarMeta"]>[1]) =>
    void acoes.editarMeta(meta.id, patch);
  const rotuloDoTipo = (tipo: TipoDeMeta) =>
    tipo === "moeda"
      ? t("Dinheiro (R$)")
      : tipo === "percentual"
        ? t("Porcentagem (%)")
        : t("Quantidade");
  const rotuloDaFonte: Record<FonteDaMeta, string> = {
    manual: t("Digitado por mim"),
    leads: t("Leads do CRM"),
    vendas: t("Vendas fechadas"),
    faturamento: t("Faturamento recebido"),
    a_receber: t("A receber (comprometido)"),
    investido: t("Investimento em anúncios"),
    cpl: t("CPL (custo por lead)"),
    roas: t("ROAS (retorno sobre o investido)"),
  };
  const hoje = chaveDoDia(new Date(), FUSO_DO_CRONOGRAMA);

  return (
    <div className="grid gap-3">
      <Rotulo texto={t("Meta")}>
        <CampoDeTexto
          valor={meta.titulo}
          rotulo={t("Meta")}
          maximo={120}
          aoSalvar={(titulo) => editar({ titulo })}
        />
      </Rotulo>
      <div className="grid grid-cols-2 gap-2">
        <Rotulo texto={t("Tipo da meta")}>
          <SelectDoApp
            value={meta.tipo}
            aria-label={t("Tipo da meta")}
            onChange={(e) => editar({ tipo: e.target.value as TipoDeMeta })}
            className={CAMPO}
          >
            {TIPOS_DE_META.map((tipo) => (
              <option key={tipo} value={tipo}>
                {rotuloDoTipo(tipo)}
              </option>
            ))}
          </SelectDoApp>
        </Rotulo>
        {meta.tipo === "numero" ? (
          <Rotulo texto={t("Unidade")}>
            <CampoDeTexto
              valor={meta.unidade}
              rotulo={t("Unidade")}
              maximo={20}
              vazioPermitido
              placeholder={t("Unidade (ex.: leads)")}
              aoSalvar={(unidade) => editar({ unidade })}
            />
          </Rotulo>
        ) : null}
      </div>
      <Rotulo texto={t("De onde vem o número de hoje")}>
        <SelectDoApp
          value={meta.fonte}
          aria-label={t("De onde vem o número de hoje")}
          onChange={(e) => editar({ fonte: e.target.value as FonteDaMeta })}
          className={CAMPO}
        >
          {FONTES_DA_META.map((f) => (
            <option key={f} value={f}>
              {rotuloDaFonte[f]}
            </option>
          ))}
        </SelectDoApp>
      </Rotulo>
      {meta.fonte !== "manual" ? (
        <>
          <Rotulo texto={t("Prazo da meta")}>
            <SelectDoApp
              value={meta.periodo}
              aria-label={t("Prazo da meta")}
              onChange={(e) => {
                const periodo = e.target.value as Periodo | "personalizado";
                if (periodo === "personalizado") {
                  editar({
                    periodo,
                    periodo_de: meta.periodo_de ?? `${hoje.slice(0, 7)}-01`,
                    periodo_ate: meta.periodo_ate ?? hoje,
                  });
                } else {
                  editar({ periodo, periodo_de: null, periodo_ate: null });
                }
              }}
              className={CAMPO}
            >
              <optgroup label={t("Fixos")}>
                <option value="hoje">{t("Diário (hoje)")}</option>
                <option value="semana">{t("Semanal (esta semana)")}</option>
                <option value="mes">{t("Mensal (este mês)")}</option>
                <option value="trimestre">{t("Trimestral (este trimestre)")}</option>
                <option value="semestre">{t("Semestral (este semestre)")}</option>
                <option value="ano">{t("Anual (este ano)")}</option>
              </optgroup>
              <optgroup label={t("Janelas móveis")}>
                <option value="ontem">{t("Ontem")}</option>
                <option value="ultimos_5_dias">{t("Últimos 5 dias")}</option>
                <option value="ultimos_7_dias">{t("Últimos 7 dias")}</option>
                <option value="ultimos_30_dias">{t("Últimos 30 dias")}</option>
                <option value="mes_passado">{t("Mês passado")}</option>
              </optgroup>
              <option value="personalizado">{t("Datas personalizadas…")}</option>
            </SelectDoApp>
            {meta.periodo === "personalizado" ? (
              <div className="mt-2">
                <SeletorDePeriodo
                  de={meta.periodo_de ?? hoje}
                  ate={meta.periodo_ate ?? hoje}
                  rotulo={t("Datas da meta")}
                  aoMudar={(p) =>
                    editar({ periodo: "personalizado", periodo_de: p.de, periodo_ate: p.ate })
                  }
                />
              </div>
            ) : null}
          </Rotulo>
          {meta.fonte !== "cpl" && meta.fonte !== "roas" ? (
            <Rotulo texto={t("Cálculo")}>
              <SelectDoApp
                value={meta.calculo}
                aria-label={t("Cálculo")}
                onChange={(e) => editar({ calculo: e.target.value as CalculoDaMeta })}
                className={CAMPO}
              >
                <option value="soma">{t("Soma do período")}</option>
                <option value="media_diaria">{t("Média por dia")}</option>
              </SelectDoApp>
            </Rotulo>
          ) : null}
        </>
      ) : null}
      <Rotulo texto={t("Onde queremos chegar")}>
        <CampoDeValor
          tipo={meta.tipo}
          texto={alvo}
          aoMudar={setAlvo}
          aoConfirmar={(v) => v !== meta.valor_alvo && editar({ valor_alvo: v })}
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
          <p className="flex h-10 items-center rounded-xl border border-dashed px-3 text-sm text-muted-foreground">
            {t("Atualiza sozinho — aparece no cronograma")}
          </p>
        ) : (
          <CampoDeValor
            tipo={meta.tipo}
            texto={atual}
            aoMudar={setAtual}
            aoConfirmar={(v) => v !== meta.valor_atual && editar({ valor_atual: v })}
            rotulo={t("Onde estamos hoje")}
          />
        )}
      </Rotulo>
      <Rotulo texto={t("Descrição (aparece abaixo da meta)")}>
        <CampoDeTexto
          valor={meta.descricao}
          rotulo={t("Descrição")}
          maximo={300}
          multilinha
          vazioPermitido
          aoSalvar={(descricao) => editar({ descricao })}
        />
      </Rotulo>
      <button
        type="button"
        onClick={async () => {
          await acoes.apagarMeta(meta.id);
          aoFechar();
        }}
        className="inline-flex h-10 w-fit items-center gap-2 rounded-xl px-3 text-sm text-error-fg hover:bg-error-bg"
      >
        <Trash size={14} aria-hidden />
        {t("Apagar meta")}
      </button>
    </div>
  );
}

// ── Ação ─────────────────────────────────────────────────────────────────────────
function FormularioDaAcao({
  item,
  itens,
  config,
  aoSalvarConfig,
  acoes,
  aoFechar,
}: {
  item: ItemDoCronograma;
  itens: readonly ItemDoCronograma[];
  config: ConfigDoCronograma;
  aoSalvarConfig: (c: ConfigDoCronograma) => Promise<unknown>;
  acoes: Acoes;
  aoFechar: () => void;
}) {
  const t = useT();
  const fases = nomesDasFases(itens);
  const editar = (patch: Parameters<Acoes["editarItem"]>[1]) =>
    void acoes.editarItem(item.id, patch);
  const rotuloDoStatus = (s: StatusDoItem) =>
    s === "planejado" ? t("Planejado") : s === "andamento" ? t("Em andamento") : t("Concluído");
  const naFase = naOrdem(itens).filter((i) => i.fase.trim() === item.fase.trim());
  const k = naFase.findIndex((i) => i.id === item.id);

  return (
    <div className="grid gap-3">
      <Rotulo texto={t("Ação")}>
        <CampoDeTexto
          valor={item.acao}
          rotulo={t("Ação")}
          maximo={200}
          aoSalvar={(acao) => editar({ acao })}
        />
      </Rotulo>
      <Rotulo texto={t("Período da ação")}>
        <PeriodoDaAcao
          inicio={item.semana_inicio}
          fim={item.semana_fim}
          config={config}
          aoSalvarConfig={aoSalvarConfig}
          aoMudar={(s) => editar({ semana_inicio: s.inicio, semana_fim: s.fim })}
        />
      </Rotulo>
      <div className="grid grid-cols-2 gap-2">
        <Rotulo texto={t("Situação")}>
          <SelectDoApp
            value={item.status}
            aria-label={t("Situação")}
            onChange={(e) => editar({ status: e.target.value as StatusDoItem })}
            className={CAMPO}
          >
            {STATUS_DO_ITEM.map((s) => (
              <option key={s} value={s}>
                {rotuloDoStatus(s)}
              </option>
            ))}
          </SelectDoApp>
        </Rotulo>
        <Rotulo texto={t("Fase")}>
          <SelectDoApp
            value={item.fase}
            aria-label={t("Fase")}
            onChange={(e) => editar({ fase: e.target.value })}
            className={CAMPO}
          >
            <option value="">{t("Sem fase")}</option>
            {fases.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </SelectDoApp>
        </Rotulo>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <CaixaRedonda
          checked={item.destaque}
          onChange={(e) => editar({ destaque: e.target.checked })}
        />
        {t("Destacar no cronograma")}
      </label>
      <Rotulo texto={t("Notas (aparecem abaixo da ação)")}>
        <CampoDeTexto
          valor={item.notas}
          rotulo={t("Notas")}
          maximo={500}
          multilinha
          vazioPermitido
          aoSalvar={(notas) => editar({ notas })}
        />
      </Rotulo>
      <div className="flex flex-wrap items-center gap-1 border-t pt-3">
        <button
          type="button"
          aria-label={t("Subir ação")}
          title={t("Subir")}
          disabled={k <= 0}
          onClick={() => void acoes.gravarOrdem(moverAcao(itens, item.id, -1))}
          className={cn(BOTAO_ICONE, "disabled:opacity-30")}
        >
          <ArrowUp size={16} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={t("Descer ação")}
          title={t("Descer")}
          disabled={k < 0 || k >= naFase.length - 1}
          onClick={() => void acoes.gravarOrdem(moverAcao(itens, item.id, 1))}
          className={cn(BOTAO_ICONE, "disabled:opacity-30")}
        >
          <ArrowDown size={16} aria-hidden />
        </button>
        <button
          type="button"
          disabled={item.status !== "concluido"}
          title={
            item.status === "concluido"
              ? t("Tirar do gráfico (fica guardada)")
              : t("Só ações concluídas podem ser arquivadas")
          }
          onClick={async () => {
            await acoes.editarItem(item.id, { arquivado: true });
            aoFechar();
          }}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm hover:bg-secondary disabled:opacity-40"
        >
          <Archive size={14} aria-hidden />
          {t("Arquivar ação")}
        </button>
        <button
          type="button"
          onClick={async () => {
            await acoes.apagarItem(item.id);
            aoFechar();
          }}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm text-error-fg hover:bg-error-bg"
        >
          <Trash size={14} aria-hidden />
          {t("Apagar ação")}
        </button>
      </div>
    </div>
  );
}

// ── Fase ─────────────────────────────────────────────────────────────────────────
function FormularioDaFase({
  nome,
  itens,
  acoes,
  aoNovaAcao,
  aoAbrirAcao,
  aoRenomear,
  aoFechar,
}: {
  nome: string;
  itens: readonly ItemDoCronograma[];
  acoes: Acoes;
  aoNovaAcao: (fase: string) => void;
  aoAbrirAcao: (id: string) => void;
  aoRenomear: (novo: string) => void;
  aoFechar: () => void;
}) {
  const t = useT();
  const [confirmando, setConfirmando] = useState(false);
  const fases = nomesDasFases(itens);
  const k = fases.indexOf(nome);
  const dela = naOrdem(itens).filter((i) => i.fase.trim() === nome);
  const concluidas = dela.filter((i) => i.status === "concluido");

  return (
    <div className="grid gap-3">
      <Rotulo texto={t("Nome da fase")}>
        <CampoDeTexto
          valor={nome}
          rotulo={t("Nome da fase")}
          maximo={80}
          aoSalvar={(novo) => {
            if (!fases.includes(novo)) {
              void acoes.renomearFase(nome, novo).then(() => aoRenomear(novo));
            }
          }}
        />
      </Rotulo>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={t("Subir fase")}
          title={t("Subir fase")}
          disabled={k <= 0}
          onClick={() => void acoes.gravarOrdem(moverFase(itens, nome, -1))}
          className={cn(BOTAO_ICONE, "disabled:opacity-30")}
        >
          <ArrowUp size={16} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={t("Descer fase")}
          title={t("Descer fase")}
          disabled={k < 0 || k >= fases.length - 1}
          onClick={() => void acoes.gravarOrdem(moverFase(itens, nome, 1))}
          className={cn(BOTAO_ICONE, "disabled:opacity-30")}
        >
          <ArrowDown size={16} aria-hidden />
        </button>
        <span className="text-xs text-muted-foreground">
          {concluidas.length}/{dela.length} {t("concluídas")}
        </span>
      </div>
      <div className="grid gap-1.5">
        <p className="text-xs font-semibold tracking-wider text-text-subtle uppercase">
          {t("Ações desta fase")}
        </p>
        {dela.map((i) => (
          <button
            key={i.id}
            type="button"
            onClick={() => aoAbrirAcao(i.id)}
            className="truncate rounded-xl border px-3 py-2 text-left text-sm hover:bg-secondary"
          >
            {i.acao}
          </button>
        ))}
        <button
          type="button"
          onClick={() => aoNovaAcao(nome)}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 text-sm font-medium text-primary hover:border-primary"
        >
          <Plus size={14} weight="bold" aria-hidden />
          {t("Nova ação nesta fase")}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        {concluidas.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              for (const i of concluidas) void acoes.editarItem(i.id, { arquivado: true });
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium hover:bg-secondary"
          >
            <Archive size={14} aria-hidden />
            {t("Arquivar concluídas")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={async () => {
            if (!confirmando) return setConfirmando(true);
            for (const i of dela) await acoes.apagarItem(i.id);
            aoFechar();
          }}
          className={cn(
            "ml-auto inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm text-error-fg hover:bg-error-bg",
            confirmando && "bg-error-bg font-medium",
          )}
        >
          <Trash size={14} aria-hidden />
          {confirmando
            ? `${t("Confirmar: apagar a fase e")} ${dela.length} ${t("ações")}`
            : t("Apagar fase")}
        </button>
      </div>
    </div>
  );
}

// ── Configuração ─────────────────────────────────────────────────────────────────
function FormularioDaConfig({
  config,
  aoSalvarConfig,
}: {
  config: ConfigDoCronograma;
  aoSalvarConfig: (c: ConfigDoCronograma) => Promise<unknown>;
}) {
  const t = useT();
  const [cfg, setCfg] = useState(config);
  const [janelaTxt, setJanelaTxt] = useState(String(config.total_semanas));
  return (
    <div className="grid gap-3">
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
      <p className="text-xs text-muted-foreground">
        {t("O cronograma não tem fim: arraste as semanas para o lado para ver as próximas.")}
      </p>
      <button
        type="button"
        onClick={() => {
          const n = Math.min(MAXIMO_DA_JANELA, Math.max(1, Number(janelaTxt) || cfg.total_semanas));
          setJanelaTxt(String(n));
          void aoSalvarConfig({ ...cfg, total_semanas: n });
        }}
        className="h-10 w-fit rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        {t("Salvar configuração")}
      </button>
    </div>
  );
}

// ── Arquivadas ───────────────────────────────────────────────────────────────────
function ListaDeArquivadas({ itens, acoes }: { itens: readonly ItemDoCronograma[]; acoes: Acoes }) {
  const t = useT();
  const arquivados = itens.filter((i) => i.arquivado);
  if (arquivados.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("Nenhuma ação arquivada.")}</p>;
  }
  return (
    <div className="grid gap-2">
      {arquivados.map((i) => (
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
            onClick={() => void acoes.editarItem(i.id, { arquivado: false })}
            className="h-9 rounded-xl border px-3 text-sm font-medium hover:bg-secondary"
          >
            {t("Desarquivar")}
          </button>
          <button
            type="button"
            aria-label={t("Apagar ação")}
            onClick={() => void acoes.apagarItem(i.id)}
            className={cn(BOTAO_ICONE, "hover:text-error-fg")}
          >
            <Trash size={16} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * A GAVETA de edição do cronograma: abre ao lado do painel quando se clica numa meta, ação ou fase
 * (ou em "Configurar"/"Arquivadas"). Não tapa nem trava o painel: o que se muda aqui aparece lá na
 * hora. No celular vira uma folha por baixo.
 */
export function GavetaDoCronograma({
  vista,
  itens,
  metas,
  config,
  aoSalvarConfig,
  acoes,
  aoMudarVista,
  aoNovaAcao,
  aoFechar,
}: {
  vista: VistaDaGaveta;
  itens: readonly ItemDoCronograma[];
  metas: readonly MetaDoCronograma[];
  config: ConfigDoCronograma;
  aoSalvarConfig: (c: ConfigDoCronograma) => Promise<unknown>;
  acoes: Acoes;
  aoMudarVista: (v: VistaDaGaveta) => void;
  aoNovaAcao: (fase: string) => void;
  aoFechar: () => void;
}) {
  const t = useT();
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest("[role='dialog'], [role='listbox'], [data-radix-popper-content-wrapper]"))
        return;
      aoFechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aoFechar]);

  const meta = vista.tipo === "meta" ? metas.find((m) => m.id === vista.id) : undefined;
  const item = vista.tipo === "acao" ? itens.find((i) => i.id === vista.id) : undefined;
  const existeAFase =
    vista.tipo === "fase" && itens.some((i) => !i.arquivado && i.fase.trim() === vista.nome);

  const titulo =
    vista.tipo === "meta"
      ? t("Meta")
      : vista.tipo === "acao"
        ? t("Ação-chave")
        : vista.tipo === "fase"
          ? t("Fase")
          : vista.tipo === "config"
            ? t("Configurar o cronograma")
            : t("Ações arquivadas");

  let corpo: ReactNode = null;
  if (vista.tipo === "meta" && meta) {
    corpo = (
      <FormularioDaMeta
        key={`${meta.id}-${meta.tipo}`}
        meta={meta}
        acoes={acoes}
        aoFechar={aoFechar}
      />
    );
  } else if (vista.tipo === "acao" && item) {
    corpo = (
      <FormularioDaAcao
        key={item.id}
        item={item}
        itens={itens}
        config={config}
        aoSalvarConfig={aoSalvarConfig}
        acoes={acoes}
        aoFechar={aoFechar}
      />
    );
  } else if (vista.tipo === "fase" && existeAFase) {
    corpo = (
      <FormularioDaFase
        key={vista.nome}
        nome={vista.nome}
        itens={itens}
        acoes={acoes}
        aoNovaAcao={aoNovaAcao}
        aoAbrirAcao={(id) => aoMudarVista({ tipo: "acao", id })}
        aoRenomear={(nome) => aoMudarVista({ tipo: "fase", nome })}
        aoFechar={aoFechar}
      />
    );
  } else if (vista.tipo === "config") {
    corpo = <FormularioDaConfig config={config} aoSalvarConfig={aoSalvarConfig} />;
  } else if (vista.tipo === "arquivadas") {
    corpo = <ListaDeArquivadas itens={itens} acoes={acoes} />;
  } else {
    // O item aberto deixou de existir (apagado, ou desfeito): fecha.
    corpo = <p className="text-sm text-muted-foreground">{t("Este item não existe mais.")}</p>;
  }

  return (
    <aside
      role="complementary"
      aria-label={titulo}
      data-sem-imagem=""
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[68dvh] flex-col rounded-t-3xl border bg-background shadow-2xl lg:inset-x-auto lg:top-20 lg:right-4 lg:bottom-4 lg:max-h-none lg:w-[26rem] lg:rounded-3xl"
    >
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <span className="rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
          {titulo}
        </span>
        <button
          type="button"
          aria-label={t("Fechar")}
          onClick={aoFechar}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
        >
          <X size={16} aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{corpo}</div>
    </aside>
  );
}
