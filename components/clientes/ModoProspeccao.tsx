"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { BotaoWhatsApp } from "@/components/clientes/BotaoWhatsApp";
import { useAbordagensDasCampanhas } from "@/components/clientes/ConfigDaProspeccaoDialog";
import { ConfirmarDataDaProximaAcao } from "@/components/clientes/ConfirmarDataDaProximaAcao";
import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { SeletorDeOpcao, type OpcaoDoSeletor } from "@/components/motor/SeletorDeOpcao";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { aplicarResultadoRapido } from "@/lib/leads/aplicar-resultado-rapido";
import type { ConfigDaProspeccao } from "@/lib/leads/config-de-prospeccao";
import { aplicarVariaveis } from "@/lib/leads/mensagem-de-prospeccao";
import { RESULTADOS_RAPIDOS, somarDiasUteis } from "@/lib/leads/resultados-rapidos";
import { InstagramLogo, Phone } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface LeadDaProspeccao {
  chave: string;
  leadId: string;
  contactId: string;
  funilId: string;
  funilNome: string;
  etapaId: string;
  campanhaId: string | null;
  nome: string;
  titulo: string;
  telefone: string | null;
  instagram: string | null;
  conversaId: string | null;
  produto: string;
  campanha: string;
  responsavel: string;
  comentarios: string;
  proximaAcao: string;
  proximaAcaoEm: string | null;
  tentativas: number;
  ultimaTentativa: string | null;
}

type Resultado = (typeof RESULTADOS_RAPIDOS)[number];
const hojeIso = () => new Intl.DateTimeFormat("en-CA").format(new Date());
const MEIO_DO_TIPO = { ligacao: "ligacao", whatsapp: "whatsapp", instagram: "instagram", outro: "" } as const;

/**
 * O MODO PROSPECÇÃO: o lead da vez numa tela só, sobre a lista que está filtrada na tabela. O
 * resultado da ligação registra na linha do tempo (quem atendeu precisa dizer o que foi
 * conversado) e a tela FICA no mesmo lead, para definir a próxima ação antes de seguir.
 *
 * Atalhos: 1–6 resultado · → ou N próximo · ← ou P anterior.
 */
