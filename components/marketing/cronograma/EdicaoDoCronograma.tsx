"use client";

import { useState } from "react";

import { CampoDeMoeda } from "@/components/marketing/CampoDeMoeda";
import { SeletorDeData } from "@/components/marketing/cronograma/SeletorDeData";
import { useT } from "@/hooks/i18n/useT";
import { formatarMoeda, lerNumero } from "@/lib/marketing/calculadora";
import {
  MAXIMO_DA_JANELA,
  MAXIMO_DE_SEMANAS,
  STATUS_DO_ITEM,
  TIPOS_DE_META,
  domingoDe,
  type ConfigDoCronograma,
  type DadosDaMeta,
  type ItemDoCronograma,
  type MetaDoCronograma,
  type StatusDoItem,
  type TipoDeMeta,
} from "@/lib/marketing/cronograma";
import { Archive, Plus, Trash } from "@/lib/ui/icons";
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
  aoEditarItem: (
    id: string,
    i: Partial<Omit<ItemDoCronograma, "id" | "ordem">>,
  ) => Promise<unknown>;
  aoApagarItem: (id: string) => Promise<unknown>;
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
        <Rotulo texto={t("Onde estamos hoje")}>
          <CampoDeValor
            tipo={meta.tipo}
            texto={atual}
            aoMudar={setAtual}
            aoConfirmar={(v) => v !== meta.valor_atual && void aoEditar({ valor_atual: v })}
            rotulo={t("Onde estamos hoje")}
          />
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
}: {
  item: ItemDoCronograma;
  fases: string[];
  acoes: AcoesDeItem;
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[0.7fr_0.7fr_1.2fr_1.2fr_auto_auto_auto]">
        <input
          type="number"
          min={1}
          max={MAXIMO_DE_SEMANAS}
          defaultValue={item.semana_inicio}
          aria-label={t("Semana de início")}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (n >= 1 && n !== item.semana_inicio)
              void acoes.aoEditarItem(item.id, {
                semana_inicio: n,
                semana_fim: Math.max(n, item.semana_fim),
              });
          }}
          className={CAMPO}
        />
        <input
          type="number"
          min={1}
          max={MAXIMO_DE_SEMANAS}
          defaultValue={item.semana_fim}
          aria-label={t("Semana de fim")}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (n >= item.semana_inicio && n !== item.semana_fim)
              void acoes.aoEditarItem(item.id, { semana_fim: n });
          }}
          className={CAMPO}
        />
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

function NovaAcao({
  fase,
  semanaSugerida,
  aoCriar,
}: {
  fase: string;
  semanaSugerida: number;
  aoCriar: AcoesDeItem["aoCriarItem"];
}) {
  const t = useT();
  const [acao, setAcao] = useState("");
  const [inicio, setInicio] = useState(semanaSugerida);
  const [fim, setFim] = useState(semanaSugerida);
  return (
    <div className="grid gap-2 rounded-xl border border-dashed p-3 sm:grid-cols-[2fr_0.6fr_0.6fr_auto]">
      <input
        value={acao}
        maxLength={200}
        placeholder={t("Nova ação-chave")}
        aria-label={t("Nova ação-chave")}
        onChange={(e) => setAcao(e.target.value)}
        className={CAMPO}
      />
      <input
        type="number"
        min={1}
        max={MAXIMO_DE_SEMANAS}
        value={inicio}
        aria-label={t("Semana de início")}
        onChange={(e) => {
          const n = Math.max(1, Number(e.target.value) || 1);
          setInicio(n);
          setFim((f) => Math.max(n, f));
        }}
        className={CAMPO}
      />
      <input
        type="number"
        min={inicio}
        max={MAXIMO_DE_SEMANAS}
        value={fim}
        aria-label={t("Semana de fim")}
        onChange={(e) => setFim(Math.max(inicio, Number(e.target.value) || inicio))}
        className={CAMPO}
      />
      <button
        type="button"
        disabled={acao.trim() === ""}
        onClick={async () => {
          await aoCriar({
            acao,
            fase,
            semana_inicio: inicio,
            semana_fim: fim,
            status: "planejado",
            destaque: false,
            notas: "",
            arquivado: false,
          });
          setAcao("");
        }}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
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
}: {
  nome: string;
  itens: ItemDoCronograma[];
  fases: string[];
  acoes: AcoesDeItem;
  aoRenomear: (de: string, para: string) => void;
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
      {itens.map((i) => (
        <LinhaDeAcao key={i.id} item={i} fases={fases} acoes={acoes} />
      ))}
      <NovaAcao fase={nome} semanaSugerida={sugerida} aoCriar={acoes.aoCriarItem} />
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
  const [fasesVazias, setFasesVazias] = useState<string[]>([]);
  const [novaFase, setNovaFase] = useState("");
  const [verArquivadas, setVerArquivadas] = useState(false);
  const acoes: AcoesDeItem = { aoCriarItem, aoEditarItem, aoApagarItem };

  const ativos = itens.filter((i) => !i.arquivado);
  const arquivados = itens.filter((i) => i.arquivado);
  const nomesDeFase: string[] = [];
  for (const i of ativos) {
    const n = i.fase.trim();
    if (n && !nomesDeFase.includes(n)) nomesDeFase.push(n);
  }
  for (const n of fasesVazias) if (!nomesDeFase.includes(n)) nomesDeFase.push(n);
  const semFase = ativos.filter((i) => i.fase.trim() === "");

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
          "Cada fase reúne várias ações-chave. A semana mostrada é a do cronograma (S1, S2…).",
        )}
      >
        {nomesDeFase.map((nome) => (
          <CartaoDeFase
            key={nome}
            nome={nome}
            itens={ativos.filter((i) => i.fase.trim() === nome)}
            fases={nomesDeFase}
            acoes={acoes}
            aoRenomear={renomear}
          />
        ))}
        {semFase.length > 0 ? (
          <CartaoDeFase
            nome=""
            itens={semFase}
            fases={nomesDeFase}
            acoes={acoes}
            aoRenomear={renomear}
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
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
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
              type="number"
              min={1}
              max={MAXIMO_DA_JANELA}
              value={cfg.total_semanas}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  total_semanas: Math.min(
                    MAXIMO_DA_JANELA,
                    Math.max(1, Number(e.target.value) || 1),
                  ),
                })
              }
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
          onClick={() => void aoSalvarConfig(cfg)}
          className="h-10 w-fit rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {t("Salvar configuração")}
        </button>
      </Grupo>
    </div>
  );
}
