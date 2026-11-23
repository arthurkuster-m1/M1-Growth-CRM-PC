"use client";

import { useEffect, useState } from "react";

import { TRIGGER_LABELS, type TriggerEvent } from "@/app/app/webhooks/_components/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateTriggerConfig } from "@/hooks/followup/useFollowupFlow";
import { useT } from "@/hooks/i18n/useT";
import { GATILHO_DE_DATA_DO_FUNIL } from "@/lib/automation/gatilho-de-data-do-funil";
import {
  DIRECOES_DO_SILENCIO,
  GATILHO_ETAPA_PARADA,
  GATILHO_SILENCIO,
  configDaEtapaParada,
  configDoSilencio,
  type DirecaoDoSilencio,
} from "@/lib/automation/gatilhos-de-tempo";
import { CAMPOS_DAS_CONDICOES, OPERADORES_DAS_CONDICOES } from "@/lib/automation/passos-da-regra";
import { triggerConfigSchema } from "@/lib/followup/api-schemas";
import { Plus, Trash } from "@/lib/ui/icons";

type Op = "eq" | "neq" | "contains";
type Condicao = { field: string; op: Op; value: string };

const DIRECOES: Record<DirecaoDoSilencio, string> = {
  da_equipe: "A equipe não escreve",
  do_cliente: "O cliente não responde",
  qualquer: "Ninguém escreve",
  sem_atendimento: "O cliente escreveu e a equipe não respondeu",
};

interface Forma {
  evento: TriggerEvent;
  condicoes: Condicao[];
  dias: number;
  unidade: "dias" | "horas";
  direcao: DirecaoDoSilencio;
  /** Os parâmetros que esta tela não edita (data do funil) passam intactos. */
  configOriginal: Record<string, unknown> | null;
}

const PADRAO: Forma = {
  evento: "lead.created",
  condicoes: [],
  dias: 3,
  unidade: "dias",
  direcao: "do_cliente",
  configOriginal: null,
};

function ler(triggerConfig: Record<string, unknown>): { forma: Forma; definido: boolean } {
  const lido = triggerConfigSchema.safeParse(triggerConfig);
  if (!lido.success || lido.data.kind !== "event") return { forma: PADRAO, definido: false };
  const { event_type, conditions, config } = lido.data.params;
  const silencio = event_type === GATILHO_SILENCIO ? configDoSilencio(config) : null;
  const parada = event_type === GATILHO_ETAPA_PARADA ? configDaEtapaParada(config) : null;
  return {
    definido: true,
    forma: {
      evento: event_type,
      condicoes: conditions as Condicao[],
      dias: silencio?.dias ?? parada?.dias ?? PADRAO.dias,
      unidade: silencio?.unidade ?? "dias",
      direcao: silencio?.direcao ?? PADRAO.direcao,
      configOriginal: config ?? null,
    },
  };
}

/** O `trigger_config` que esta forma grava, ou o motivo de ainda não poder gravar. */
export function montarGatilho(
  f: Forma,
): { ok: true; config: Record<string, unknown> } | { ok: false; erro: string } {
  let config: Record<string, unknown> | undefined;
  if (f.evento === GATILHO_SILENCIO) {
    config = { dias: f.dias, unidade: f.unidade, direcao: f.direcao };
    if (!configDoSilencio(config)) return { ok: false, erro: "Informe um tempo válido." };
  } else if (f.evento === GATILHO_ETAPA_PARADA) {
    config = { dias: f.dias };
    if (!configDaEtapaParada(config))
      return { ok: false, erro: "Informe um número de dias válido." };
  } else if (f.evento === GATILHO_DE_DATA_DO_FUNIL) {
    config = f.configOriginal ?? undefined;
  }
  const condicoes = f.condicoes.filter((c) => c.value.trim() !== "");
  const gatilho = triggerConfigSchema.safeParse({
    kind: "event",
    params: { event_type: f.evento, conditions: condicoes, ...(config ? { config } : {}) },
  });
  return gatilho.success
    ? { ok: true, config: gatilho.data as unknown as Record<string, unknown> }
    : { ok: false, erro: gatilho.error.issues[0]?.message ?? "Gatilho inválido." };
}

interface Props {
  flowId: string;
  triggerConfig: Record<string, unknown>;
}

/**
 * «Quando» da automação de CRM: o evento que a dispara, as condições e, nos gatilhos por tempo, os dias.
 * O fluxo é do OBJETO do evento (lead, contato, compromisso) — por isso a lista de eventos é a das regras.
 */
