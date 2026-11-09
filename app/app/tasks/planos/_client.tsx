"use client";
/**
 * TAREFAS › PLANOS — onde o plano nasce, cresce e morre (#1752).
 *
 * Extendido com planos da plataforma (migration 0686): planos da agência que
 * aparecem para todos os tenants como referência, editáveis só pelo platform admin.
 */
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssignableMembers } from "@/hooks/inbox/useAssignableMembers";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { randomId } from "@/lib/random-id";
import { ArrowBendUpLeft, Plus, Trash } from "@/lib/ui/icons";
import type { PassoDePlano, PlanoDeTarefas } from "@/lib/tarefas/plano";
import { PRIORIDADES_DA_TAREFA, type PrioridadeDaTarefa } from "@/lib/tarefas/tipos";

const CHAVE_ORG = ["settings", "task-plans"] as const;
const CHAVE_PLATAFORMA = ["platform", "task-plans"] as const;

function rotuloDaPrioridade(t: (s: string) => string, p: string): string {
  if (p === "low") return t("Baixa");
  if (p === "high") return t("Alta");
  if (p === "urgent") return t("Urgente");
  return t("Média");
}

function novoPlano(): PlanoDeTarefas {
  return { id: randomId(), nome: "", descricao: null, passos: [novoPasso()] };
}

function novoPasso(): PassoDePlano {
  return {
    ordem: 1,
    titulo: "",
    descricao: null,
    vence_em_dias: 1,
    prioridade: "medium",
    atribuir_a: "dono_do_lead",
  };
}

type EstadoEditor = { alvo: "org" | "plataforma"; plano: PlanoDeTarefas };

