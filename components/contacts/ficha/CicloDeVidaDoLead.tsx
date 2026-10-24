"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { BlocoDaFicha } from "@/components/contacts/ficha/BlocoDaFicha";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { useAssignableMembers } from "@/hooks/inbox/useAssignableMembers";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { COR_DO_CICLO, ehCicloDeVida, ROTULO_DO_CICLO } from "@/lib/ciclo-de-vida";

interface Dados {
  ciclo_de_vida: string | null;
  ciclo_motivo: string | null;
  ativo_ate: string | null;
  dono_user_id: string | null;
  oportunidades_abertas: number;
  produtos: Array<{
    product_id: string;
    nome: string;
    janela_meses: number;
    janela_propria: boolean;
    ultimo_pagamento: string;
    ativo_ate: string;
  }>;
  historico: Array<{
    id: string;
    entidade: "pessoa" | "oportunidade" | "pagamento";
    de: string | null;
    para: string;
    motivo: string | null;
    autor_tipo: string;
    created_at: string;
  }>;
}

const ROTULO_DA_PARCELA: Record<string, string> = {
  prevista: "Comprometido",
  recebida: "Pago",
  cancelada: "Cancelado",
};

/**
 * O CICLO DE VIDA da pessoa na ficha: o status calculado e o porquê, até quando ela conta como
 * cliente ativa (a próxima recompra prevista), o DONO DO RELACIONAMENTO e o histórico de estados.
 */
export function CicloDeVidaDoLead({
  contactId,
  podeEditar,
}: {
  contactId: string;
  podeEditar: boolean;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const membros = useAssignableMembers(true);
  const consulta = useQuery({
    queryKey: ["contato-ciclo", contactId],
    staleTime: 15_000,
    queryFn: async () =>
      (await apiClient.get<{ data: Dados }>(`/api/v1/contacts/${contactId}/ciclo`)).data,
  });
  const d = consulta.data;
  if (!d) return null;

  const nomeDe = (id: string | null) =>
    (membros.data ?? []).find((m) => m.user_id === id)?.full_name?.trim() || null;
  const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
  const rotuloDoEstado = (entidade: string, valor: string | null) => {
    if (!valor) return "—";
    if (entidade === "pessoa" && ehCicloDeVida(valor)) return t(ROTULO_DO_CICLO[valor]);
    if (entidade === "pagamento") return t(ROTULO_DA_PARCELA[valor] ?? valor);
    return valor;
  };
  const rotuloDaEntidade = (e: string) =>
    e === "pessoa" ? t("Cliente") : e === "oportunidade" ? t("Oportunidade (etapa)") : t("Pagamento");

  async function mudarDono(id: string) {
    try {
      await apiClient.post("/api/v1/clientes/lote", {
        action: "dono",
        contact_ids: [contactId],
        user_id: id || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["contato-ciclo", contactId] });
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e) {
      showApiError(e);
    }
  }

  return (
    <BlocoDaFicha titulo={t("Ciclo de vida")} cor="green">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {ehCicloDeVida(d.ciclo_de_vida) ? (
            <Etiqueta ponto cor={COR_DO_CICLO[d.ciclo_de_vida]}>
              {t(ROTULO_DO_CICLO[d.ciclo_de_vida])}
            </Etiqueta>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
          {d.oportunidades_abertas > 0 ? (
            <span className="text-xs text-muted-foreground">
              {d.oportunidades_abertas === 1
                ? t("1 oportunidade aberta")
                : `${d.oportunidades_abertas} ${t("oportunidades abertas")}`}
            </span>
          ) : null}
        </div>
        {d.ciclo_motivo ? <p className="text-sm text-muted-foreground">{d.ciclo_motivo}</p> : null}
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{t("Ativo até (próxima recompra)")}</dt>
            <dd className="text-sm font-medium">
              {d.ativo_ate ? dia(d.ativo_ate) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("Gestor de Relacionamento")}</dt>
            <dd>
              <select
                aria-label={t("Gestor de Relacionamento")}
                disabled={!podeEditar}
                value={d.dono_user_id ?? ""}
                onChange={(e) => void mudarDono(e.target.value)}
                className="h-9 w-full rounded-lg border bg-card px-2 text-sm disabled:opacity-60"
              >
                <option value="">{t("Sem dono")}</option>
                {(membros.data ?? []).map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name?.trim() || t("Sem nome")}
                  </option>
                ))}
              </select>
              {d.dono_user_id && !nomeDe(d.dono_user_id) ? (
                <span className="text-xs text-muted-foreground">{t("Fora da equipe")}</span>
              ) : null}
            </dd>
          </div>
        </dl>
        {d.produtos.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("Janela de cliente ativo por produto")}
            </p>
            <ul className="grid gap-1">
              {d.produtos.map((p) => (
                <li
                  key={p.product_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-1.5 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">{p.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.janela_meses} {p.janela_meses === 1 ? t("mês") : t("meses")}
                    {p.janela_propria ? "" : ` (${t("padrão da empresa")})`} · {t("último pagamento")}{" "}
                    {dia(p.ultimo_pagamento)} · {t("ativo até")} {dia(p.ativo_ate)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("Histórico de estados")}
          </p>
          {d.historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("Nada registrado ainda.")}</p>
          ) : (
            <ul className="grid max-h-72 gap-1.5 overflow-y-auto pr-1">
              {d.historico.map((h) => (
                <li key={h.id} className="rounded-lg bg-secondary/50 px-3 py-1.5 text-sm">
                  <span className="text-xs text-muted-foreground">
                    {dia(h.created_at)} · {rotuloDaEntidade(h.entidade)}
                    {h.autor_tipo === "usuario" ? ` · ${t("por uma pessoa")}` : ""}
                  </span>
                  <p>
                    {h.de ? `${rotuloDoEstado(h.entidade, h.de)} → ` : ""}
                    <strong>{rotuloDoEstado(h.entidade, h.para)}</strong>
                  </p>
                  {h.motivo ? <p className="text-xs text-muted-foreground">{h.motivo}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </BlocoDaFicha>
  );
}
