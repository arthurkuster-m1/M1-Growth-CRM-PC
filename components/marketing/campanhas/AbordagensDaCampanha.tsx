"use client";

import { useEffect, useState } from "react";

import {
  COR_DO_STATUS_DO_CRIATIVO,
  rotuloDoMeio,
  rotuloDoStatusDoCriativo,
} from "@/components/marketing/campanhas/rotulos";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { useT } from "@/hooks/i18n/useT";
import { useAbordagensDaCampanha } from "@/hooks/marketing/useCampanhasDeDemanda";
import {
  MEIOS_DA_ABORDAGEM,
  STATUS_DA_ABORDAGEM,
  type Abordagem,
} from "@/lib/marketing/abordagens";
import { Plus, Trash } from "@/lib/ui/icons";

const CAMPO =
  "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const AREA =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

function Texto({
  valor,
  aoGravar,
  desabilitado,
  rotulo,
  longo,
  max,
}: {
  valor: string;
  aoGravar: (v: string) => void;
  desabilitado: boolean;
  rotulo: string;
  longo?: boolean;
  max: number;
}) {
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  const comum = {
    value: v,
    maxLength: max,
    disabled: desabilitado,
    placeholder: rotulo,
    "aria-label": rotulo,
    onChange: (e: { target: { value: string } }) => setV(e.target.value),
    onBlur: () => v !== valor && aoGravar(v),
  };
  return longo ? (
    <textarea rows={5} className={AREA} {...comum} />
  ) : (
    <input className={CAMPO} {...comum} />
  );
}

function Cartao({
  a,
  podeEditar,
  editar,
  apagar,
}: {
  a: Abordagem;
  podeEditar: boolean;
  editar: (p: Partial<Abordagem>) => void;
  apagar: () => void;
}) {
  const t = useT();
  const bloqueado = !podeEditar;
  return (
    <article className="grid content-start gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Etiqueta cor={COR_DO_STATUS_DO_CRIATIVO[a.status]}>
          {rotuloDoStatusDoCriativo(t, a.status)}
        </Etiqueta>
        <Etiqueta cor="blue">{rotuloDoMeio(t, a.medium)}</Etiqueta>
      </div>
      <Texto
        valor={a.name}
        aoGravar={(name) => name.trim() && editar({ name })}
        desabilitado={bloqueado}
        rotulo={t("Nome da abordagem")}
        max={160}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          className={CAMPO}
          disabled={bloqueado}
          value={a.medium}
          aria-label={t("Meio de contato")}
          onChange={(e) => editar({ medium: e.target.value as Abordagem["medium"] })}
        >
          {MEIOS_DA_ABORDAGEM.map((m) => (
            <option key={m} value={m}>
              {rotuloDoMeio(t, m)}
            </option>
          ))}
        </select>
        <select
          className={CAMPO}
          disabled={bloqueado}
          value={a.status}
          aria-label={t("Status")}
          onChange={(e) => editar({ status: e.target.value as Abordagem["status"] })}
        >
          {STATUS_DA_ABORDAGEM.map((s) => (
            <option key={s} value={s}>
              {rotuloDoStatusDoCriativo(t, s)}
            </option>
          ))}
        </select>
      </div>
      <Texto
        valor={a.audience}
        aoGravar={(audience) => editar({ audience })}
        desabilitado={bloqueado}
        rotulo={t("Para quem")}
        max={500}
      />
      <Texto
        valor={a.hook}
        aoGravar={(hook) => editar({ hook })}
        desabilitado={bloqueado}
        rotulo={t("Gancho (a primeira frase)")}
        max={500}
      />
      <Texto
        valor={a.script}
        aoGravar={(script) => editar({ script })}
        desabilitado={bloqueado}
        rotulo={t("Mensagem ou roteiro")}
        longo
        max={6000}
      />
      <Texto
        valor={a.follow_up}
        aoGravar={(follow_up) => editar({ follow_up })}
        desabilitado={bloqueado}
        rotulo={t("Follow-up")}
        longo
        max={6000}
      />
      <Texto
        valor={a.notes}
        aoGravar={(notes) => editar({ notes })}
        desabilitado={bloqueado}
        rotulo={t("Observações")}
        max={2000}
      />
      {podeEditar ? (
        <div className="flex justify-end">
          <button
            type="button"
            aria-label={t("Apagar abordagem")}
            onClick={() => {
              if (window.confirm(t("Apagar esta abordagem?"))) apagar();
            }}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
          >
            <Trash size={16} aria-hidden />
          </button>
        </div>
      ) : null}
    </article>
  );
}

/** As ABORDAGENS da campanha de contato direto: o equivalente aos criativos de anúncio. */
export function AbordagensDaCampanha({
  campanhaId,
  podeEditar,
}: {
  campanhaId: string;
  podeEditar: boolean;
}) {
  const t = useT();
  const { abordagens, carregando, criar, editar, apagar } = useAbordagensDaCampanha(campanhaId);
  return (
    <section className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("Abordagens")}</h2>
        {podeEditar ? (
          <button
            type="button"
            onClick={() => void criar({ name: t("Nova abordagem") })}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium whitespace-nowrap text-primary-foreground"
          >
            <Plus size={14} weight="bold" aria-hidden />
            {t("Nova abordagem")}
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          "O que a equipe fala e como: meio, gancho, mensagem e follow-up. Os números de cada dia vão na página Dia a dia.",
        )}
      </p>
      {carregando ? (
        <div className="h-24 animate-pulse rounded-xl bg-secondary" aria-busy="true" />
      ) : abordagens.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {t("Nenhuma abordagem ainda. Crie a primeira.")}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {abordagens.map((a) => (
            <Cartao
              key={a.id}
              a={a}
              podeEditar={podeEditar}
              editar={(p) => void editar(a.id, p)}
              apagar={() => void apagar(a.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
