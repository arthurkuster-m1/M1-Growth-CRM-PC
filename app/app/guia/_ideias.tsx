"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import { passoPorId } from "@/lib/guia/catalogo";
import type { LIMIARES, REGRAS_DE_IDEIA } from "@/lib/guia/ideias";
import type { AprendizadoDoGuia, IdeiaDoGuia, VereditoHumano } from "@/lib/guia/ideias-guardadas";
import { desfazerUltimo, registrarDesfazer } from "@/lib/motor/desfazer";
import { cn } from "@/lib/utils";

import type { Traduzir } from "./_rotulos";

interface RespostaDasIdeias {
  ideias: IdeiaDoGuia[];
  aprendizados: AprendizadoDoGuia[];
  regras: typeof REGRAS_DE_IDEIA;
  limiares: typeof LIMIARES;
}

const CHAVE = ["guia", "ideias"] as const;
const BOTAO =
  "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-60";

const rotuloDoVeredito = (t: Traduzir, v: VereditoHumano) =>
  v === "funcionou"
    ? t("Funcionou")
    : v === "nao_funcionou"
      ? t("Não funcionou")
      : t("Inconclusivo");

const dataCurta = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");

function Prioridade({ p }: { p: 1 | 2 | 3 }) {
  const t = useT();
  const [rotulo, cor] =
    p === 1
      ? [t("Alta"), "bg-warning-bg text-warning-fg"]
      : p === 2
        ? [t("Média"), "bg-secondary text-foreground"]
        : [t("Baixa"), "bg-secondary text-muted-foreground"];
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", cor)}>
      {rotulo}
    </span>
  );
}