export function PlanosDeTarefa({ embutido = false }: { embutido?: boolean } = {}) {
  const t = useT();
  const qc = useQueryClient();
  const { user } = useAuth();
  const ehPlatformAdmin = user.is_platform_admin && !user.support;

  const [rascunho, setRascunho] = useState<EstadoEditor | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const qOrg = useQuery({
    queryKey: CHAVE_ORG,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: { planos: PlanoDeTarefas[]; planos_da_plataforma: PlanoDeTarefas[] };
        }>("/api/v1/settings/task-plans")
      ).data,
  });

  const qPlataforma = useQuery({
    queryKey: CHAVE_PLATAFORMA,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { planos: PlanoDeTarefas[] } }>(
          "/api/v1/platform/task-plans",
        )
      ).data,
    enabled: ehPlatformAdmin,
  });

  const salvarOrg = useMutation({
    mutationFn: async (planos: PlanoDeTarefas[]) =>
      (
        await apiClient.patch<{ data: { planos: PlanoDeTarefas[] } }>(
          "/api/v1/settings/task-plans",
          { planos },
        )
      ).data,
    onSuccess: () => {
      setErro(null);
      setRascunho(null);
      void qc.invalidateQueries({ queryKey: CHAVE_ORG });
    },
    onError: (e: Error) => setErro(e.message),
  });

  const salvarPlataforma = useMutation({
    mutationFn: async (planos: PlanoDeTarefas[]) =>
      (
        await apiClient.patch<{ data: { planos: PlanoDeTarefas[] } }>(
          "/api/v1/platform/task-plans",
          { planos },
        )
      ).data,
    onSuccess: () => {
      setErro(null);
      setRascunho(null);
      void qc.invalidateQueries({ queryKey: CHAVE_PLATAFORMA });
      void qc.invalidateQueries({ queryKey: CHAVE_ORG });
    },
    onError: (e: Error) => setErro(e.message),
  });

  const planosOrg = qOrg.data?.planos ?? [];
  const planosPlataforma = ehPlatformAdmin
    ? (qPlataforma.data?.planos ?? qOrg.data?.planos_da_plataforma ?? [])
    : (qOrg.data?.planos_da_plataforma ?? []);

  const ocupado = salvarOrg.isPending || salvarPlataforma.isPending;

  function guardar() {
    if (!rascunho) return;
    const nome = rascunho.plano.nome.trim();
    if (!nome) {
      setErro(t("Dê um nome ao plano."));
      return;
    }
    if (rascunho.plano.passos.length === 0) {
      setErro(t("O plano precisa de pelo menos um passo."));
      return;
    }
    if (rascunho.plano.passos.some((p) => !p.titulo.trim())) {
      setErro(t("Escreva o título de todos os passos."));
      return;
    }

    const pronto: PlanoDeTarefas = {
      ...rascunho.plano,
      nome,
      descricao: rascunho.plano.descricao?.trim() ? rascunho.plano.descricao.trim() : null,
      passos: rascunho.plano.passos.map((p, i) => ({ ...p, ordem: i + 1 })),
    };

    if (rascunho.alvo === "plataforma") {
      const outraVez = planosPlataforma.some((p) => p.id === pronto.id);
      salvarPlataforma.mutate(
        outraVez
          ? planosPlataforma.map((p) => (p.id === pronto.id ? pronto : p))
          : [...planosPlataforma, pronto],
      );
    } else {
      const outraVez = planosOrg.some((p) => p.id === pronto.id);
      salvarOrg.mutate(
        outraVez ? planosOrg.map((p) => (p.id === pronto.id ? pronto : p)) : [...planosOrg, pronto],
      );
    }
  }

  function excluirOrg(plano: PlanoDeTarefas) {
    salvarOrg.mutate(planosOrg.filter((p) => p.id !== plano.id));
  }

  function excluirPlataforma(plano: PlanoDeTarefas) {
    salvarPlataforma.mutate(planosPlataforma.filter((p) => p.id !== plano.id));
  }

  function abrirEditor(alvo: "org" | "plataforma", plano?: PlanoDeTarefas) {
    setErro(null);
    setRascunho({
      alvo,
      plano: plano
        ? { ...plano, passos: plano.passos.map((p) => ({ ...p })) }
        : novoPlano(),
    });
  }

  return (
    <div className={embutido ? "space-y-4" : "mx-auto max-w-3xl space-y-4 p-6"}>
      {embutido ? null : (
        <div>
          <Link
            href="/app/tarefas"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-text"
          >
            <ArrowBendUpLeft size={14} aria-hidden />
            {t("Tarefas")}
          </Link>
        </div>
      )}

      {/* ── Planos da agência ────────────────────────────────────────── */}
      {(planosPlataforma.length > 0 || ehPlatformAdmin) && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{t("Planos da agência")}</h2>
              <p className="text-sm text-muted-foreground">
                {ehPlatformAdmin
                  ? t("Planos gerenciados pela agência — visíveis a todos os clientes.")
                  : t("Planos criados pela agência — disponíveis como referência.")}
              </p>
            </div>
            {ehPlatformAdmin && (
              <Button
                className="rounded-full"
                type="button"
                size="sm"
                onClick={() => abrirEditor("plataforma")}
              >
                <Plus size={14} weight="bold" aria-hidden />
                {t("Novo plano da agência")}
              </Button>
            )}
          </div>

          {qOrg.isLoading && <Skeleton className="h-24 w-full" />}

          {!qOrg.isLoading && planosPlataforma.length === 0 && ehPlatformAdmin && (
            <Card className="rounded-2xl p-5 text-sm text-muted-foreground">
              {t("Nenhum plano da agência cadastrado ainda.")}
            </Card>
          )}

          {planosPlataforma.map((plano) => (
            <CartaoDoPlano
              key={plano.id}
              plano={plano}
              badge={t("Agência")}
              podeEditar={ehPlatformAdmin}
              onEditar={() => abrirEditor("plataforma", plano)}
              onExcluir={ehPlatformAdmin ? () => excluirPlataforma(plano) : undefined}
              t={t}
            />
          ))}
        </section>
      )}

      {/* ── Planos da organização ──────────────────────────────────── */}
      <section className="space-y-3">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {embutido ? (
              <h2 className="text-base font-semibold">{t("Planos de tarefa")}</h2>
            ) : (
              <h1 className="text-2xl font-semibold tracking-tight">{t("Planos de tarefa")}</h1>
            )}
            <p className="text-sm text-muted-foreground">
              {t(
                "Monte a sequência uma vez; a ação Aplicar um plano de tarefas aplica o plano ao negócio.",
              )}
            </p>
          </div>
          <Button
            className="rounded-full"
            type="button"
            onClick={() => abrirEditor("org")}
          >
            <Plus size={14} weight="bold" aria-hidden />
            {t("Novo plano")}
          </Button>
        </header>

        {erro ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
          >
            {erro}
          </p>
        ) : null}

        {rascunho ? (
          <Editor
            plano={rascunho.plano}
            onChange={(p) => setRascunho((s) => (s ? { ...s, plano: p } : null))}
            onCancelar={() => {
              setRascunho(null);
              setErro(null);
            }}
            onGuardar={guardar}
            ocupado={ocupado}
            titulo={
              rascunho.alvo === "plataforma" ? t("Editar plano da agência") : undefined
            }
          />
        ) : null}

        {qOrg.isLoading ? <Skeleton className="h-40 w-full" /> : null}

        {!qOrg.isLoading && planosOrg.length === 0 && !rascunho ? (
          <Card className="rounded-2xl p-5 text-sm text-muted-foreground">
            {t("Nenhum plano cadastrado ainda.")}
          </Card>
        ) : null}

        {planosOrg.map((plano) => (
          <CartaoDoPlano
            key={plano.id}
            plano={plano}
            podeEditar
            onEditar={() => abrirEditor("org", plano)}
            onExcluir={() => excluirOrg(plano)}
            t={t}
          />
        ))}
      </section>
    </div>
  );
}

