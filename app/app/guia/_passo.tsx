"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/i18n/useT";
import { CHAVE_DO_GUIA } from "@/hooks/guia/useDiagnosticoDoGuia";
import { apiClient } from "@/lib/api/client";
import { desfazerUltimo, registrarDesfazer } from "@/lib/motor/desfazer";
import type { EstadoDoPasso, PassoDiagnosticado } from "@/lib/guia/tipos";
import { cn } from "@/lib/utils";

import { promptsDoPasso, montarPrompt } from "@/lib/guia/prompts";

import { comRetornoAoGuia } from "@/lib/guia/retorno";

import { buscarDossie, copiarTexto } from "./_copiar";
import { AssistenteDeHorarios } from "./_horarios";
import { COR_DO_ESTADO, rotuloDoEstado } from "./_rotulos";

type Marca = { estado: "feito" | "dispensado"; motivo?: string } | null;

const BOTAO =
  "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-60";

const PEDE_ACAO: ReadonlySet<EstadoDoPasso> = new Set([
  "falta",
  "em_andamento",
  "bloqueado",
  "desatualizado",
  "nao_verificado",
]);

function Selo({ estado }: { estado: EstadoDoPasso }) {
  const t = useT();
  return (
    <span
      className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", COR_DO_ESTADO[estado])}
    >
      {rotuloDoEstado(t, estado)}
    </span>
  );
}

