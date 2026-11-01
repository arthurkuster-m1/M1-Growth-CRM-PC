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
    <div className="flex flex-wrap gap-1.5" data-testid="categorias-de-automacao">
      <button
        type="button"
        aria-pressed={categoria === "todas"}
        onClick={() => setCategoria("todas")}
        className={cn(
          "rounded-full border px-3 py-1 text-xs font-medium",
          categoria === "todas"
            ? "border-primary bg-primary/10 text-primary"
            : "hover:bg-secondary",
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
            "rounded-full border px-3 py-1 text-xs font-medium",
            categoria === c.id ? "border-primary bg-primary/10 text-primary" : "hover:bg-secondary",
          )}
        >
          {t(c.titulo)} ({contagem(c.id)})
        </button>
      ))}
    </div>
  );

  const modelosProntos = (
    <div className="space-y-2" data-testid="modelos-prontos">
      <p className="text-sm font-medium">{t("Modelos prontos")}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {modelosVisiveis.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => abrirModelo(m)}
            className="rounded-xl border border-border bg-card/50 p-3 text-left transition-colors hover:bg-secondary/60"
          >
            <span className="mb-1 block text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {t(tituloDaCategoria(m.categoria))}
            </span>
            <span className="block text-sm font-semibold">{t(m.titulo)}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{t(m.descricao)}</span>
          </button>
        ))}
      </div>
      {modelosVisiveis.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("Ainda não há modelo pronto nesta categoria.")}
        </p>
      ) : null}
    </div>
  );
  const modelosDeTag = (
    <>
      {filtroDeCategoria}
      {modelosProntos}
    </>
  );

  if (isLoading) {
    return (
      <div className="grid gap-3 pt-4 sm:grid-cols-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="space-y-6 pt-6">
        {modelosDeTag}
        <div className="flex justify-center pt-4">
          <Card className="max-w-md">
            <CardHeader className="items-center text-center">
              <Robot className="mb-2 h-10 w-10 text-accent" />
              <CardTitle>{t("Crie sua primeira automação")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                {t("Ex.: quando entrar um contato novo, enviar uma mensagem de boas-vindas.")}
              </p>
              <Button onClick={openCreate}>
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
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      {modelosDeTag}
      <div className="flex sm:justify-end">
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus /> {t("Nova automação")}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {regrasVisiveis.map((r) => (
          <Card key={r.id}>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="truncate">{r.name}</CardTitle>
                <Badge variant={r.is_active ? "success" : "neutral"}>
                  {r.is_active ? t("Ativa") : t("Pausada")}
                </Badge>
              </div>
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {t(tituloDaCategoria(categoriaDaRegra(r)))}
              </p>
              <p className="text-xs text-muted-foreground">{triggerLabel(r.trigger_event, t)}</p>
              <p className="text-xs text-muted-foreground">
                {r.actions.length} {r.actions.length === 1 ? t("ação") : t("ações")}
              </p>
              {/* Uma regra ligada roda sozinha para sempre: quem a ligou é parte
                  do estado dela, não um detalhe de auditoria. */}
              <SeloDeAutoria kind={r.last_change_actor_kind} em={r.last_change_at} />
            </CardHeader>
            <CardContent className="grid gap-3">
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
        <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
          {t("Nenhuma automação nesta categoria ainda. Escolha um modelo pronto acima.")}
        </p>
      ) : null}

      {fluxosVisiveis.length > 0 ? (
        <div className="space-y-2" data-testid="followups-na-central">
          <p className="text-sm font-medium">{t("Follow-ups da IA")}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {fluxosVisiveis.map((f) => (
              <Link
                key={f.id}
                href={`/app/ai/followups/${f.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-3 transition-colors hover:bg-secondary/60"
              >
                <FlowArrow size={18} aria-hidden className="shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{f.name}</span>
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
        </div>
      ) : null}

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