export function GatilhoDaAutomacao({ flowId, triggerConfig }: Props) {
  const t = useT();
  const update = useUpdateTriggerConfig(flowId);
  const [open, setOpen] = useState(false);
  const salvo = ler(triggerConfig);
  const [forma, setForma] = useState<Forma>(salvo.forma);

  // Re-sincroniza com o valor gravado quando o popover está FECHADO (nunca no meio de uma edição).
  useEffect(() => {
    if (!open) setForma(ler(triggerConfig).forma);
  }, [triggerConfig, open]);

  const montado = montarGatilho(forma);
  const porTempo = forma.evento === GATILHO_SILENCIO || forma.evento === GATILHO_ETAPA_PARADA;
  const resumo = salvo.definido
    ? t(TRIGGER_LABELS[salvo.forma.evento])
    : t("Escolha o que dispara");

  const mudarCondicao = (i: number, patch: Partial<Condicao>) =>
    setForma((f) => ({
      ...f,
      condicoes: f.condicoes.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    }));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" data-testid="gatilho-da-automacao">
          {t("Quando")}: {resumo}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[26rem] space-y-4" align="start">
        <div className="space-y-2">
          <Label htmlFor="gatilho-evento">{t("Quando isto acontecer")}</Label>
          <Select
            value={forma.evento}
            onValueChange={(v) => setForma((f) => ({ ...f, evento: v as TriggerEvent }))}
          >
            <SelectTrigger id="gatilho-evento" data-testid="gatilho-evento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TRIGGER_LABELS) as TriggerEvent[]).map((e) => (
                <SelectItem key={e} value={e}>
                  {t(TRIGGER_LABELS[e])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {porTempo && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="gatilho-dias">{t("Tempo")}</Label>
                <Input
                  id="gatilho-dias"
                  type="number"
                  min={1}
                  value={forma.dias}
                  onChange={(e) => setForma((f) => ({ ...f, dias: Number(e.target.value) }))}
                />
              </div>
              {forma.evento === GATILHO_SILENCIO && (
                <Select
                  value={forma.unidade}
                  onValueChange={(v) => setForma((f) => ({ ...f, unidade: v as "dias" | "horas" }))}
                >
                  <SelectTrigger className="w-28" aria-label={t("Unidade")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dias">{t("dias")}</SelectItem>
                    <SelectItem value="horas">{t("horas")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            {forma.evento === GATILHO_SILENCIO && (
              <div className="space-y-1">
                <Label htmlFor="gatilho-direcao">{t("Silêncio de quem")}</Label>
                <Select
                  value={forma.direcao}
                  onValueChange={(v) =>
                    setForma((f) => ({ ...f, direcao: v as DirecaoDoSilencio }))
                  }
                >
                  <SelectTrigger id="gatilho-direcao">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIRECOES_DO_SILENCIO.map((d) => (
                      <SelectItem key={d} value={d}>
                        {t(DIRECOES[d])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {forma.evento === GATILHO_DE_DATA_DO_FUNIL && (
          <p className="rounded-md bg-surface-elevated p-2 text-xs text-text-muted">
            {t(
              "O funil, o campo e os dias da data do funil vêm da regra original e passam como estão; editá-los por aqui ainda não é possível.",
            )}
          </p>
        )}

        <div className="space-y-2">
          <Label>{t("Só se (todas valem)")}</Label>
          {forma.condicoes.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <Select value={c.field} onValueChange={(v) => mudarCondicao(i, { field: v })}>
                <SelectTrigger className="w-36" aria-label={t("Campo")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CAMPOS_DAS_CONDICOES).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>
                      {t(rotulo)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={c.op} onValueChange={(v) => mudarCondicao(i, { op: v as Op })}>
                <SelectTrigger className="w-24" aria-label={t("Operador")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(OPERADORES_DAS_CONDICOES) as Op[]).map((o) => (
                    <SelectItem key={o} value={o}>
                      {t(OPERADORES_DAS_CONDICOES[o])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={c.value}
                aria-label={t("Valor")}
                onChange={(e) => mudarCondicao(i, { value: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("Remover condição")}
                onClick={() =>
                  setForma((f) => ({ ...f, condicoes: f.condicoes.filter((_, j) => j !== i) }))
                }
              >
                <Trash size={14} aria-hidden />
              </Button>
            </div>
          ))}
          {forma.condicoes.length < 10 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setForma((f) => ({
                  ...f,
                  condicoes: [...f.condicoes, { field: "lead.tags", op: "contains", value: "" }],
                }))
              }
            >
              <Plus size={14} aria-hidden className="mr-1" />
              {t("Adicionar condição")}
            </Button>
          )}
        </div>

        {!montado.ok && <p className="text-xs text-error-fg">{t(montado.erro)}</p>}
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={!montado.ok || update.isPending}
          data-testid="gatilho-salvar"
          onClick={() => {
            if (!montado.ok) return;
            update.mutate(montado.config, { onSuccess: () => setOpen(false) });
          }}
        >
          {t("Salvar gatilho")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
