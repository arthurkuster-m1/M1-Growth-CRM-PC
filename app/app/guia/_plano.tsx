"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/i18n/useT";
import { CHAVE_DO_GUIA, type RespostaDoGuia } from "@/hooks/guia/useDiagnosticoDoGuia";
import { apiClient } from "@/lib/api/client";
import { passoPorId } from "@/lib/guia/catalogo";
import {
  LADOS_DO_PLANO,
  type EntradaDoHistorico,
  type ItemDoPlanoVisao,
  type LadoDoPlano,
} from "@/lib/guia/tipos";
import { comRetornoAoGuia } from "@/lib/guia/retorno";
import { registrarDesfazer } from "@/lib/motor/desfazer";
import { posicaoEntre } from "@/lib/motor/ordem";
import { cn } from "@/lib/utils";

import { COR_DO_ESTADO, rotuloDoEstado, type Traduzir } from "./_rotulos";

interface Membro {
  user_id: string;
  role: string;
  full_name: string | null;
}

type Mudanca = Partial<{
  noPlano: boolean;
  lado: LadoDoPlano | null;
  responsavelId: string | null;
  prazo: string | null;
  ordem: number;
}>;

const BOTAO =
  "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-60";
const CAMPO = "h-8 rounded-lg border bg-background px-2 text-xs";

const rotuloDoLado = (t: Traduzir, l: LadoDoPlano) =>
  l === "agencia" ? t("Agência") : t("Cliente");

const dataCurta = (iso: string | null) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "—");

function rotuloDaTarefa(t: Traduzir, status: string): string {
  switch (status) {
    case "done":
      return t("Tarefa concluída");
    case "in_progress":
      return t("Tarefa em andamento");
    case "cancelled":
      return t("Tarefa cancelada");
    default:
      return t("Tarefa pendente");
  }
}

function textoDoHistorico(
  t: Traduzir,
  e: EntradaDoHistorico,
  nomeDe: (id: string | null) => string,
): string {
  const passo = e.passoId ? `${e.passoId} ${passoPorId(e.passoId)?.titulo ?? ""}`.trim() : "";
  const d = e.detalhe as Record<string, { de?: string | null; para?: string | null } | unknown>;
  switch (e.acao) {
    case "plano_montado": {
      const n = Array.isArray(e.detalhe.passos) ? e.detalhe.passos.length : 0;
      return `${t("Montou o plano padrão")} (${n} ${n === 1 ? t("passo") : t("passos")})`;
    }
    case "plano_adicionado":
      return `${t("Pôs no plano")}: ${passo}`;
    case "plano_removido":
      return `${t("Tirou do plano")}: ${passo}`;
    case "plano_alterado": {
      const partes: string[] = [];
      const prazo = d.prazo as { para?: string | null } | undefined;
      const resp = d.responsavel as { para?: string | null } | undefined;
      const lado = d.lado as { para?: string | null } | undefined;
      if (prazo) partes.push(`${t("prazo")} ${prazo.para ? dataCurta(prazo.para) : t("removido")}`);
      if (resp) partes.push(`${t("responsável")} ${resp.para ? nomeDe(resp.para) : t("ninguém")}`);
      if (lado?.para) partes.push(`${t("quem faz")}: ${rotuloDoLado(t, lado.para as LadoDoPlano)}`);
      if (d.ordem) partes.push(t("ordem"));
      return `${t("Mudou")} ${passo}${partes.length ? ` — ${partes.join(", ")}` : ""}`;
    }
    case "passo_marcado":
      return `${t("Marcou")} ${passo} ${t("como")} ${e.detalhe.estado === "dispensado" ? t("dispensado") : t("feito")}`;
    case "passo_reaberto":
      return `${t("Reabriu")} ${passo}`;
    case "tarefa_criada":
      return `${t("Criou a tarefa de")} ${passo}`;
  }
}