export function ModoProspeccao({
  itens,
  config,
  etapasDe,
  aoMoverEtapa,
  aoFechar,
  aoPerder,
  aoAbrirOportunidade,
}: {
  itens: LeadDaProspeccao[];
  config: ConfigDaProspeccao;
  etapasDe: (funilId: string) => OpcaoDoSeletor[];
  aoMoverEtapa: (item: LeadDaProspeccao, etapaId: string) => void;
  aoFechar: () => void;
  aoPerder: (item: LeadDaProspeccao) => void;
  aoAbrirOportunidade: (item: LeadDaProspeccao) => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [idx, setIdx] = useState(0);
  const [salvos, setSalvos] = useState<Record<string, Partial<LeadDaProspeccao>>>({});
  const base = itens[idx];
  const item = base ? { ...base, ...salvos[base.chave] } : undefined;
  const [comentarios, setComentarios] = useState(item?.comentarios ?? "");
  const [passo, setPasso] = useState(item?.proximaAcao ?? "");
  const [retornoAberto, setRetornoAberto] = useState(false);
  const [dataDoRetorno, setDataDoRetorno] = useState(somarDiasUteis(hojeIso(), 1));
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [pedindo, setPedindo] = useState<{ r: Resultado; data?: string } | null>(null);
  const [textoDoResultado, setTextoDoResultado] = useState("");
  const [registrado, setRegistrado] = useState<Record<string, string>>({});
  const ultimaChave = useRef<string | null>(null);
  const campoDoPasso = useRef<HTMLInputElement | null>(null);

  const p = config.propriedades;
  const resultadosAtivos = RESULTADOS_RAPIDOS.filter((r) => config.atalhos[r.id]);

  useEffect(() => {
    if (!item || ultimaChave.current === item.chave) return;
    ultimaChave.current = item.chave;
    setComentarios(item.comentarios);
    setPasso(item.proximaAcao);
    setRetornoAberto(false);
  }, [item]);

  const melhor = useQuery({
    queryKey: ["melhor-horario", item?.contactId],
    enabled: Boolean(item) && p.melhorHorario,
    staleTime: 5 * 60_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { melhor: { faixa: string; base: number } | null } }>(
          `/api/v1/contacts/${item!.contactId}/melhor-horario`,
        )
      ).data.melhor,
  });

  // A abordagem (roteiro) do lead: a escolhida na configuração, ou a da campanha dele.
  const campanhaDoLead = item?.campanhaId ? [item.campanhaId] : [];
  const abordagens = useAbordagensDasCampanhas(campanhaDoLead);
  const abordagem = (() => {
    if (config.abordagemId === "nenhuma") return null;
    const lista = abordagens.data ?? [];
    if (config.abordagemId !== "auto") return lista.find((a) => a.id === config.abordagemId) ?? null;
    const meio = MEIO_DO_TIPO[config.tipo];
    return lista.find((a) => a.medium === meio) ?? lista[0] ?? null;
  })();

  const proximo = () => setIdx((i) => Math.min(itens.length - 1, i + 1));
  const anterior = () => setIdx((i) => Math.max(0, i - 1));

  async function registrar(r: Resultado, dataEscolhida: string | undefined, comentario: string) {
    if (!item || ocupado) return;
    setOcupado(true);
    try {
      const comPasso = "proximo" in r;
      const dias = "diasUteis" in r ? r.diasUteis : 0;
      await aplicarResultadoRapido({
        leadId: item.leadId,
        contactId: item.contactId,
        resultado: r.resultado,
        comentario,
        proximo: comPasso
          ? { texto: t(r.proximo), em: dataEscolhida ?? somarDiasUteis(hojeIso(), dias) }
          : undefined,
      });
      await qc.invalidateQueries({ queryKey: ["clientes"] });
      setRegistrado((m) => ({ ...m, [item.chave]: t(r.rotulo) }));
      if (comPasso) {
        // A cadência marcou o próximo passo: já aparece no campo, para ajustar se preciso.
        const texto = t(r.proximo);
        setPasso(texto);
        setSalvos((o) => ({
          ...o,
          [item.chave]: {
            ...o[item.chave],
            proximaAcao: texto,
            proximaAcaoEm: dataEscolhida ?? somarDiasUteis(hojeIso(), dias),
          },
        }));
      }
      if ("perde" in r && r.perde) aoPerder(item);
      else window.setTimeout(() => campoDoPasso.current?.focus(), 50);
    } catch (e) {
      showApiError(e);
    } finally {
      setOcupado(false);
    }
  }

  function iniciar(r: Resultado, data?: string) {
    if ("pedeData" in r && r.pedeData && !data) {
      setRetornoAberto(true);
      return;
    }
    // Quem atendeu: o que foi conversado é obrigatório. Não atendeu / caixa postal: sem comentário.
    if ("exigeComentario" in r && r.exigeComentario) {
      setTextoDoResultado("");
      setPedindo({ r, data });
      return;
    }
    void registrar(r, data, "");
  }

  const iniciarRef = useRef(iniciar);
  useEffect(() => {
    iniciarRef.current = iniciar;
  });
  useEffect(() => {
    const aoTecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest("input, textarea, select, [contenteditable='true'], [role='dialog'] [role='dialog']")) return;
      if (pedindo || confirmando !== null) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= resultadosAtivos.length) {
        e.preventDefault();
        iniciarRef.current(resultadosAtivos[n - 1]!);
      } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "n") {
        e.preventDefault();
        proximo();
      } else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "p") {
        e.preventDefault();
        anterior();
      }
    };
    document.addEventListener("keydown", aoTecla);
    return () => document.removeEventListener("keydown", aoTecla);
  });

  async function salvarComentarios() {
    if (!item || comentarios.trim() === item.comentarios.trim()) return;
    try {
      await apiClient.patch(`/api/v1/vendas/${item.leadId}`, { notes: comentarios.trim() });
      setSalvos((o) => ({ ...o, [item.chave]: { ...o[item.chave], comentarios: comentarios.trim() } }));
      await qc.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e) {
      showApiError(e);
    }
  }

  if (!item) {
    return (
      <Dialog open onOpenChange={(a) => !a && aoFechar()}>
        <DialogContent className="max-w-md">
          <DialogTitle>{t("Modo prospecção")}</DialogTitle>
          <DialogDescription>{t("Nenhuma oportunidade aberta na lista atual.")}</DialogDescription>
        </DialogContent>
      </Dialog>
    );
  }

  const digitos = (item.telefone ?? "").replace(/\D/g, "");
  const botao =
    "h-9 rounded-xl border px-3 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50";
  const etapas = etapasDe(item.funilId);
  const etapaAtual = etapas.find((e) => e.id === (salvos[item.chave]?.etapaId ?? item.etapaId));
  const insta = item.instagram && /^https?:\/\//i.test(item.instagram) ? item.instagram : null;

  return (
    <>
      <Dialog open onOpenChange={(a) => !a && aoFechar()}>
        <DialogContent className="max-h-[92vh] max-w-3xl gap-4 overflow-y-auto p-5 sm:rounded-2xl">
          <div className="flex items-center justify-between gap-2 pr-8">
            <p className="text-sm font-semibold">
              {t("Modo prospecção")} · {idx + 1} {t("de")} {itens.length}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={anterior} disabled={idx === 0} className={botao}>
                ← {t("Anterior")}
              </button>
              <button type="button" onClick={proximo} disabled={idx >= itens.length - 1} className={botao}>
                {t("Próximo")} →
              </button>
            </div>
          </div>

          <section className="grid gap-3 rounded-2xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold break-words">{item.titulo}</DialogTitle>
                <DialogDescription className="text-sm break-words">
                  {item.funilNome} · {item.nome}
                </DialogDescription>
              </div>
              {etapas.length > 0 ? (
                <div className="w-48 shrink-0">
                  <SeletorDeOpcao
                    opcoes={etapas}
                    valorId={etapaAtual?.id}
                    podeEditar
                    rotulo={t("Etapa no funil")}
                    aoEscolher={(id) => {
                      if (id === etapaAtual?.id) return;
                      setSalvos((o) => ({ ...o, [item.chave]: { ...o[item.chave], etapaId: id } }));
                      aoMoverEtapa(item, id);
                    }}
                  >
                    <Etiqueta ponto cor={etapaAtual?.cor ?? "gray"}>
                      {etapaAtual?.rotulo ?? "—"}
                    </Etiqueta>
                  </SeletorDeOpcao>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {p.telefone && item.telefone ? (
                <span className="inline-flex h-10 items-center rounded-xl bg-secondary px-3 text-sm font-semibold tabular-nums">
                  {item.telefone}
                </span>
              ) : null}
              {p.ligar && item.telefone ? (
                <a
                  href={`tel:${item.telefone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  <Phone size={16} aria-hidden />
                  {t("Ligar")}
                </a>
              ) : null}
              {p.whatsapp && digitos ? (
                <BotaoWhatsApp
                  telefone={item.telefone}
                  dados={{
                    nome: item.nome,
                    produto: item.produto,
                    campanha: item.campanha,
                    responsavel: item.responsavel,
                  }}
                  className="mx-0"
                />
              ) : null}
              {p.instagram && insta ? (
                <a
                  href={insta}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(botao, "inline-flex items-center gap-1.5")}
                >
                  <InstagramLogo size={14} aria-hidden />
                  Instagram
                </a>
              ) : null}
              {p.inbox && item.conversaId ? (
                <Link href={`/app/inbox?id=${item.conversaId}`} className={botao + " inline-flex items-center"}>
                  {t("Abrir no Inbox")}
                </Link>
              ) : null}
              {p.ficha ? (
                <Link href={`/app/contacts/${item.contactId}`} className={botao + " inline-flex items-center"}>
                  {t("Ficha do lead")}
                </Link>
              ) : null}
              <button type="button" onClick={() => aoAbrirOportunidade(item)} className={botao}>
                {t("Abrir oportunidade")}
              </button>
            </div>
            {p.tentativas || (p.melhorHorario && melhor.data) ? (
              <p className="text-xs text-muted-foreground">
                {p.tentativas
                  ? item.tentativas === 0
                    ? t("Nenhuma tentativa de ligação ainda.")
                    : `${item.tentativas} ${item.tentativas === 1 ? t("tentativa") : t("tentativas")}`
                  : ""}
                {p.melhorHorario && melhor.data
                  ? ` · ${t("melhor horário para ligar:")} ${melhor.data.faixa} (${melhor.data.base} ${t("sinais")})`
                  : ""}
              </p>
            ) : null}
          </section>

          {abordagem ? (
            <details className="rounded-2xl border px-4 py-2">
              <summary className="cursor-pointer text-sm font-semibold">
                {t("Abordagem")}: {abordagem.name}
              </summary>
              <div className="mt-2 grid gap-2 pb-2 text-sm">
                {abordagem.hook ? (
                  <p>
                    <strong>{t("Gancho:")}</strong> {abordagem.hook}
                  </p>
                ) : null}
                {abordagem.script ? (
                  <p className="whitespace-pre-wrap">
                    {aplicarVariaveis(abordagem.script, {
                      nome: item.nome,
                      produto: item.produto,
                      campanha: item.campanha,
                      responsavel: item.responsavel,
                    })}
                  </p>
                ) : null}
                {abordagem.follow_up ? (
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    <strong>{t("Follow-up:")}</strong> {abordagem.follow_up}
                  </p>
                ) : null}
              </div>
            </details>
          ) : null}

          <section className="grid gap-2 rounded-2xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("Resultado")}
              </p>
              {registrado[item.chave] ? (
                <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
                  {t("Registrado")}: {registrado[item.chave]} — {t("defina a próxima ação abaixo")}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {resultadosAtivos.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={ocupado}
                  onClick={() => iniciar(r)}
                  className={cn(botao, "perde" in r && r.perde && "text-error-fg")}
                >
                  <kbd className="mr-1.5 rounded-md border px-1 text-[10px] text-muted-foreground">{i + 1}</kbd>
                  {t(r.rotulo)}
                </button>
              ))}
            </div>
            {retornoAberto ? (
              <div className="flex flex-wrap items-end gap-2 rounded-xl bg-secondary/50 p-3">
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">{t("Retornar a ligação em")}</span>
                  <CampoDeData valor={dataDoRetorno} aoMudar={setDataDoRetorno} rotulo={t("Data do retorno")} limpavel={false} />
                </div>
                <button
                  type="button"
                  disabled={ocupado || !dataDoRetorno}
                  onClick={() => {
                    const r = RESULTADOS_RAPIDOS.find((x) => x.id === "retornar")!;
                    setRetornoAberto(false);
                    iniciar(r, dataDoRetorno);
                  }}
                  className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {t("Continuar")}
                </button>
              </div>
            ) : null}
          </section>

          {p.proximaAcao || p.comentarios ? (
            <section className="grid gap-3 rounded-2xl border p-4">
              {p.proximaAcao ? (
                <label className="grid gap-1">
                  <span className="text-xs text-muted-foreground">{t("Próxima ação")}</span>
                  <input
                    ref={campoDoPasso}
                    value={passo}
                    maxLength={300}
                    onChange={(e) => setPasso(e.target.value)}
                    onBlur={() => {
                      if (passo.trim() !== item.proximaAcao.trim()) setConfirmando(passo.trim());
                    }}
                    placeholder={t("Ex.: Ligar na terça com a proposta")}
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60"
                  />
                  <span className="text-xs text-muted-foreground">
                    {item.proximaAcaoEm
                      ? `${t("Para")} ${item.proximaAcaoEm.split("-").reverse().join("/")}`
                      : t("Sem data marcada.")}
                  </span>
                </label>
              ) : null}
              {p.comentarios ? (
                <label className="grid gap-1">
                  <span className="text-xs text-muted-foreground">{t("Comentários")}</span>
                  <textarea
                    rows={4}
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                    onBlur={() => void salvarComentarios()}
                    placeholder={t("Anotações rápidas sobre esta oportunidade…")}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-hidden focus:border-primary/60"
                  />
                </label>
              ) : null}
            </section>
          ) : null}
        </DialogContent>
      </Dialog>

      {pedindo ? (
        <Dialog open onOpenChange={(a) => !a && setPedindo(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("O que foi conversado?")}</DialogTitle>
              <DialogDescription>
                {t(pedindo.r.rotulo)} — {t("registre o que foi alinhado com o lead. É obrigatório.")}
              </DialogDescription>
            </DialogHeader>
            <textarea
              autoFocus
              rows={5}
              value={textoDoResultado}
              onChange={(e) => setTextoDoResultado(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && textoDoResultado.trim().length >= 5) {
                  const { r, data } = pedindo;
                  setPedindo(null);
                  void registrar(r, data, textoDoResultado.trim());
                }
              }}
              placeholder={t("Impressões, objeções, o que ficou combinado…")}
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-hidden focus:border-primary/60"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{t("Ctrl+Enter registra")}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPedindo(null)} className={botao}>
                  {t("Cancelar")}
                </button>
                <button
                  type="button"
                  disabled={textoDoResultado.trim().length < 5}
                  onClick={() => {
                    const { r, data } = pedindo;
                    setPedindo(null);
                    void registrar(r, data, textoDoResultado.trim());
                  }}
                  className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {t("Registrar")}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {confirmando !== null ? (
        <ConfirmarDataDaProximaAcao
          texto={confirmando}
          dataAtual={item.proximaAcaoEm}
          aoCancelar={() => {
            setConfirmando(null);
            setPasso(item.proximaAcao);
          }}
          aoConfirmar={async (data) => {
            const texto = confirmando;
            setConfirmando(null);
            try {
              await apiClient.put(`/api/v1/leads/${item.leadId}/proxima-acao`, {
                proxima_acao: texto,
                proxima_acao_em: data,
              });
              setSalvos((o) => ({
                ...o,
                [item.chave]: { ...o[item.chave], proximaAcao: texto, proximaAcaoEm: data },
              }));
              await qc.invalidateQueries({ queryKey: ["clientes"] });
            } catch (e) {
              showApiError(e);
            }
          }}
        />
      ) : null}
    </>
  );
}
