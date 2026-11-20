"use client";
import * as React from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Robot, Plus, Trash, PencilSimple, FlowArrow, GitBranch } from "@/lib/ui/icons";
import Link from "next/link";
import { SeloDeAutoria } from "@/components/operacao/SeloDeAutoria";
import {
  useAutomationRules,
  useUpdateAutomationRule,
  useDeleteAutomationRule,
  type AutomationRuleRow,
} from "@/hooks/webhooks/useAutomationRules";
import { TRIGGER_LABELS, type TriggerEvent } from "./labels";
import { RuleEditor } from "./RuleEditor";
import { useT } from "@/hooks/i18n/useT";
import { FluxoVertical } from "@/components/automacoes/FluxoVertical";
import { useFollowupFlows } from "@/hooks/followup/useFollowupFlows";
import {
  CATEGORIAS_DE_AUTOMACAO,
  categoriaDaRegra,
  categoriaDoFluxo,
  tituloDaCategoria,
  type CategoriaDeAutomacao,
} from "@/lib/automation/categorias";
import type { ModeloDeRegra } from "@/lib/automation/modelos-de-tag";
import { MODELOS_DA_CENTRAL } from "@/lib/automation/modelos-prontos";
import { passosDaRegra } from "@/lib/automation/passos-da-regra";
import { cn } from "@/lib/utils";
import { ACTION_LABELS, type ActionType } from "./labels";

const RULES_QUERY_KEY = ["automation-rules"];

function triggerLabel(trigger: string, t: (texto: string) => string): string {
  return t(TRIGGER_LABELS[trigger as TriggerEvent] ?? trigger);
}