/** Um passo do mapa: o que é, como sei o estado, e as ações (abrir, marcar, dispensar, criar tarefa). */
export function PassoDoGuia({
  p,
  destaque,
  noPlano = false,
  planoDisponivel = false,
}: {
  p: PassoDiagnosticado;
  destaque?: boolean;
  noPlano?: boolean;
  planoDisponivel?: boolean;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const [dispensando, setDispensando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [horariosAbertos, setHorariosAbertos] = useState(false);

  const atualizar = () => qc.invalidateQueries({ queryKey: CHAVE_DO_GUIA });
  const gravar = (marca: Marca) =>
    apiClient.put(`/api/v1/guia/passos/${p.id}`, {
      estado: marca?.estado ?? null,
      motivo: marca?.motivo ?? null,
    });

  // Como estava antes, para o Ctrl+Z e o "Desfazer" do aviso voltarem exatamente a isso.
  const antes: Marca = p.manual
    ? p.estado === "dispensado"
      ? { estado: "dispensado", motivo: p.evidencia.replace(/^Dispensado:?\s*/, "") || undefined }
      : { estado: "feito" }
    : null;

  async function marcar(marca: Marca, aviso: string) {
    setOcupado(true);
    try {
      await gravar(marca);
      await atualizar();
      registrarDesfazer({
        rotulo: p.titulo,
        desfazer: async () => {
          await gravar(antes);
          await atualizar();
        },
      });
      toast.success(aviso, {
        action: { label: t("Desfazer"), onClick: () => void desfazerUltimo() },
      });
    } catch {
      toast.error(t("Não foi possível salvar a marcação."));
    } finally {
      setOcupado(false);
      setDispensando(false);
      setMotivo("");
    }
  }

  async function criarTarefa() {
    setOcupado(true);
    try {
      await apiClient.post(`/api/v1/guia/passos/${p.id}/tarefa`, {});
      await atualizar();
      toast.success(t("Tarefa criada em Tarefas."));
    } catch {
      toast.error(t("Não foi possível criar a tarefa."));
    } finally {
      setOcupado(false);
    }
  }

  // O "modo na minha conta": copia o prompt do passo já com o Dossiê dentro (cada cópia gera o
  // dossiê na hora e fica registrada na auditoria).
  async function copiarPrompt(id: string) {
    const prompt = promptsDoPasso(p.id).find((x) => x.id === id);
    if (!prompt) return;
    setOcupado(true);
    try {
      const dossie = await buscarDossie("completo");
      if (await copiarTexto(montarPrompt(prompt, dossie.markdown))) {
        toast.success(t("Prompt copiado. Cole na sua IA."));
      } else {
        toast.error(t("Não foi possível copiar. Gere o dossiê na aba Dossiê e IA."));
      }
    } catch {
      toast.error(t("Não foi possível gerar o dossiê agora."));
    } finally {
      setOcupado(false);
    }
  }

  async function porNoPlano() {
    setOcupado(true);
    try {
      await apiClient.put(`/api/v1/guia/plano/${p.id}`, { noPlano: true });
      registrarDesfazer({
        rotulo: p.titulo,
        desfazer: async () => {
          await apiClient.put(`/api/v1/guia/plano/${p.id}`, { noPlano: false });
          await atualizar();
        },
      });
      await atualizar();
      toast.success(t("Passo no plano."), {
        action: { label: t("Desfazer"), onClick: () => void desfazerUltimo() },
      });
    } catch {
      toast.error(t("Não foi possível pôr no plano."));
    } finally {
      setOcupado(false);
    }
  }

  const pedeAcao = PEDE_ACAO.has(p.estado);
  const reabrivel =
    p.manual && (p.estado === "feito" || p.estado === "dispensado" || p.estado === "desatualizado");

  return (
    <li
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border bg-card px-4 py-3",
        destaque && "shadow-sm",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            <span className="mr-1.5 text-xs text-muted-foreground">{p.id}</span>
            {p.titulo}
            {p.classificacao === "E" ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {t("essencial")}
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">{p.porque}</p>
        </div>
        <Selo estado={p.estado} />
      </div>
      <p className="text-xs text-muted-foreground">
        {t("Como sei:")} {p.evidencia}
        {p.aguardando.length > 0 ? ` · ${t("Antes, falta")}: ${p.aguardando.join(", ")}` : ""}
      </p>

      {dispensando ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={500}
            placeholder={t("Por quê? (opcional)")}
            className="h-8 min-w-48 flex-1 rounded-lg border bg-background px-2.5 text-xs"
            autoFocus
          />
          <button
            type="button"
            disabled={ocupado}
            className={BOTAO}
            onClick={() =>
              marcar(
                { estado: "dispensado", motivo: motivo.trim() || undefined },
                t("Passo dispensado."),
              )
            }
          >
            {t("Confirmar")}
          </button>
          <button type="button" className={BOTAO} onClick={() => setDispensando(false)}>
            {t("Cancelar")}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={comRetornoAoGuia(p.onde.href)} className={cn(BOTAO, "text-primary")}>
            {t("Abrir")}: {p.onde.rotulo}
          </Link>
          {pedeAcao ? (
            <>
              <button
                type="button"
                disabled={ocupado}
                className={BOTAO}
                onClick={() => marcar({ estado: "feito" }, t("Passo marcado como feito."))}
              >
                {t("Marcar como feito")}
              </button>
              <button
                type="button"
                disabled={ocupado}
                className={BOTAO}
                onClick={() => setDispensando(true)}
              >
                {t("Dispensar")}
              </button>
            </>
          ) : null}
          {reabrivel ? (
            <button
              type="button"
              disabled={ocupado}
              className={BOTAO}
              onClick={() => marcar(null, t("Passo reaberto."))}
            >
              {t("Reabrir")}
            </button>
          ) : null}
          {p.id === "P42" && pedeAcao ? (
            <button
              type="button"
              className={cn(BOTAO, "border-primary")}
              onClick={() => setHorariosAbertos(true)}
            >
              {t("Definir os horários aqui")}
            </button>
          ) : null}
          {noPlano ? (
            <span className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium">
              {t("No plano")}
            </span>
          ) : planoDisponivel && pedeAcao ? (
            <button
              type="button"
              disabled={ocupado}
              className={BOTAO}
              onClick={() => void porNoPlano()}
            >
              {t("Pôr no plano")}
            </button>
          ) : null}
          {promptsDoPasso(p.id).map((x) => (
            <button
              key={x.id}
              type="button"
              disabled={ocupado}
              className={BOTAO}
              onClick={() => void copiarPrompt(x.id)}
            >
              {t("Copiar prompt")}: {x.titulo}
            </button>
          ))}
          {p.tarefaId ? (
            <Link href="/app/tarefas" className={BOTAO}>
              {t("Tarefa criada · ver em Tarefas")}
            </Link>
          ) : pedeAcao ? (
            <button type="button" disabled={ocupado} className={BOTAO} onClick={criarTarefa}>
              {t("Criar tarefa")}
            </button>
          ) : null}
        </div>
      )}
      {p.id === "P42" ? (
        <AssistenteDeHorarios aberto={horariosAbertos} aoFechar={() => setHorariosAbertos(false)} />
      ) : null}
    </li>
  );
}
