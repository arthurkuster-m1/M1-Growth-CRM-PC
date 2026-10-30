"use client";

import { useEffect, useState } from "react";

import {
  PipelineEditor,
  type EtapaDoFunil,
  type PipelineRow,
} from "@/app/app/settings/tenant/pipelines/_client";
import { AgentMappingSection } from "@/app/app/settings/tenant/pipelines/_mapping";
import { ancoraDasEtapas } from "@/app/app/settings/tenant/pipelines/_stages";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type Secao = "motivos" | "campos" | "agente";

/**
 * O resto da configuração do funil da campanha, em três seções: Motivos (vocabulário, motivos de
 * perda e ganho, regras de ganho e produto), Campos (os campos do lead neste funil) e Agente (para
 * onde o card vai em cada passo do atendimento). Vivia na tela Configurações › Funis, que saiu.
 *
 * Motivos e Campos só aparecem para admin — a ação que grava (`updatePipelineConfig`) recusa quem
 * não é. O Agente é manager+, como a rota dele.
 */
export function ConfiguracaoDoFunil({ pipelineId }: { pipelineId: string }) {
  const t = useT();
  const { user, activeOrg } = useAuth();
  const ehAdmin =
    (user.is_platform_admin && !user.support) || activeOrg?.role === "admin";
  const [secao, setSecao] = useState<Secao>(ehAdmin ? "motivos" : "agente");
  const [dados, setDados] = useState<{
    pipeline: PipelineRow;
    etapas: EtapaDoFunil[];
  } | null>(null);

  useEffect(() => {
    if (!activeOrg) return;
    let vivo = true;
    (async () => {
      const supabase = createClient();
      const [{ data: p }, { data: e }] = await Promise.all([
        supabase
          .from("crm_pipelines")
          .select("id, name, slug, vocabulary, settings")
          .eq("organization_id", activeOrg.orgId)
          .eq("id", pipelineId)
          .maybeSingle(),
        supabase
          .from("crm_stages")
          .select("id, pipeline_id, name, is_archived")
          .eq("organization_id", activeOrg.orgId)
          .eq("pipeline_id", pipelineId)
          .order("position", { ascending: true }),
      ]);
      if (vivo && p) {
        setDados({
          pipeline: p as unknown as PipelineRow,
          etapas: (e ?? []) as unknown as EtapaDoFunil[],
        });
      }
    })();
    return () => {
      vivo = false;
    };
  }, [activeOrg, pipelineId]);

  const abas: { id: Secao; rotulo: string }[] = [
    ...(ehAdmin
      ? ([
          { id: "motivos", rotulo: t("Motivos e regras") },
          { id: "campos", rotulo: t("Campos do lead") },
        ] as { id: Secao; rotulo: string }[])
      : []),
    { id: "agente", rotulo: t("Agente") },
  ];

  return (
    <section className="grid gap-3 rounded-xl border p-3">
      <div role="tablist" className="flex flex-wrap gap-1.5">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={secao === a.id}
            onClick={() => setSecao(a.id)}
            className={cn(
              "h-9 rounded-full px-3.5 text-sm font-medium transition-colors",
              secao === a.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-secondary/70",
            )}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      {secao === "agente" ? (
        <AgentMappingSection pipelineId={pipelineId} ancoraEtapas={ancoraDasEtapas(pipelineId)} />
      ) : dados ? (
        <PipelineEditor pipeline={dados.pipeline} etapas={dados.etapas} visao={secao} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("Carregando…")}</p>
      )}
    </section>
  );
}