function CartaoDoPlano({
  plano,
  badge,
  podeEditar,
  onEditar,
  onExcluir,
  t,
}: {
  plano: PlanoDeTarefas;
  badge?: string;
  podeEditar: boolean;
  onEditar: () => void;
  onExcluir?: () => void;
  t: (s: string) => string;
}) {
  return (
    <Card className="space-y-3 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{plano.nome}</h3>
            {badge && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {badge}
              </span>
            )}
          </div>
          {plano.descricao ? (
            <p className="text-sm text-muted-foreground">{plano.descricao}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          {podeEditar && (
            <Button className="rounded-full" type="button" variant="ghost" onClick={onEditar}>
              {t("Editar")}
            </Button>
          )}
          {onExcluir && (
            <Button className="rounded-full" type="button" variant="ghost" onClick={onExcluir}>
              {t("Excluir")}
            </Button>
          )}
        </div>
      </div>
      <ol className="space-y-1 text-sm text-muted-foreground">
        {plano.passos.map((passo) => (
          <li key={passo.ordem}>
            {passo.ordem}. {passo.titulo}
            {passo.descricao ? (
              <span className="ml-1 text-xs opacity-70">— {passo.descricao}</span>
            ) : null}
            {" — "}
            {t("Vence em (dias)")} {passo.vence_em_dias}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Editor({
  plano,
  onChange,
  onCancelar,
  onGuardar,
  ocupado,
  titulo,
}: {
  plano: PlanoDeTarefas;
  onChange: (p: PlanoDeTarefas) => void;
  onCancelar: () => void;
  onGuardar: () => void;
  ocupado: boolean;
  titulo?: string;
}) {
  const t = useT();
  const { data: members } = useAssignableMembers(true);

  function mudarPasso(indice: number, campo: Partial<PassoDePlano>) {
    onChange({
      ...plano,
      passos: plano.passos.map((p, i) => (i === indice ? { ...p, ...campo } : p)),
    });
  }

  return (
    <Card className="space-y-5 rounded-2xl p-5">
      {titulo && (
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {titulo}
        </h3>
      )}

      <div className="space-y-1">
        <Label htmlFor="plano-nome">{t("Nome do plano")}</Label>
        <Input
          className="rounded-xl bg-card"
          id="plano-nome"
          value={plano.nome}
          onChange={(e) => onChange({ ...plano, nome: e.target.value })}
          placeholder={t("Proposta enviada")}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="plano-descricao">{t("Descrição (opcional)")}</Label>
        <Textarea
          className="rounded-xl bg-card"
          id="plano-descricao"
          value={plano.descricao ?? ""}
          onChange={(e) => onChange({ ...plano, descricao: e.target.value })}
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">{t("Passos do plano")}</h3>
        {plano.passos.map((passo, indice) => (
          <div key={indice} className="space-y-3 rounded-2xl border bg-secondary/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-xs text-primary tabular-nums">
                  {indice + 1}
                </span>
                {t("Passo")} {indice + 1}
              </span>
              <Button
                className="rounded-full"
                type="button"
                variant="ghost"
                onClick={() =>
                  onChange({ ...plano, passos: plano.passos.filter((_, i) => i !== indice) })
                }
              >
                <Trash size={14} aria-hidden />
                {t("Remover passo")}
              </Button>
            </div>

            <div className="space-y-1">
              <Label htmlFor={`passo-titulo-${indice}`}>{t("Título")}</Label>
              <Input
                className="rounded-xl bg-card"
                id={`passo-titulo-${indice}`}
                value={passo.titulo}
                onChange={(e) => mudarPasso(indice, { titulo: e.target.value })}
                placeholder={t("Ligar para {{contact.name}} sobre {{lead.title}}")}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor={`passo-desc-${indice}`}>{t("Descrição do passo (opcional)")}</Label>
              <Textarea
                className="rounded-xl bg-card"
                id={`passo-desc-${indice}`}
                rows={2}
                value={passo.descricao ?? ""}
                onChange={(e) => mudarPasso(indice, { descricao: e.target.value || null })}
                placeholder={t("Instruções para quem for executar este passo")}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor={`passo-prazo-${indice}`}>{t("Vence em (dias)")}</Label>
                <Input
                  className="rounded-xl bg-card"
                  id={`passo-prazo-${indice}`}
                  type="number"
                  min={0}
                  max={365}
                  value={passo.vence_em_dias}
                  onChange={(e) => mudarPasso(indice, { vence_em_dias: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1">
                <Label>{t("Prioridade")}</Label>
                <Select
                  value={passo.prioridade}
                  onValueChange={(v) => mudarPasso(indice, { prioridade: v as PrioridadeDaTarefa })}
                >
                  <SelectTrigger className="rounded-xl bg-card">
                    <SelectValue placeholder={rotuloDaPrioridade(t, passo.prioridade)} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {PRIORIDADES_DA_TAREFA.map((p) => (
                      <SelectItem key={p} value={p}>
                        {rotuloDaPrioridade(t, p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>{t("Atribuir a")}</Label>
                <Select
                  value={
                    typeof passo.atribuir_a === "object"
                      ? passo.atribuir_a.usuario_id
                      : "dono_do_lead"
                  }
                  onValueChange={(v) =>
                    mudarPasso(indice, {
                      atribuir_a: v === "dono_do_lead" ? "dono_do_lead" : { usuario_id: v },
                    })
                  }
                >
                  <SelectTrigger className="rounded-xl bg-card">
                    <SelectValue placeholder={t("Dono do negócio")} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="dono_do_lead">{t("Dono do negócio")}</SelectItem>
                    {(members ?? []).map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.full_name ?? m.user_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}

        <Button
          className="rounded-full"
          type="button"
          variant="outline"
          onClick={() => onChange({ ...plano, passos: [...plano.passos, novoPasso()] })}
        >
          <Plus size={14} weight="bold" aria-hidden />
          {t("Adicionar passo")}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {t(
          "O que é salvo aqui é o que o editor de regras oferece na ação Aplicar um plano de tarefas.",
        )}
      </p>

      <div className="flex justify-end gap-2">
        <Button className="rounded-full" type="button" variant="ghost" onClick={onCancelar}>
          {t("Cancelar")}
        </Button>
        <Button className="rounded-full" type="button" onClick={onGuardar} disabled={ocupado}>
          {ocupado ? t("Salvando…") : t("Salvar plano")}
        </Button>
      </div>
    </Card>
  );
}
