"use client";

import { useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import { useDiagnosticoDoGuia } from "@/hooks/guia/useDiagnosticoDoGuia";
import { ApiError } from "@/lib/api/types";
import { FASES } from "@/lib/guia/tipos";

import { DossieEIa } from "./_dossie";
import { FormularioDoPerfil } from "./_perfil";
import { PassoDoGuia } from "./_passo";
import { rotuloDaFase } from "./_rotulos";

/**
 * A tela do Guia: pede o perfil na primeira vez, mostra a prontidão, os próximos passos e o mapa
 * completo, e deixa dispensar, marcar como feito e criar tarefa em cada passo.
 */
export function GuiaTela() {
  const t = useT();
  const q = useDiagnosticoDoGuia();
  const [verTodos, setVerTodos] = useState(false);
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [aba, setAba] = useState<"guia" | "dossie">("guia");

  if (q.isLoading)
    return <div className="h-40 animate-pulse rounded-3xl bg-secondary" aria-busy="true" />;

  if (q.isError || !q.data) {
    const semMigration = q.error instanceof ApiError && q.error.code === "guia_sem_migration";
    return (
      <p
        role="alert"
        className="rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning-fg"
      >
        {semMigration
          ? t("O banco ainda não recebeu a atualização do Guia. Peça para aplicá-la na VPS.")
          : t("Não foi possível montar o diagnóstico agora.")}
      </p>
    );
  }

  const { perfil, diagnostico: d } = q.data;
  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label={t("Seções do Guia")}
        className="flex gap-1 rounded-xl bg-secondary p-1 text-sm"
      >
        {(
          [
            ["guia", t("Guia")],
            ["dossie", t("Dossiê e IA")],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={`flex-1 rounded-lg px-3 py-1.5 font-medium transition-colors ${aba === id ? "bg-card shadow-sm" : "text-muted-foreground"}`}
          >
            {rotulo}
          </button>
        ))}
      </div>
      {aba === "dossie" ? <DossieEIa /> : null}
      {aba === "guia" ? (
        <>
          <section
            aria-label={t("Perfil do cliente")}
            className="grid gap-3 rounded-2xl border bg-card p-4"
            data-testid="guia-perfil"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">{t("Perfil do negócio")}</h2>
              {perfil ? (
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setEditandoPerfil((v) => !v)}
                >
                  {editandoPerfil ? t("Fechar") : t("Editar")}
                </button>
              ) : null}
            </div>
            {!perfil ? (
              <p className="text-sm text-muted-foreground">
                {t(
                  "Conte como é o negócio: com isso o Guia sabe o que é essencial para este cliente.",
                )}
              </p>
            ) : null}
            {!perfil || editandoPerfil ? <FormularioDoPerfil perfil={perfil} /> : null}
          </section>

          {perfil ? (
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
          ) : null}

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
                  <PassoDoGuia key={p.id} p={p} destaque />
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
                      <PassoDoGuia key={p.id} p={p} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        </>
      ) : null}
    </div>
  );
}