/** Uma ideia: o que o sistema viu (a evidência), o que sugere, e o que a pessoa decide. */
function CartaoDaIdeia({ i }: { i: IdeiaDoGuia }) {
  const t = useT();
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const [dispensando, setDispensando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [resultado, setResultado] = useState("");

  const atualizar = () => qc.invalidateQueries({ queryKey: CHAVE });
  const enviar = (corpo: Record<string, unknown>) =>
    apiClient.patch(`/api/v1/guia/ideias/${i.id}`, corpo);

  async function decidir(corpo: Record<string, unknown>, aviso: string, comDesfazer: boolean) {
    setOcupado(true);
    try {
      await enviar(corpo);
      await atualizar();
      if (comDesfazer) {
        registrarDesfazer({
          rotulo: i.titulo,
          desfazer: async () => {
            await enviar({ acao: "reabrir" });
            await atualizar();
          },
        });
        toast.success(aviso, {
          action: { label: t("Desfazer"), onClick: () => void desfazerUltimo() },
        });
      } else {
        toast.success(aviso);
      }
    } catch (e) {
      toast.error(
        e instanceof ApiError && e.status === 409
          ? t("A ideia já mudou. Atualize a tela.")
          : t("Não foi possível salvar a decisão."),
      );
    } finally {
      setOcupado(false);
      setDispensando(false);
      setMotivo("");
    }
  }

  const passo = i.passoRelacionado ? passoPorId(i.passoRelacionado) : undefined;
  const paraAvaliar = (i.status === "medida" || i.status === "feita") && !i.veredito;

  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">{i.titulo}</p>
        <Prioridade p={i.prioridade} />
      </div>
      <ul className="grid gap-0.5 text-xs text-muted-foreground">
        {i.evidencia.map((e, k) => (
          <li key={k}>• {e}</li>
        ))}
      </ul>
      {passo ? (
        <p className="text-xs text-muted-foreground">
          {t("Passo do mapa")}: {passo.id} {passo.titulo}
        </p>
      ) : null}

      {i.status === "aceita" ? (
        <p className="text-xs text-muted-foreground">
          {i.medirEm
            ? `${t("Vamos medir de novo em")} ${dataCurta(i.medirEm)}.`
            : t("Marque como feita quando terminar.")}
        </p>
      ) : null}
      {i.status === "dispensada" && i.motivo ? (
        <p className="text-xs text-muted-foreground">
          {t("Dispensada:")} {i.motivo}
        </p>
      ) : null}
      {i.veredito ? (
        <p className="text-xs font-medium">
          {t("Veredito:")} {rotuloDoVeredito(t, i.veredito)}
        </p>
      ) : null}

      {i.resultado ? (
        <div className="grid gap-0.5 rounded-lg bg-secondary px-3 py-2 text-xs">
          <p className="font-medium">{t("Antes → depois")}</p>
          {i.resultado.linhas.map((l, k) => (
            <p key={k}>{l}</p>
          ))}
          <p className="mt-1 text-muted-foreground">
            {t("O sistema acha que")}: {rotuloDoVeredito(t, i.resultado.sugestao).toLowerCase()}.{" "}
            {t("Mas quem decide é você.")}
          </p>
        </div>
      ) : null}

      {paraAvaliar ? (
        <div className="grid gap-2">
          <input
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            maxLength={2000}
            placeholder={t("O que aconteceu? (opcional)")}
            className="h-8 rounded-lg border bg-background px-2.5 text-xs"
          />
          <div className="flex flex-wrap gap-2">
            {(["funcionou", "nao_funcionou", "inconclusivo"] as const).map((v) => (
              <button
                key={v}
                type="button"
                disabled={ocupado}
                className={cn(BOTAO, i.resultado?.sugestao === v && "border-primary")}
                onClick={() =>
                  void decidir(
                    { acao: "veredito", veredito: v, resultado: resultado.trim() || null },
                    t("Aprendizado registrado."),
                    false,
                  )
                }
              >
                {rotuloDoVeredito(t, v)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

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
              void decidir(
                { acao: "dispensar", motivo: motivo.trim() || null },
                t("Ideia dispensada."),
                true,
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
          {i.acaoHref ? (
            <Link href={i.acaoHref} className={cn(BOTAO, "text-primary")}>
              {t("Abrir")}
            </Link>
          ) : null}
          {i.status === "nova" || i.status === "dispensada" ? (
            <>
              <button
                type="button"
                disabled={ocupado}
                className={BOTAO}
                onClick={() =>
                  void decidir(
                    { acao: "aceitar", criarTarefa: true },
                    t("Ideia aceita, com tarefa."),
                    true,
                  )
                }
              >
                {t("Aceitar e criar tarefa")}
              </button>
              <button
                type="button"
                disabled={ocupado}
                className={BOTAO}
                onClick={() =>
                  void decidir({ acao: "aceitar", criarTarefa: false }, t("Ideia aceita."), true)
                }
              >
                {t("Aceitar sem tarefa")}
              </button>
            </>
          ) : null}
          {i.status === "nova" || i.status === "aceita" ? (
            <button
              type="button"
              disabled={ocupado}
              className={BOTAO}
              onClick={() => setDispensando(true)}
            >
              {t("Dispensar")}
            </button>
          ) : null}
          {i.status === "aceita" ? (
            <button
              type="button"
              disabled={ocupado}
              className={BOTAO}
              onClick={() => void decidir({ acao: "feita" }, t("Ideia marcada como feita."), true)}
            >
              {t("Marcar como feita")}
            </button>
          ) : null}
          {(i.status === "aceita" ||
            i.status === "dispensada" ||
            (i.status === "feita" && !i.veredito)) &&
          !i.veredito ? (
            <button
              type="button"
              disabled={ocupado}
              className={BOTAO}
              onClick={() => void decidir({ acao: "reabrir" }, t("Ideia reaberta."), false)}
            >
              {t("Reabrir")}
            </button>
          ) : null}
          {i.tarefaId ? (
            <Link href="/app/tarefas" className={BOTAO}>
              {t("Tarefa criada · ver em Tarefas")}
            </Link>
          ) : null}
        </div>
      )}
    </li>
  );
}

/** Um grupo de ideias com título e contagem (some se estiver vazio). */
function GrupoDeIdeias({ titulo, lista }: { titulo: string; lista: IdeiaDoGuia[] }) {
  if (lista.length === 0) return null;
  return (
    <section aria-label={titulo} className="grid gap-2">
      <h2 className="text-base font-semibold">
        {titulo} <span className="text-sm font-normal text-muted-foreground">({lista.length})</span>
      </h2>
      <ul className="grid gap-2">
        {lista.map((i) => (
          <CartaoDaIdeia key={i.id} i={i} />
        ))}
      </ul>
    </section>
  );
}

function RegistrarAprendizado() {
  const t = useT();
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [hipotese, setHipotese] = useState("");
  const [resultado, setResultado] = useState("");
  const [veredito, setVeredito] = useState<VereditoHumano>("funcionou");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!titulo.trim()) return toast.error(t("Diga o que foi feito."));
    setSalvando(true);
    try {
      await apiClient.post("/api/v1/guia/aprendizados", {
        titulo: titulo.trim(),
        hipotese: hipotese.trim() || null,
        resultado: resultado.trim() || null,
        veredito,
      });
      await qc.invalidateQueries({ queryKey: CHAVE });
      setTitulo("");
      setHipotese("");
      setResultado("");
      toast.success(t("Aprendizado registrado."));
    } catch {
      toast.error(t("Não foi possível salvar o aprendizado."));
    } finally {
      setSalvando(false);
    }
  }

  const campo = "h-9 rounded-lg border bg-background px-2.5 text-sm";
  return (
    <div className="grid gap-2 rounded-xl border border-dashed p-3">
      <p className="text-sm font-medium">{t("Registrar um aprendizado")}</p>
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        maxLength={200}
        placeholder={t("O que foi feito?")}
        className={campo}
      />
      <input
        value={hipotese}
        onChange={(e) => setHipotese(e.target.value)}
        maxLength={1000}
        placeholder={t("O que esperávamos? (opcional)")}
        className={campo}
      />
      <input
        value={resultado}
        onChange={(e) => setResultado(e.target.value)}
        maxLength={2000}
        placeholder={t("O que aconteceu? (opcional)")}
        className={campo}
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={veredito}
          onChange={(e) => setVeredito(e.target.value as VereditoHumano)}
          className={campo}
        >
          {(["funcionou", "nao_funcionou", "inconclusivo"] as const).map((v) => (
            <option key={v} value={v}>
              {rotuloDoVeredito(t, v)}
            </option>
          ))}
        </select>
        <button type="button" disabled={salvando} className={BOTAO} onClick={() => void salvar()}>
          {t("Registrar")}
        </button>
      </div>
    </div>
  );
}

/** A aba Ideias: o que o sistema sugere a partir dos resultados, e o que a equipe aprendeu. */
export function IdeiasDoGuia({ temPerfil }: { temPerfil: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const [gerando, setGerando] = useState(false);
  const q = useQuery({
    queryKey: CHAVE,
    queryFn: async () =>
      (await apiClient.get<{ data: RespostaDasIdeias }>("/api/v1/guia/ideias")).data,
    retry: false,
  });

  async function atualizarIdeias() {
    setGerando(true);
    try {
      const r = await apiClient.post<{ data: { criadas: number; medidas: number } }>(
        "/api/v1/guia/ideias/gerar",
        {},
      );
      await qc.invalidateQueries({ queryKey: CHAVE });
      const { criadas, medidas } = r.data;
      toast.success(
        criadas + medidas === 0
          ? t("Nada de novo: os números não pedem nenhuma ideia agora.")
          : `${criadas} ${criadas === 1 ? t("ideia nova") : t("ideias novas")} · ${medidas} ${medidas === 1 ? t("medida") : t("medidas")}`,
      );
    } catch {
      toast.error(t("Não foi possível atualizar as ideias agora."));
    } finally {
      setGerando(false);
    }
  }

  if (q.isLoading)
    return <div className="h-40 animate-pulse rounded-3xl bg-secondary" aria-busy="true" />;
  if (q.isError || !q.data) {
    const sem = q.error instanceof ApiError && q.error.code === "guia_ideias_sem_migration";
    return (
      <p
        role="alert"
        className="rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning-fg"
      >
        {sem
          ? t(
              "O banco ainda não recebeu a atualização das ideias. Peça para aplicá-la na VPS; o resto do Guia segue funcionando.",
            )
          : t("Não foi possível carregar as ideias.")}
      </p>
    );
  }

  const { ideias, aprendizados, regras, limiares } = q.data;
  const novas = ideias.filter((i) => i.status === "nova");
  const aceitas = ideias.filter((i) => i.status === "aceita");
  const paraAvaliar = ideias.filter(
    (i) => (i.status === "medida" || i.status === "feita") && !i.veredito,
  );
  const resolvidas = ideias.filter((i) => i.status === "dispensada" || !!i.veredito);

  return (
    <div className="flex flex-col gap-5" data-testid="guia-ideias">
      <section className="grid gap-2 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("Ideias a partir dos resultados")}</h2>
            <p className="text-xs text-muted-foreground">
              {t(
                "O sistema olha as campanhas todo dia e sugere o que fazer. Só sugere: quem decide é você.",
              )}
            </p>
          </div>
          <button
            type="button"
            className={BOTAO}
            disabled={gerando || !temPerfil}
            onClick={() => void atualizarIdeias()}
          >
            {gerando ? t("Atualizando…") : t("Atualizar ideias")}
          </button>
        </div>
        {!temPerfil ? (
          <p className="text-xs text-muted-foreground">
            {t("Preencha o perfil do negócio para gerar ideias.")}
          </p>
        ) : null}
        {temPerfil && ideias.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("Nenhuma ideia ainda. Elas aparecem quando há campanha com números para olhar.")}
          </p>
        ) : null}
      </section>

      <GrupoDeIdeias titulo={t("Para decidir")} lista={novas} />
      <GrupoDeIdeias titulo={t("Em andamento")} lista={aceitas} />
      <GrupoDeIdeias titulo={t("Para avaliar")} lista={paraAvaliar} />

      <section aria-label={t("Aprendizados")} className="grid gap-2 rounded-2xl border bg-card p-4">
        <h2 className="text-base font-semibold">{t("Aprendizados")}</h2>
        {aprendizados.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t(
              "Nada registrado ainda. O que funcionou e o que não funcionou entra no dossiê para a IA não repetir erro.",
            )}
          </p>
        ) : (
          <ul className="grid gap-1.5 text-sm">
            {aprendizados.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-2">
                <span className="font-medium">{rotuloDoVeredito(t, a.veredito)}</span>
                <span>— {a.titulo}</span>
                {a.resultado ? (
                  <span className="text-muted-foreground">({a.resultado})</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <RegistrarAprendizado />
      </section>

      {resolvidas.length > 0 ? (
        <details className="rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer text-base font-semibold">
            {t("Resolvidas")} ({resolvidas.length})
          </summary>
          <ul className="mt-3 grid gap-2">
            {resolvidas.map((i) => (
              <CartaoDaIdeia key={i.id} i={i} />
            ))}
          </ul>
        </details>
      ) : null}

      <details className="rounded-2xl border bg-card p-4">
        <summary className="cursor-pointer text-base font-semibold">
          {t("Regras e limiares")}
        </summary>
        <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
          <ul className="grid gap-0.5">
            {regras.map((r) => (
              <li key={r.id}>
                {r.id} · {r.nome}
              </li>
            ))}
          </ul>
          <p>
            {t("Custo por lead")} ≥ {limiares.cplAcimaDaMeta}× {t("a meta")} · {t("taxa de clique")}{" "}
            &lt; {(limiares.ctrMinimo * 100).toFixed(1)}% · {t("frequência")} &gt;{" "}
            {limiares.frequenciaMaxima} · {t("agendamentos")} &lt;{" "}
            {limiares.agendamentoMinimo * 100}% {t("dos leads")} · {t("vendas")} &lt;{" "}
            {limiares.vendaMinima * 100}% {t("das reuniões")} · {t("no máximo")}{" "}
            {limiares.maximoDeAbertas} {t("ideias abertas")}.
          </p>
          <p>
            {t(
              "Estes limites são os iniciais e ainda não dá para mudá-los pela tela. R05 (no-show) e R08 (qualidade do lead) ainda não existem: o sistema não mede esses dois dados.",
            )}
          </p>
        </div>
      </details>
    </div>
  );
}
