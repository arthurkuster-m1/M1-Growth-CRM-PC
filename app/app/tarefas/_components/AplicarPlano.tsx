"use client";

import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
import { useState } from "react";

import { CelulaDeCliente } from "./CelulaDeCliente";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { somarDias } from "@/lib/inicio/datas";
import { momentoDoDia } from "@/lib/tarefas/modelos";
import type { PlanoDeTarefas } from "@/lib/tarefas/plano";
import type { NovaTarefa } from "@/lib/tarefas/tipos";
import { TreeStructure } from "@/lib/ui/icons";


/**
 * APLICAR UM PLANO a um cliente: o plano é um "modelo parrudo" — várias tarefas de uma vez, todas
 * do mesmo cliente. Aqui se escolhe o cliente e se acertam as datas (que variam de cliente para
 * cliente): o início do plano e, se quiser, o prazo de cada tarefa. Criar grava todas, na ordem.
 */
export function AplicarPlano({
  plano,
  fuso,
  hoje,
  organizacao,
  aoFechar,
  aoCriar,
}: {
  plano: PlanoDeTarefas | null;
  fuso: string;
  /** Hoje no fuso da pessoa (AAAA-MM-DD). */
  hoje: string;
  organizacao: string;
  aoFechar: () => void;
  /** Cria as tarefas, nesta ordem, já com o cliente. */
  aoCriar: (tarefas: NovaTarefa[]) => Promise<void>;
}) {
  return (
    <Dialog open={plano !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[90dvh] max-w-xl gap-4 overflow-y-auto p-5 sm:rounded-2xl">
        {plano ? (
          // `key`: abrir outro plano começa do zero (cliente e datas).
          <Corpo
            key={plano.id}
            plano={plano}
            fuso={fuso}
            hoje={hoje}
            organizacao={organizacao}
            aoFechar={aoFechar}
            aoCriar={aoCriar}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Corpo({
  plano,
  fuso,
  hoje,
  organizacao,
  aoFechar,
  aoCriar,
}: {
  plano: PlanoDeTarefas;
  fuso: string;
  hoje: string;
  organizacao: string;
  aoFechar: () => void;
  aoCriar: (tarefas: NovaTarefa[]) => Promise<void>;
}) {
  const t = useT();
  const [cliente, setCliente] = useState<{ id: string | null; nome: string | null }>({
    id: null,
    nome: null,
  });
  const [inicio, setInicio] = useState(hoje);
  // Prazo alterado à mão por passo (`ordem` → dia). Os demais seguem o início do plano.
  const [prazos, setPrazos] = useState<Record<number, string>>({});
  const [criando, setCriando] = useState(false);

  const prazoDe = (ordem: number, dias: number) => prazos[ordem] ?? somarDias(inicio, dias);

  async function criar() {
    setCriando(true);
    try {
      await aoCriar(
        plano.passos.map((p) => {
          const tarefa: NovaTarefa = {
            title: p.titulo,
            priority: p.prioridade,
            due_date: momentoDoDia(prazoDe(p.ordem, p.vence_em_dias), "00:00", fuso).toISOString(),
          };
          if (p.descricao) tarefa.description = p.descricao;
          if (cliente.id) tarefa.contact_id = cliente.id;
          if (p.atribuir_a !== "dono_do_lead") tarefa.assigned_to = p.atribuir_a.usuario_id;
          return tarefa;
        }),
      );
      aoFechar();
    } finally {
      setCriando(false);
    }
  }

  return (
    <>
      <DialogTitle className="flex items-center gap-2 text-base font-semibold">
        <TreeStructure size={18} className="text-primary" aria-hidden />
        {plano.nome}
      </DialogTitle>
      <DialogDescription className="text-sm text-muted-foreground">
        {plano.descricao ||
          t("Escolha o cliente e acerte as datas: as tarefas do plano nascem todas juntas.")}
      </DialogDescription>

      <div className="grid gap-3">
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">{t("Cliente")}</span>
          <div className="rounded-xl border bg-card">
            <CelulaDeCliente
              contactId={cliente.id}
              nome={cliente.nome}
              organizacao={organizacao}
              podeEditar
              aoEscolher={setCliente}
            />
          </div>
        </div>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">{t("Início do plano")}</span>
          <CampoDeData
            valor={inicio}
            rotulo={t("Início do plano")}
            limpavel={false}
            aoMudar={(dia) => {
              if (!dia) return;
              setInicio(dia);
              // Mudar o início recalcula todos os prazos.
              setPrazos({});
            }}
          />
        </label>
      </div>

      <ol className="grid gap-2">
        {plano.passos.map((p) => (
          <li
            key={p.ordem}
            className="grid grid-cols-[1fr_9.5rem] items-center gap-3 rounded-xl border p-2 pl-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                <span className="mr-2 text-xs text-muted-foreground tabular-nums">
                  {String(p.ordem).padStart(2, "0")}
                </span>
                {p.titulo}
              </p>
              {p.descricao ? (
                <p className="truncate text-xs text-muted-foreground">{p.descricao}</p>
              ) : null}
            </div>
            <CampoDeData
              rotulo={`${t("Prazo")}: ${p.titulo}`}
              valor={prazoDe(p.ordem, p.vence_em_dias)}
              limpavel={false}
              aoMudar={(dia) => dia && setPrazos((a) => ({ ...a, [p.ordem]: dia }))}
            />
          </li>
        ))}
      </ol>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={aoFechar}>
          {t("Cancelar")}
        </Button>
        <Button disabled={criando} onClick={() => void criar()}>
          {criando
            ? t("Criando…")
            : `${t("Criar")} ${plano.passos.length} ${plano.passos.length === 1 ? t("tarefa") : t("tarefas")}`}
        </Button>
      </div>
    </>
  );
}
