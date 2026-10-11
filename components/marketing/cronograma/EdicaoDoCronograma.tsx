"use client";

import { useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import {
  STATUS_DO_ITEM,
  type ConfigDoCronograma,
  type ItemDoCronograma,
  type MetaDoCronograma,
  type StatusDoItem,
} from "@/lib/marketing/cronograma";
import { Plus, Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const CAMPO =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

function Rotulo({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{texto}</span>
      {children}
    </label>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-3 rounded-2xl border bg-card p-4">
      <legend className="px-2 text-sm font-semibold">{titulo}</legend>
      {children}
    </fieldset>
  );
}

/** Edição das METAS (topo), das AÇÕES (barras) e da configuração do cronograma geral. */
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
  aoCriarItem: (i: Omit<ItemDoCronograma, "id" | "ordem">) => Promise<unknown>;
  aoEditarItem: (
    id: string,
    i: Partial<Omit<ItemDoCronograma, "id" | "ordem">>,
  ) => Promise<unknown>;
  aoApagarItem: (id: string) => Promise<unknown>;
  aoCriarMeta: (
    m: Pick<MetaDoCronograma, "titulo" | "alvo" | "atual" | "descricao">,
  ) => Promise<unknown>;
  aoEditarMeta: (
    id: string,
    m: Partial<Pick<MetaDoCronograma, "titulo" | "alvo" | "atual" | "descricao">>,
  ) => Promise<unknown>;
  aoApagarMeta: (id: string) => Promise<unknown>;
}) {
  const t = useT();
  const [cfg, setCfg] = useState(config);
  const [novaMeta, setNovaMeta] = useState({ titulo: "", alvo: "", atual: "", descricao: "" });
  const [novo, setNovo] = useState({
    acao: "",
    fase: "",
    semana_inicio: 1,
    semana_fim: 1,
    status: "planejado" as StatusDoItem,
    destaque: false,
    notas: "",
  });

  const rotuloDoStatus = (s: StatusDoItem) =>
    s === "planejado" ? t("Planejado") : s === "andamento" ? t("Em andamento") : t("Concluído");

  return (
    <div className="grid gap-4">
      <Grupo titulo={t("Metas (o topo da página)")}>
        {metas.map((m) => (
          <div
            key={m.id}
            className="grid gap-2 rounded-xl bg-secondary/40 p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]"
          >
            <input
              defaultValue={m.titulo}
              aria-label={t("Meta")}
              maxLength={120}
              onBlur={(e) =>
                e.target.value.trim() &&
                e.target.value !== m.titulo &&
                void aoEditarMeta(m.id, { titulo: e.target.value })
              }
              className={CAMPO}
            />
            <input
              defaultValue={m.alvo}
              aria-label={t("Onde queremos chegar")}
              placeholder={t("Alvo (ex.: R$ 8.000/mês)")}
              maxLength={40}
              onBlur={(e) =>
                e.target.value !== m.alvo && void aoEditarMeta(m.id, { alvo: e.target.value })
              }
              className={CAMPO}
            />
            <input
              defaultValue={m.atual}
              aria-label={t("Onde estamos")}
              placeholder={t("Hoje (ex.: R$ 2.000)")}
              maxLength={40}
              onBlur={(e) =>
                e.target.value !== m.atual && void aoEditarMeta(m.id, { atual: e.target.value })
              }
              className={CAMPO}
            />
            <button
              type="button"
              aria-label={t("Apagar meta")}
              onClick={() => void aoApagarMeta(m.id)}
              className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
            >
              <Trash size={16} aria-hidden />
            </button>
          </div>
        ))}
        <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
          <input
            value={novaMeta.titulo}
            maxLength={120}
            placeholder={t("Nova meta")}
            aria-label={t("Nova meta")}
            onChange={(e) => setNovaMeta({ ...novaMeta, titulo: e.target.value })}
            className={CAMPO}
          />
          <input
            value={novaMeta.alvo}
            maxLength={40}
            placeholder={t("Alvo (ex.: R$ 8.000/mês)")}
            aria-label={t("Onde queremos chegar")}
            onChange={(e) => setNovaMeta({ ...novaMeta, alvo: e.target.value })}
            className={CAMPO}
          />
          <input
            value={novaMeta.atual}
            maxLength={40}
            placeholder={t("Hoje (ex.: R$ 2.000)")}
            aria-label={t("Onde estamos")}
            onChange={(e) => setNovaMeta({ ...novaMeta, atual: e.target.value })}
            className={CAMPO}
          />
          <button
            type="button"
            disabled={novaMeta.titulo.trim() === ""}
            onClick={async () => {
              await aoCriarMeta(novaMeta);
              setNovaMeta({ titulo: "", alvo: "", atual: "", descricao: "" });
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus size={14} weight="bold" aria-hidden />
            {t("Adicionar")}
          </button>
        </div>
      </Grupo>

      <Grupo titulo={t("Ações do cronograma")}>
        {itens.map((i) => (
          <div key={i.id} className="grid gap-2 rounded-xl bg-secondary/40 p-3">
            <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
              <input
                defaultValue={i.acao}
                aria-label={t("Ação")}
                maxLength={200}
                onBlur={(e) =>
                  e.target.value.trim() &&
                  e.target.value !== i.acao &&
                  void aoEditarItem(i.id, { acao: e.target.value })
                }
                className={CAMPO}
              />
              <input
                defaultValue={i.fase}
                aria-label={t("Fase")}
                placeholder={t("Fase (ex.: Estruturação)")}
                maxLength={80}
                onBlur={(e) =>
                  e.target.value !== i.fase && void aoEditarItem(i.id, { fase: e.target.value })
                }
                className={CAMPO}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto_auto]">
              <input
                type="number"
                min={1}
                max={config.total_semanas}
                defaultValue={i.semana_inicio}
                aria-label={t("Semana de início")}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 1 && n !== i.semana_inicio)
                    void aoEditarItem(i.id, {
                      semana_inicio: n,
                      semana_fim: Math.max(n, i.semana_fim),
                    });
                }}
                className={CAMPO}
              />
              <input
                type="number"
                min={1}
                max={config.total_semanas}
                defaultValue={i.semana_fim}
                aria-label={t("Semana de fim")}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (n >= i.semana_inicio && n !== i.semana_fim)
                    void aoEditarItem(i.id, { semana_fim: n });
                }}
                className={CAMPO}
              />
              <select
                value={i.status}
                aria-label={t("Situação")}
                onChange={(e) =>
                  void aoEditarItem(i.id, { status: e.target.value as StatusDoItem })
                }
                className={CAMPO}
              >
                {STATUS_DO_ITEM.map((s) => (
                  <option key={s} value={s}>
                    {rotuloDoStatus(s)}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={i.destaque}
                  onChange={(e) => void aoEditarItem(i.id, { destaque: e.target.checked })}
                />
                {t("Destacar")}
              </label>
              <button
                type="button"
                aria-label={t("Apagar ação")}
                onClick={() => void aoApagarItem(i.id)}
                className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
              >
                <Trash size={16} aria-hidden />
              </button>
            </div>
          </div>
        ))}

        <div className="grid gap-2 rounded-xl border border-dashed p-3">
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
            <input
              value={novo.acao}
              maxLength={200}
              placeholder={t("Nova ação")}
              aria-label={t("Nova ação")}
              onChange={(e) => setNovo({ ...novo, acao: e.target.value })}
              className={CAMPO}
            />
            <input
              value={novo.fase}
              maxLength={80}
              placeholder={t("Fase (ex.: Estruturação)")}
              aria-label={t("Fase")}
              onChange={(e) => setNovo({ ...novo, fase: e.target.value })}
              className={CAMPO}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
            <Rotulo texto={t("Semana de início")}>
              <input
                type="number"
                min={1}
                max={config.total_semanas}
                value={novo.semana_inicio}
                onChange={(e) => {
                  const n = Math.max(1, Number(e.target.value) || 1);
                  setNovo({ ...novo, semana_inicio: n, semana_fim: Math.max(n, novo.semana_fim) });
                }}
                className={CAMPO}
              />
            </Rotulo>
            <Rotulo texto={t("Semana de fim")}>
              <input
                type="number"
                min={novo.semana_inicio}
                max={config.total_semanas}
                value={novo.semana_fim}
                onChange={(e) =>
                  setNovo({
                    ...novo,
                    semana_fim: Math.max(novo.semana_inicio, Number(e.target.value) || 1),
                  })
                }
                className={CAMPO}
              />
            </Rotulo>
            <Rotulo texto={t("Situação")}>
              <select
                value={novo.status}
                onChange={(e) => setNovo({ ...novo, status: e.target.value as StatusDoItem })}
                className={CAMPO}
              >
                {STATUS_DO_ITEM.map((s) => (
                  <option key={s} value={s}>
                    {rotuloDoStatus(s)}
                  </option>
                ))}
              </select>
            </Rotulo>
            <button
              type="button"
              disabled={novo.acao.trim() === ""}
              onClick={async () => {
                await aoCriarItem(novo);
                setNovo({ ...novo, acao: "", notas: "" });
              }}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 self-end rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground",
                "disabled:opacity-50",
              )}
            >
              <Plus size={14} weight="bold" aria-hidden />
              {t("Adicionar")}
            </button>
          </div>
        </div>
      </Grupo>

      <Grupo titulo={t("Configuração")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Rotulo texto={t("Quantas semanas")}>
            <input
              type="number"
              min={1}
              max={26}
              value={cfg.total_semanas}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  total_semanas: Math.min(26, Math.max(1, Number(e.target.value) || 1)),
                })
              }
              className={CAMPO}
            />
          </Rotulo>
          <Rotulo texto={t("Segunda-feira da semana 1")}>
            <input
              type="date"
              value={cfg.data_inicio ?? ""}
              onChange={(e) => setCfg({ ...cfg, data_inicio: e.target.value || null })}
              className={CAMPO}
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
