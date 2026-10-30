"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { definirOrigemDosLeads } from "@/app/actions/agencia/modoAgencia";
import { setActiveOrg } from "@/app/actions/shell/setActiveOrg";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { useT } from "@/hooks/i18n/useT";
import type { GrupoDeCliente, LinhaDeCampanha } from "@/lib/agencia/campanhas-servidor";
import { COR_DO_STATUS } from "@/components/marketing/campanhas/rotulos";
import type { StatusDaCampanha } from "@/lib/marketing/campanhas";
import { cn } from "@/lib/utils";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const ROTULO_DO_STATUS: Record<string, string> = {
  planejada: "Planejada",
  ativa: "Ativa",
  pausada: "Pausada",
  encerrada: "Encerrada",
};

function Prazo({ l }: { l: LinhaDeCampanha }) {
  const t = useT();
  const p = l.prazo;
  if (p.tipo === "continua") return <span className="text-muted-foreground">{t("Contínua")}</span>;
  if (p.tipo === "sem_prazo") return <span className="text-muted-foreground">—</span>;
  if (p.tipo === "encerrou")
    return <span className="text-error-fg">{`${t("Encerrou há")} ${p.dias} ${t(p.dias === 1 ? "dia" : "dias")}`}</span>;
  return (
    <span className={cn(p.dias <= 3 && "font-semibold text-warning-fg")}>
      {p.dias === 0 ? t("Termina hoje") : `${p.dias} ${t(p.dias === 1 ? "dia" : "dias")}`}
    </span>
  );
}

function Verba({ l }: { l: LinhaDeCampanha }) {
  const t = useT();
  const { total, periodo } = l.verba;
  if (total === null) {
    return (
      <div className="grid gap-0.5">
        <span className="tabular-nums">{BRL.format(l.investido)}</span>
        {periodo ? (
          <span className="text-xs text-muted-foreground">
            {BRL.format(periodo.valor)}/{t(periodo.por === "diario" ? "dia" : periodo.por === "semanal" ? "semana" : "mês")}
          </span>
        ) : null}
      </div>
    );
  }
  const pct = Math.min(100, Math.round((l.investido / total) * 100));
  return (
    <div className="grid min-w-36 gap-1">
      <span className="tabular-nums">
        {BRL.format(l.investido)} <span className="text-muted-foreground">/ {BRL.format(total)}</span>
      </span>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full", pct >= 100 ? "bg-error-fg" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function OrigemDosLeads({ g }: { g: GrupoDeCliente }) {
  const t = useT();
  const router = useRouter();
  const [valor, setValor] = useState(g.origem);
  const [pendente, iniciar] = useTransition();
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {t("Leads vêm de")}
      <select
        value={valor}
        disabled={pendente}
        aria-label={`${t("Origem dos leads")} — ${g.cliente.name}`}
        onChange={(e) => {
          const novo = e.target.value as "crm" | "meta";
          setValor(novo);
          iniciar(async () => {
            const r = await definirOrigemDosLeads(g.cliente.id, novo);
            if (!r.ok) {
              setValor(g.origem);
              toast.error(t("Não foi possível salvar."));
              return;
            }
            router.refresh();
          });
        }}
        className="h-8 rounded-lg border bg-card px-2 text-xs text-foreground"
      >
        <option value="crm">{t("CRM do cliente")}</option>
        <option value="meta">{t("Meta (conversas iniciadas)")}</option>
      </select>
    </label>
  );
}

export function TabelaDeCampanhasDaAgencia({ grupos }: { grupos: GrupoDeCliente[] }) {
  const t = useT();
  const router = useRouter();
  const [abrindo, setAbrindo] = useState<string | null>(null);

  async function abrir(orgId: string, campanhaId: string) {
    setAbrindo(campanhaId);
    const r = await setActiveOrg(orgId);
    if (!r.ok) {
      setAbrindo(null);
      toast.error(t("Não foi possível abrir a campanha desse cliente."));
      return;
    }
    router.push(`/app/marketing/geracao-de-demanda/campanhas/${campanhaId}`);
  }

  if (grupos.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("Nenhum cliente disponível.")}</p>;
  }
  return (
    <div className="grid gap-6">
      {grupos.map((g) => (
        <section key={g.cliente.id} aria-label={g.cliente.name} className="grid gap-2">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{g.cliente.name}</h2>
            <OrigemDosLeads g={g} />
          </header>
          {g.campanhas.length === 0 ? (
            <p className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">
              {t("Sem campanhas.")}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="bg-secondary/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("Campanha")}</th>
                    <th className="px-3 py-2 font-medium">{t("Status")}</th>
                    <th className="px-3 py-2 font-medium">{t("Prazo")}</th>
                    <th className="px-3 py-2 font-medium">{t("Leads")}</th>
                    <th className="px-3 py-2 font-medium">CPL</th>
                    <th className="px-3 py-2 font-medium">{t("Investido / verba")}</th>
                  </tr>
                </thead>
                <tbody>
                  {g.campanhas.map((l) => (
                    <tr key={l.id} className="border-t align-top">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          disabled={abrindo === l.id}
                          onClick={() => void abrir(g.cliente.id, l.id)}
                          className="text-left font-medium hover:underline disabled:opacity-60"
                        >
                          {l.nome}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <Etiqueta cor={COR_DO_STATUS[l.status as StatusDaCampanha] ?? "gray"}>
                          {t(ROTULO_DO_STATUS[l.status] ?? l.status)}
                        </Etiqueta>
                      </td>
                      <td className="px-3 py-2"><Prazo l={l} /></td>
                      <td className="px-3 py-2 tabular-nums">{l.leads}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {l.cpl === null ? "—" : BRL.format(l.cpl)}
                        {l.meta_cpl ? (
                          <span className="block text-xs text-muted-foreground">
                            {t("meta")} {BRL.format(l.meta_cpl)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2"><Verba l={l} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