export function RulesTab() {
  const t = useT();
  const { data, isLoading } = useAutomationRules();
  const update = useUpdateAutomationRule();
  const del = useDeleteAutomationRule();
  const qc = useQueryClient();

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AutomationRuleRow | null>(null);
  const [modelo, setModelo] = React.useState<ModeloDeRegra["regra"] | null>(null);
  const [deleting, setDeleting] = React.useState<AutomationRuleRow | null>(null);
  const [categoria, setCategoria] = React.useState<CategoriaDeAutomacao | "todas">("todas");
  const [comFluxo, setComFluxo] = React.useState<Record<string, boolean>>({});
  // Os follow-ups da IA: vivem em outro motor, mas aparecem aqui na mesma lista (só leitura).
  const fluxos = useFollowupFlows();

  const rules = data?.data ?? [];

  const toggleActive = (rule: AutomationRuleRow, checked: boolean) => {
    qc.setQueryData<{ data: AutomationRuleRow[] }>(RULES_QUERY_KEY, (old) =>
      old
        ? { data: old.data.map((r) => (r.id === rule.id ? { ...r, is_active: checked } : r)) }
        : old,
    );
    update.mutate(
      { id: rule.id, is_active: checked },
      {
        onSuccess: () => toast.success(checked ? t("Automação ligada.") : t("Automação pausada.")),
        onError: () => qc.invalidateQueries({ queryKey: RULES_QUERY_KEY }),
      },
    );
  };

  const openCreate = () => {
    setEditing(null);
    setModelo(null);
    setEditorOpen(true);
  };

  const abrirModelo = (m: ModeloDeRegra) => {
    setEditing(null);
    setModelo(m.regra);
    setEditorOpen(true);
  };

  const openEdit = (rule: AutomationRuleRow) => {
    setModelo(null);
    setEditing(rule);
    setEditorOpen(true);
  };

  const fluxosDeFollowup = fluxos.data ?? [];
  const contagem = (c: CategoriaDeAutomacao) =>
    rules.filter((r) => categoriaDaRegra(r) === c).length +
    fluxosDeFollowup.filter((f) => categoriaDoFluxo(f.name) === c).length;
  const regrasVisiveis = rules.filter(
    (r) => categoria === "todas" || categoriaDaRegra(r) === categoria,
  );
  const fluxosVisiveis = fluxosDeFollowup.filter(
    (f) => categoria === "todas" || categoriaDoFluxo(f.name) === categoria,
  );
  const modelosVisiveis = MODELOS_DA_CENTRAL.filter(
    (m) => categoria === "todas" || m.categoria === categoria,
  );

  const filtroDeCategoria = (
    <div className="flex flex-wrap gap-2" data-testid="categorias-de-automacao">
      <button
        type="button"
        aria-pressed={categoria === "todas"}
        onClick={() => setCategoria("todas")}
        className={cn(
          "h-9 rounded-full border px-4 text-sm font-medium transition-colors",
          categoria === "todas"
            ? "border-deep bg-deep font-bold text-deep-foreground"
            : "bg-card text-foreground hover:bg-secondary",
        )}
      >
        {t("Todas")} ({rules.length + fluxosDeFollowup.length})
      </button>
      {CATEGORIAS_DE_AUTOMACAO.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={categoria === c.id}
          title={t(c.descricao)}
          onClick={() => setCategoria(c.id)}
          className={cn(
            "h-9 rounded-full border px-4 text-sm font-medium transition-colors",
            categoria === c.id
              ? "border-deep bg-deep font-bold text-deep-foreground"
              : "bg-card text-foreground hover:bg-secondary",
          )}
        >
          {t(c.titulo)} ({contagem(c.id)})
        </button>
      ))}
    </div>
  );

  const modelosProntos = (
    <section className="space-y-3" data-testid="modelos-prontos">
      <div>
        <h2 className="text-lg font-bold tracking-tight">{t("Modelos prontos")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("Comece por um modelo e ajuste do seu jeito.")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modelosVisiveis.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => abrirModelo(m)}
            className="group flex items-start gap-3 rounded-[22px] border border-border bg-card p-4 text-left shadow-xs transition-[border-color,box-shadow] hover:border-accent hover:shadow-md"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-primary">
              <Plus size={16} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="mb-0.5 block text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                {t(tituloDaCategoria(m.categoria))}
              </span>
              <span className="block text-sm font-bold">{t(m.titulo)}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{t(m.descricao)}</span>
            </span>
          </button>
        ))}
      </div>
      {modelosVisiveis.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("Ainda não há modelo pronto nesta categoria.")}
        </p>
      ) : null}
    </section>
  );

  if (isLoading) {
    return (
      <div className="grid gap-3 pt-4 sm:grid-cols-2">
        <Skeleton className="h-24 w-full rounded-[22px]" />
        <Skeleton className="h-24 w-full rounded-[22px]" />
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="space-y-6 pt-2">
        {filtroDeCategoria}
        <div className="flex">
          <Card className="w-full">
            <CardHeader className="items-center text-center">
              <span className="mb-1 grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-primary">
                <Robot className="h-7 w-7" />
              </span>
              <CardTitle className="text-lg">{t("Crie sua primeira automação")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                {t("Ex.: quando entrar um contato novo, enviar uma mensagem de boas-vindas.")}
              </p>
              <Button onClick={openCreate} size="lg">
                <Plus /> {t("Nova automação")}
              </Button>
            </CardContent>
          </Card>
          <RuleEditor
            open={editorOpen}
            onOpenChange={setEditorOpen}
            rule={editing}
            modelo={modelo}
          />
        </div>
        {modelosProntos}
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {filtroDeCategoria}
        <Button onClick={openCreate} size="lg" className="w-full sm:w-auto">
          <Plus /> {t("Nova automação")}
        </Button>
      </div>
      <h2 className="-mb-2 text-lg font-bold tracking-tight">{t("Suas automações")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {regrasVisiveis.map((r) => (
          <Card key={r.id} className="flex flex-col">
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-primary">
                  <FlowArrow size={20} aria-hidden />
                </span>
                <Badge variant={r.is_active ? "success" : "neutral"}>
                  {r.is_active ? t("Ativa") : t("Pausada")}
                </Badge>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  {t(tituloDaCategoria(categoriaDaRegra(r)))}
                </p>
                <CardTitle className="mt-0.5 truncate text-base">{r.name}</CardTitle>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                  {triggerLabel(r.trigger_event, t)}
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {r.actions.length} {r.actions.length === 1 ? t("ação") : t("ações")}
                </span>
              </div>
              {/* Uma regra ligada roda sozinha para sempre: quem a ligou é parte
                  do estado dela, não um detalhe de auditoria. */}
              <SeloDeAutoria kind={r.last_change_actor_kind} em={r.last_change_at} />
            </CardHeader>
            <CardContent className="mt-auto grid gap-3 border-t pt-4">
              {comFluxo[r.id] ? (
                <FluxoVertical
                  passos={passosDaRegra(r, {
                    gatilho: (id) => triggerLabel(id, t),
                    acao: (id) => t(ACTION_LABELS[id as ActionType] ?? id),
                  })}
                />
              ) : null}
              <button
                type="button"
                aria-expanded={!!comFluxo[r.id]}
                onClick={() => setComFluxo((a) => ({ ...a, [r.id]: !a[r.id] }))}
                className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-primary hover:underline"
              >
                <GitBranch size={14} aria-hidden />
                {comFluxo[r.id] ? t("Esconder o fluxo") : t("Ver como fluxo")}
              </button>
              <div className="flex items-center justify-between gap-2">
                <Switch
                  checked={r.is_active}
                  disabled={update.isPending}
                  onCheckedChange={(checked) => toggleActive(r, checked)}
                  aria-label={`${r.is_active ? t("Pausar") : t("Ligar")} ${r.name}`}
                />
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(r)}
                    aria-label={t("Editar automação")}
                  >
                    <PencilSimple />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleting(r)}
                    aria-label={t("Excluir automação")}
                  >
                    <Trash />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {regrasVisiveis.length === 0 ? (
        <p className="rounded-[22px] border border-dashed bg-card p-6 text-sm text-muted-foreground">
          {t("Nenhuma automação nesta categoria ainda. Escolha um modelo pronto acima.")}
        </p>
      ) : null}

      {fluxosVisiveis.length > 0 ? (
        <section className="space-y-3" data-testid="followups-na-central">
          <h2 className="text-lg font-bold tracking-tight">{t("Follow-ups da IA")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fluxosVisiveis.map((f) => (
              <Link
                key={f.id}
                href={`/app/ai/followups/${f.id}`}
                className="flex items-center gap-3 rounded-[22px] border border-border bg-card p-4 shadow-xs transition-[border-color,box-shadow] hover:border-accent hover:shadow-md"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-primary">
                  <FlowArrow size={18} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{f.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t(tituloDaCategoria(categoriaDoFluxo(f.name)))}
                  </span>
                </span>
                <Badge variant={f.status === "active" ? "success" : "neutral"}>
                  {f.status === "active"
                    ? t("Ativo")
                    : f.status === "draft"
                      ? t("Rascunho")
                      : t("Pausado")}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {modelosProntos}

      <RuleEditor open={editorOpen} onOpenChange={setEditorOpen} rule={editing} modelo={modelo} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Excluir esta automação?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.name} {t("para de rodar imediatamente. Essa ação não pode ser desfeita.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                await del.mutateAsync(deleting.id);
                toast.success(t("Automação excluída."));
                setDeleting(null);
              }}
            >
              {t("Excluir")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
