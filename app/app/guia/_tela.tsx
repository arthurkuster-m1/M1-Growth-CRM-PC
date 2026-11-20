"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import {
  FASES,
  MODELOS_DE_VENDA,
  NICHOS,
  type Diagnostico,
  type EstadoDoPasso,
  type FaseDoGuia,
  type ModeloDeVenda,
  type Nicho,
  type PassoDiagnosticado,
} from "@/lib/guia/tipos";
import { cn } from "@/lib/utils";

type Traduzir = (texto: string) => string;

function rotuloDaFase(t: Traduzir, fase: FaseDoGuia): string {
  switch (fase) {
    case "cadastros":
      return t("0 · Cadastros essenciais");
    case "diagnostico":
      return t("1 · Diagnóstico");
    case "produto-e-oferta":
      return t("2 · Produto e oferta");
    case "captacao":
      return t("3 · Captação");
    case "venda":
      return t("4 · Venda e atendimento");
    case "demanda":
      return t("5 · Geração de demanda");
    case "operacao":
      return t("6 · Operação semanal");
    case "otimizacao":
      return t("7 · Otimização contínua");
  }
}

function rotuloDoNicho(t: Traduzir, n: Nicho): string {
  switch (n) {
    case "clinica":
      return t("Clínica");
    case "servico":
      return t("Serviço / agência / B2B");
    case "imobiliaria":
      return t("Imobiliária");
    case "loja":
      return t("Loja");
    case "infoproduto":
      return t("Infoproduto");
  }
}

function rotuloDoModelo(t: Traduzir, m: ModeloDeVenda): string {
  switch (m) {
    case "agendamento":
      return t("Agendamento / reunião");
    case "whatsapp":
      return t("Venda direta no WhatsApp");
    case "checkout":
      return t("Checkout / e-commerce");
    case "lancamento":
      return t("Lançamento ou perpétuo");
  }
}

function rotuloDoEstado(t: Traduzir, e: EstadoDoPasso): string {
  switch (e) {
    case "feito":
      return t("Feito");
    case "em_andamento":
      return t("Em andamento");
    case "falta":
      return t("Falta");
    case "bloqueado":
      return t("Bloqueado");
    case "desatualizado":
      return t("Desatualizado");
    case "nao_se_aplica":
      return t("Não se aplica");
    case "dispensado":
      return t("Dispensado");
    case "nao_verificado":
      return t("Não consegui verificar");
  }
}

const COR_DO_ESTADO: Record<EstadoDoPasso, string> = {
  feito: "bg-success-bg text-success-fg",
  em_andamento: "bg-secondary text-foreground",
  falta: "bg-warning-bg text-warning-fg",
  bloqueado: "bg-secondary text-muted-foreground",
  desatualizado: "bg-warning-bg text-warning-fg",
  nao_se_aplica: "bg-secondary text-muted-foreground",
  dispensado: "bg-secondary text-muted-foreground",
  nao_verificado: "bg-secondary text-muted-foreground",
};

function Selo({ estado }: { estado: EstadoDoPasso }) {
  const t = useT();
  return (
    <span
      className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", COR_DO_ESTADO[estado])}
    >
      {rotuloDoEstado(t, estado)}
    </span>
  );
}