/** O plano do cliente: o que a agência escolheu fazer, com quem faz e até quando. */
export function PlanoDoGuia({ resposta }: { resposta: RespostaDoGuia }) {
  const t = useT();
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const { plano, historico, planoDisponivel, perfil } = resposta;

  const membros = useQuery({
    queryKey: ["guia", "membros"],
    queryFn: async () => (await apiClient.get<{ data: Membro[] }>("/api/v1/team/assignable")).data,
    staleTime: 60_000,
  });
  const nomeDe = (id: string | null) => {
    if (!id) return t("alguém");
    const m = membros.data?.find((x) => x.user_id === id);
    return m?.full_name?.trim() || t("alguém da equipe");
  };

  const atualizar = () => qc.invalidateQueries({ queryKey: CHAVE_DO_GUIA });

  if (!planoDisponivel) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning-fg"
      >
        {t(
          "O banco ainda não recebeu a atualização do plano. Peça para aplicá-la na VPS; o resto do Guia segue funcionando.",
        )}
      </p>
    );
  }

  async function guardar(passoId: string, depois: Mudanca, antes: Mudanca, rotulo: string) {
    setOcupado(true);
    try {
      await apiClient.put(`/api/v1/guia/plano/${passoId}`, depois);
      registrarDesfazer({
        rotulo,
        desfazer: async () => {
          await apiClient.put(`/api/v1/guia/plano/${passoId}`, antes);
          await atualizar();
        },
      });
      await atualizar();
    } catch {
      toast.error(t("Não foi possível salvar a mudança no plano."));
    } finally {
      setOcupado(false);
    }
  }

  async function montar() {
    setOcupado(true);
    try {
      const r = await apiClient.post<{ data: { adicionados: number } }>(
        "/api/v1/guia/plano/montar",
        {},
      );
      await atualizar();
      toast.success(
        r.data.adicionados > 0
          ? `${r.data.adicionados} ${r.data.adicionados === 1 ? t("passo entrou no plano.") : t("passos entraram no plano.")}`
          : t("O plano já tem todos os passos essenciais."),
      );
    } catch {
      toast.error(t("Não foi possível montar o plano."));
    } finally {
      setOcupado(false);
    }
  }

  async function criarTarefa(passoId: string) {
    setOcupado(true);
    try {
      await apiClient.post(`/api/v1/guia/passos/${passoId}/tarefa`, {});
      await atualizar();
      toast.success(t("Tarefa criada em Tarefas, na semana do Cronograma."));
    } catch {
      toast.error(t("Não foi possível criar a tarefa."));
    } finally {
      setOcupado(false);
    }
  }

  async function aplicarSugestao(v: ItemDoPlanoVisao) {
    setOcupado(true);
    try {
      if (v.sugestao === "confirmar_passo") {
        await apiClient.put(`/api/v1/guia/passos/${v.passo.id}`, { estado: "feito", motivo: null });
      } else if (v.sugestao === "concluir_tarefa" && v.item.tarefaId) {
        await apiClient.patch(`/api/v1/tasks/${v.item.tarefaId}`, { status: "done" });
      }
      await atualizar();
    } catch {
      toast.error(t("Não foi possível aplicar."));
    } finally {
      setOcupado(false);
    }
  }

  function mover(i: number, direcao: -1 | 1) {
    const alvo = i + direcao;
    if (alvo < 0 || alvo >= plano.length) return;
    // Cai entre os dois vizinhos do destino (ponto médio, sem renumerar a lista).
    const sem = plano.filter((_, k) => k !== i);
    const nova = posicaoEntre(sem[alvo - 1]?.item.ordem, sem[alvo]?.item.ordem);
    const v = plano[i]!;
    void guardar(v.passo.id, { ordem: nova }, { ordem: v.item.ordem }, v.passo.titulo);
  }

  const concluidos = plano.filter((v) => v.passo.estado === "feito").length;
  const atrasados = plano.filter((v) => v.atrasado).length;

  return (
    <div className="flex flex-col gap-5" data-testid="guia-plano">
      <section className="grid gap-3 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("Plano do cliente")}</h2>
            <p className="text-xs text-muted-foreground">
              {plano.length} {plano.length === 1 ? t("passo") : t("passos")} · {concluidos}{" "}
              {t("prontos")}
              {atrasados > 0
                ? ` · ${atrasados} ${atrasados === 1 ? t("atrasado") : t("atrasados")}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            className={BOTAO}
            disabled={ocupado || !perfil}
            onClick={() => void montar()}
          >
            {t("Montar plano padrão")}
          </button>
        </div>
        {!perfil ? (
          <p className="text-xs text-muted-foreground">
            {t("Preencha o perfil do negócio para montar o plano.")}
          </p>
        ) : plano.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t(
              "O plano está vazio. Monte o plano padrão (os passos essenciais que faltam) ou use Pôr no plano em qualquer passo do Guia.",
            )}
          </p>
        ) : null}
      </section>

      {plano.length > 0 ? (
        <ul className="grid gap-2">
          {plano.map((v, i) => (
            <li
              key={v.item.passoId}
              className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    <span className="mr-1.5 text-xs text-muted-foreground">{v.passo.id}</span>
                    {v.passo.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground">{v.passo.evidencia}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {v.atrasado ? (
                    <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning-fg">
                      {t("Atrasado")}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      COR_DO_ESTADO[v.passo.estado],
                    )}
                  >
                    {rotuloDoEstado(t, v.passo.estado)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">{t("Quem faz")}</span>
                  <select
                    value={v.lado}
                    disabled={ocupado}
                    className={CAMPO}
                    onChange={(e) =>
                      void guardar(
                        v.passo.id,
                        { lado: e.target.value as LadoDoPlano },
                        { lado: v.item.lado },
                        v.passo.titulo,
                      )
                    }
                  >
                    {LADOS_DO_PLANO.map((l) => (
                      <option key={l} value={l}>
                        {rotuloDoLado(t, l)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">{t("Responsável")}</span>
                  <select
                    value={v.item.responsavelId ?? ""}
                    disabled={ocupado}
                    className={CAMPO}
                    onChange={(e) =>
                      void guardar(
                        v.passo.id,
                        { responsavelId: e.target.value || null },
                        { responsavelId: v.item.responsavelId },
                        v.passo.titulo,
                      )
                    }
                  >
                    <option value="">{t("Ninguém")}</option>
                    {(membros.data ?? []).map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.full_name?.trim() || t("Sem nome")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">{t("Prazo")}</span>
                  <input
                    type="date"
                    value={v.item.prazo ?? ""}
                    disabled={ocupado}
                    className={CAMPO}
                    onChange={(e) =>
                      void guardar(
                        v.passo.id,
                        { prazo: e.target.value || null },
                        { prazo: v.item.prazo },
                        v.passo.titulo,
                      )
                    }
                  />
                </label>
              </div>

              {v.sugestao ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs">
                  <span>
                    {v.sugestao === "confirmar_passo"
                      ? t("A tarefa foi concluída. O passo está feito?")
                      : t("O passo está pronto, mas a tarefa ainda está aberta.")}
                  </span>
                  <button
                    type="button"
                    className={BOTAO}
                    disabled={ocupado}
                    onClick={() => void aplicarSugestao(v)}
                  >
                    {v.sugestao === "confirmar_passo"
                      ? t("Marcar passo como feito")
                      : t("Concluir tarefa")}
                  </button>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={comRetornoAoGuia(v.passo.onde.href, "plano")}
                  className={cn(BOTAO, "text-primary")}
                >
                  {t("Abrir")}: {v.passo.onde.rotulo}
                </Link>
                {v.item.tarefaId ? (
                  <Link href="/app/tarefas" className={BOTAO}>
                    {v.tarefa ? rotuloDaTarefa(t, v.tarefa.status) : t("Tarefa criada")} ·{" "}
                    {t("ver em Tarefas")}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={BOTAO}
                    disabled={ocupado}
                    onClick={() => void criarTarefa(v.passo.id)}
                  >
                    {t("Criar tarefa")}
                  </button>
                )}
                <button
                  type="button"
                  className={BOTAO}
                  disabled={ocupado || i === 0}
                  aria-label={t("Subir")}
                  onClick={() => mover(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={BOTAO}
                  disabled={ocupado || i === plano.length - 1}
                  aria-label={t("Descer")}
                  onClick={() => mover(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={BOTAO}
                  disabled={ocupado}
                  onClick={() =>
                    void guardar(v.passo.id, { noPlano: false }, { noPlano: true }, v.passo.titulo)
                  }
                >
                  {t("Tirar do plano")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <section aria-label={t("O que mudou")} className="grid gap-2 rounded-2xl border bg-card p-4">
        <h2 className="text-base font-semibold">{t("O que mudou")}</h2>
        {historico.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Nada registrado ainda.")}</p>
        ) : (
          <ul className="grid gap-1.5 text-xs">
            {historico.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2">
                <span>{textoDoHistorico(t, e, nomeDe)}</span>
                <span className="text-muted-foreground">
                  {nomeDe(e.feitoPor)} · {e.feitoEm.slice(8, 10)}/{e.feitoEm.slice(5, 7)}{" "}
                  {e.feitoEm.slice(11, 16)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
