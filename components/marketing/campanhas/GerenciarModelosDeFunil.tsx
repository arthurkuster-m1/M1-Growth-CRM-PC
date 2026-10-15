"use client";

import { useState } from "react";

import { SeletorEmPopup } from "@/components/ui/SeletorEmPopup";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { EtapaDoModelo } from "@/lib/marketing/modelos-de-funil";
import { Plus, Trash } from "@/lib/ui/icons";

export interface ModeloGerenciavel {
  id: string;
  name: string;
  stages: unknown[];
}

type Tipo = "aberta" | "mql" | "desqualificada" | "ganha" | "perdida";

const tipoDe = (e: EtapaDoModelo): Tipo =>
  e.is_won ? "ganha" : e.is_lost ? "perdida" : e.qualification === "mql" ? "mql" : e.qualification === "disqualified" ? "desqualificada" : "aberta";

function aplicarTipo(e: EtapaDoModelo, tipo: Tipo): EtapaDoModelo {
  return {
    ...e,
    is_won: tipo === "ganha",
    is_lost: tipo === "perdida",
    qualification: tipo === "mql" ? "mql" : tipo === "desqualificada" ? "disqualified" : null,
  };
}

const CAMPO =
  "h-9 w-full rounded-lg border bg-background px-2 text-sm outline-hidden focus:border-primary/60";

/**
 * Editar e apagar os MODELOS DE FUNIL: renomear, mudar as etapas (nome, tipo, ordem) ou excluir.
 * Apagar um modelo não mexe nos funis que já nasceram dele.
 */
export function GerenciarModelosDeFunil({
  modelos,
  aoFechar,
  aoMudar,
}: {
  modelos: ModeloGerenciavel[];
  aoFechar: () => void;
  aoMudar: () => Promise<void> | void;
}) {
  const t = useT();
  const [editando, setEditando] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [etapas, setEtapas] = useState<EtapaDoModelo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function abrir(m: ModeloGerenciavel) {
    setEditando(m.id);
    setNome(m.name);
    setEtapas(m.stages as EtapaDoModelo[]);
    setErro(null);
  }

  async function salvar() {
    if (!editando) return;
    setSalvando(true);
    setErro(null);
    try {
      await apiClient.patch(`/api/v1/demand-funnel-templates/${editando}`, {
        name: nome.trim(),
        stages: etapas.map((e) => ({ ...e, name: e.name.trim() })).filter((e) => e.name !== ""),
      });
      await aoMudar();
      setEditando(null);
    } catch {
      setErro(t("Não foi possível salvar o modelo (o nome pode já existir)."));
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(m: ModeloGerenciavel) {
    if (!window.confirm(t("Apagar este modelo? Os funis já criados com ele não mudam."))) return;
    try {
      await apiClient.delete(`/api/v1/demand-funnel-templates/${m.id}`);
      await aoMudar();
      if (editando === m.id) setEditando(null);
    } catch {
      setErro(t("Não foi possível apagar o modelo."));
    }
  }

  const mover = (i: number, d: -1 | 1) =>
    setEtapas((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const c = [...l];
      [c[i], c[j]] = [c[j]!, c[i]!];
      return c;
    });

  const opcoesDeTipo = [
    { id: "aberta", rotulo: t("Aberta") },
    { id: "mql", rotulo: t("Qualificada (MQL)") },
    { id: "desqualificada", rotulo: t("Desqualificada") },
    { id: "ganha", rotulo: t("Comprou") },
    { id: "perdida", rotulo: t("Não comprou") },
  ];

  return (
    <Dialog open onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Modelos de funil")}</DialogTitle>
          <DialogDescription>
            {t("Renomeie, edite as etapas ou apague. Funis já criados não mudam.")}
          </DialogDescription>
        </DialogHeader>
        {erro ? <p className="rounded-lg bg-error-bg px-3 py-2 text-xs text-error-fg">{erro}</p> : null}
        {editando ? (
          <div className="grid gap-3">
            <label className="grid gap-1 text-xs text-muted-foreground">
              {t("Nome do modelo")}
              <input value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} className={CAMPO} />
            </label>
            <div className="grid gap-2">
              {etapas.map((e, i) => (
                <div key={i} className="grid grid-cols-[1fr_11rem_auto] items-center gap-2">
                  <input
                    value={e.name}
                    maxLength={80}
                    aria-label={`${t("Etapa")} ${i + 1}`}
                    onChange={(ev) =>
                      setEtapas((l) => l.map((x, k) => (k === i ? { ...x, name: ev.target.value } : x)))
                    }
                    className={CAMPO}
                  />
                  <SeletorEmPopup
                    rotulo={t("Tipo da etapa")}
                    valor={tipoDe(e)}
                    opcoes={opcoesDeTipo}
                    aoEscolher={(v) =>
                      setEtapas((l) => l.map((x, k) => (k === i ? aplicarTipo(x, v as Tipo) : x)))
                    }
                    className="min-h-9 rounded-lg"
                  />
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label={t("Subir")} disabled={i === 0} onClick={() => mover(i, -1)} className="h-8 w-8 rounded-md border text-xs hover:bg-secondary disabled:opacity-30">↑</button>
                    <button type="button" aria-label={t("Descer")} disabled={i === etapas.length - 1} onClick={() => mover(i, 1)} className="h-8 w-8 rounded-md border text-xs hover:bg-secondary disabled:opacity-30">↓</button>
                    <button type="button" aria-label={t("Tirar etapa")} disabled={etapas.length === 1} onClick={() => setEtapas((l) => l.filter((_, k) => k !== i))} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:text-error-fg disabled:opacity-30">
                      <Trash size={14} aria-hidden />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setEtapas((l) => [
                    ...l,
                    { name: "", is_won: false, is_lost: false, win_probability: null, expected_duration_hours: null, qualification: null },
                  ])
                }
                className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-secondary"
              >
                <Plus size={14} aria-hidden />
                {t("Adicionar etapa")}
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditando(null)} className="h-9 rounded-xl border px-4 text-sm font-medium hover:bg-secondary">
                {t("Voltar")}
              </button>
              <button type="button" disabled={salvando || nome.trim() === ""} onClick={() => void salvar()} className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {t("Salvar modelo")}
              </button>
            </div>
          </div>
        ) : (
          <ul className="grid gap-2">
            {modelos.length === 0 ? (
              <li className="text-sm text-muted-foreground">{t("Nenhum modelo ainda.")}</li>
            ) : null}
            {modelos.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
                <span className="min-w-0 truncate text-sm font-medium">
                  {m.name} <span className="font-normal text-muted-foreground">({m.stages.length} {t("etapas")})</span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => abrir(m)} className="h-8 rounded-lg border px-3 text-xs font-medium hover:bg-secondary">
                    {t("Editar")}
                  </button>
                  <button type="button" onClick={() => void apagar(m)} className="h-8 rounded-lg border px-3 text-xs font-medium text-error-fg hover:bg-error-bg">
                    {t("Excluir")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