function Passo({ p, destaque }: { p: PassoDiagnosticado; destaque?: boolean }) {
  const t = useT();
  return (
    <li
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border bg-card px-4 py-3",
        destaque && "shadow-sm",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            <span className="mr-1.5 text-xs text-muted-foreground">{p.id}</span>
            {p.titulo}
            {p.classificacao === "E" ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {t("essencial")}
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">{p.porque}</p>
        </div>
        <Selo estado={p.estado} />
      </div>
      <p className="text-xs text-muted-foreground">
        {t("Como sei:")} {p.evidencia}
        {p.aguardando.length > 0 ? ` · ${t("Antes, falta")}: ${p.aguardando.join(", ")}` : ""}
      </p>
      <Link href={p.onde.href} className="w-fit text-xs font-medium text-primary hover:underline">
        {t("Abrir")}: {p.onde.rotulo}
      </Link>
    </li>
  );
}

function montarUrl(nicho: Nicho | "", modelos: ModeloDeVenda[], jaTemOferta: boolean): string {
  if (!nicho) return "/api/v1/guia/diagnostico";
  const q = new URLSearchParams({ nicho });
  if (modelos.length > 0) q.set("modelos", modelos.join(","));
  if (jaTemOferta) q.set("ja_tem_oferta", "1");
  return `/api/v1/guia/diagnostico?${q.toString()}`;
}

/**
 * A tela PROVISÓRIA do Guia (G1): escolhe um perfil de teste, lê o diagnóstico e mostra a prontidão,
 * os próximos passos e o mapa completo. O perfil ainda não é gravado (G2).
 */
export function GuiaTela() {
  const t = useT();
  const [nicho, setNicho] = useState<Nicho | "">("");
  const [modelos, setModelos] = useState<ModeloDeVenda[]>([]);
  const [jaTemOferta, setJaTemOferta] = useState(false);
  const [verTodos, setVerTodos] = useState(false);

  const q = useQuery({
    queryKey: ["guia", "diagnostico", nicho, modelos, jaTemOferta],
    queryFn: async () =>
      (await apiClient.get<{ data: Diagnostico }>(montarUrl(nicho, modelos, jaTemOferta))).data,
    retry: false,
  });

  const alternarModelo = (m: ModeloDeVenda) =>
    setModelos((atual) => (atual.includes(m) ? atual.filter((x) => x !== m) : [...atual, m]));

  const d = q.data;
  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-xl border border-dashed px-4 py-3 text-xs text-muted-foreground">
        {t(
          "Versão provisória: escolha o perfil do cliente para ver o diagnóstico. Na próxima etapa o perfil passa a ficar gravado na empresa.",
        )}
      </p>

      <section
        aria-label={t("Perfil do cliente")}
        className="grid gap-3 rounded-2xl border bg-card p-4"
      >
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{t("Nicho")}</span>
          <select
            value={nicho}
            onChange={(e) => setNicho(e.target.value as Nicho | "")}
            className="h-10 rounded-xl border bg-background px-3 text-sm"
          >
            <option value="">{t("Sem perfil ainda")}</option>
            {NICHOS.map((n) => (
              <option key={n} value={n}>
                {rotuloDoNicho(t, n)}
              </option>
            ))}
          </select>
        </label>
        {nicho ? (
          <>
            <fieldset className="grid gap-1.5 text-sm">
              <legend className="mb-1 font-medium">{t("Como vende")}</legend>
              {MODELOS_DE_VENDA.map((m) => (
                <label key={m} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={modelos.includes(m)}
                    onChange={() => alternarModelo(m)}
                  />
                  {rotuloDoModelo(t, m)}
                </label>
              ))}
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={jaTemOferta}
                onChange={(e) => setJaTemOferta(e.target.checked)}
              />
              {t("Já tem oferta pronta e quer começar pela campanha")}
            </label>
          </>
        ) : null}
      </section>

      {q.isLoading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-secondary" aria-busy="true" />
      ) : q.isError || !d ? (
        <p
          role="alert"
          className="rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning-fg"
        >
          {t("Não foi possível montar o diagnóstico agora.")}
        </p>
      ) : (
        <>
          <section
            aria-label={t("Prontidão")}
            className="grid gap-3 rounded-2xl border bg-card p-4"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold">{t("Prontidão do marketing")}</h2>
              <span className="text-2xl font-semibold">
                {d.prontidao.geral === null ? "—" : `${d.prontidao.geral}%`}
              </span>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {FASES.filter((f) => d.prontidao.porFase[f].pct !== null).map((f) => {
                const fase = d.prontidao.porFase[f];
                return (
                  <li key={f} className="grid gap-1">
                    <div className="flex justify-between text-xs">
                      <span>{rotuloDaFase(t, f)}</span>
                      <span className="text-muted-foreground">
                        {fase.feitos}/{fase.total} · {fase.pct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${fase.pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {d.naoVerificados.length > 0 ? (
            <p className="rounded-xl bg-secondary px-4 py-3 text-xs text-muted-foreground">
              {t("Não consegui verificar")} {d.naoVerificados.length}{" "}
              {d.naoVerificados.length === 1 ? t("passo") : t("passos")}:{" "}
              {d.naoVerificados.join(", ")}.
            </p>
          ) : null}

          <section aria-label={t("Próximos passos")} className="grid gap-3">
            <h2 className="text-base font-semibold">{t("Próximos passos")}</h2>
            {d.proximos.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("Nada pendente agora.")}</p>
            ) : (
              <ul className="grid gap-2">
                {d.proximos.map((p) => (
                  <Passo key={p.id} p={p} destaque />
                ))}
              </ul>
            )}
          </section>

          <section aria-label={t("Mapa completo")} className="grid gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{t("Mapa completo")}</h2>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={verTodos}
                  onChange={(e) => setVerTodos(e.target.checked)}
                />
                {t("Mostrar também o que não se aplica e o opcional")}
              </label>
            </div>
            {FASES.map((f) => {
              const passos = d.passos.filter(
                (p) =>
                  p.fase === f &&
                  (verTodos || (p.estado !== "nao_se_aplica" && p.classificacao !== "O")),
              );
              if (passos.length === 0) return null;
              return (
                <div key={f} className="grid gap-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {rotuloDaFase(t, f)}
                  </h3>
                  <ul className="grid gap-2">
                    {passos.map((p) => (
                      <Passo key={p.id} p={p} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
