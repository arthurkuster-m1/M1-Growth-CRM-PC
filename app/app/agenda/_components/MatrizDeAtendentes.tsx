"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { atendentesDoTipoNaMatriz, useMatrizDeAtendentes } from "@/components/agenda/equipe-hooks";
import { usePessoasDaEquipe } from "@/components/agenda/FormularioDeNovoCompromisso";
import { ConvidarAtendente } from "./ConvidarAtendente";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

/**
 * Quem faz cada tipo de atendimento: uma linha por pessoa, uma coluna por tipo. A prioridade
 * desempata quando o "qualquer atendente" encontra pessoas com a mesma carga no dia.
 */
export function MatrizDeAtendentes({ podeEditar, podeConvidar = false }: { podeEditar: boolean; podeConvidar?: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const matriz = useMatrizDeAtendentes();
  const pessoas = usePessoasDaEquipe();
  const [marcado, setMarcado] = React.useState<Set<string>>(new Set());
  const [prioridade, setPrioridade] = React.useState<Record<string, number>>({});
  const [sujo, setSujo] = React.useState(false);

  const m = matriz.data;
  React.useEffect(() => {
    if (!m || sujo) return;
    const marcas = new Set<string>();
    const prio: Record<string, number> = {};
    for (const tipo of m.tipos) for (const u of atendentesDoTipoNaMatriz(m, tipo.id)) marcas.add(`${tipo.id}|${u}`);
    for (const l of m.matriz) prio[l.user_id] = Math.min(prio[l.user_id] ?? 10000, l.priority);
    setMarcado(marcas);
    setPrioridade(prio);
  }, [m, sujo]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!m) return;
      for (const tipo of m.tipos) {
        const atendentes = m.membros
          .filter((p) => marcado.has(`${tipo.id}|${p.user_id}`))
          .map((p) => ({ user_id: p.user_id, priority: prioridade[p.user_id] ?? 100, is_active: true }));
        await apiClient.put("/api/v1/agenda/atendentes-do-tipo", { event_type_id: tipo.id, atendentes });
      }
    },
    onSuccess: () => {
      toast.success(t("Atendentes salvos."));
      setSujo(false);
      void qc.invalidateQueries({ queryKey: ["agenda"] });
    },
    onError: showApiError,
  });

  if (matriz.isPending) return <p className="text-sm text-muted-foreground">{t("Carregando…")}</p>;
  if (!m) return null;
  const nomeDe = (id: string) => (pessoas.data ?? []).find((p) => p.user_id === id)?.full_name?.trim() || t("Pessoa da equipe");

  return (
    <div className="mb-6 rounded-2xl border border-border bg-background p-4" data-testid="matriz-de-atendentes">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{t("Quem faz cada tipo de atendimento")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("Marque os tipos que cada pessoa atende. Ao marcar horário, só aparecem os atendentes do tipo que estão livres.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {podeConvidar ? <ConvidarAtendente /> : null}
          {podeEditar && m.tabela_existe ? (
            <Button type="button" size="sm" className="rounded-xl" disabled={!sujo || salvar.isPending} onClick={() => salvar.mutate()}>
              {t("Salvar atendentes")}
            </Button>
          ) : null}
        </div>
      </div>
      {!m.tabela_existe ? (
        <p className="rounded-xl bg-warning-bg px-3 py-2 text-xs text-warning-fg">
          {t("A configuração de vários atendentes por tipo ainda não foi ativada neste ambiente. Por enquanto vale o responsável de cada tipo.")}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">{t("Pessoa")}</th>
              {m.tipos.map((tipo) => (
                <th key={tipo.id} className="px-2 py-2 text-center font-medium">{tipo.nome}</th>
              ))}
              <th className="px-2 py-2 text-center font-medium">{t("Prioridade")}</th>
              <th className="py-2 pl-2 font-medium">{t("Google")}</th>
            </tr>
          </thead>
          <tbody>
            {m.membros.map((p) => (
              <tr key={p.user_id} className="border-t border-border">
                <td className="py-2 pr-3">{nomeDe(p.user_id)}</td>
                {m.tipos.map((tipo) => {
                  const k = `${tipo.id}|${p.user_id}`;
                  return (
                    <td key={tipo.id} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${nomeDe(p.user_id)} · ${tipo.nome}`}
                        disabled={!podeEditar || !m.tabela_existe}
                        checked={marcado.has(k)}
                        onChange={(e) => {
                          setSujo(true);
                          setMarcado((s) => {
                            const n = new Set(s);
                            if (e.target.checked) n.add(k);
                            else n.delete(k);
                            return n;
                          });
                        }}
                      />
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center">
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    aria-label={`${t("Prioridade")} · ${nomeDe(p.user_id)}`}
                    disabled={!podeEditar || !m.tabela_existe}
                    value={prioridade[p.user_id] ?? 100}
                    onChange={(e) => {
                      setSujo(true);
                      setPrioridade((x) => ({ ...x, [p.user_id]: Number(e.target.value) || 0 }));
                    }}
                    className="h-8 w-16 rounded-lg border border-border bg-card px-2 text-center"
                  />
                </td>
                <td className="py-2 pl-2">
                  {m.com_google.includes(p.user_id) ? (
                    <Badge variant="success" className="rounded-lg">{t("Conectado")}</Badge>
                  ) : (
                    <Badge variant="neutral" className="rounded-lg">{t("Só no app")}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {t("Quem não conectou o Google também atende: o compromisso fica só na agenda do app. Prioridade menor vem primeiro quando a carga do dia é igual.")}
      </p>
    </div>
  );
}
