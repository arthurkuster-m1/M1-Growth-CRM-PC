"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { BotaoWhatsApp } from "@/components/clientes/BotaoWhatsApp";
import { ConfirmarDataDaProximaAcao } from "@/components/clientes/ConfirmarDataDaProximaAcao";
import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { aplicarResultadoRapido } from "@/lib/leads/aplicar-resultado-rapido";
import { RESULTADOS_RAPIDOS, somarDiasUteis } from "@/lib/leads/resultados-rapidos";
import { InstagramLogo, Phone } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface LeadDaProspeccao {
  chave: string;
  leadId: string;
  contactId: string;
  funilId: string;
  nome: string;
  titulo: string;
  telefone: string | null;
  instagram: string | null;
  produto: string;
  campanha: string;
  responsavel: string;
  comentarios: string;
  proximaAcao: string;
  proximaAcaoEm: string | null;
  tentativas: number;
  ultimaTentativa: string | null;
}

const hojeIso = () => new Intl.DateTimeFormat("en-CA").format(new Date());

/**
 * O MODO PROSPECÇÃO: uma tela só com o lead da vez (telefone, WhatsApp com mensagem pronta,
 * comentários, próximo passo e os botões de resultado) e "próximo" pela lista filtrada.
 *
 * Atalhos: 1–6 registram o resultado · → ou N próximo · ← ou P anterior · Esc fecha.
 */
export function ModoProspeccao({
  itens,
  inicio = 0,
  aoFechar,
  aoPerder,
  aoAbrirOportunidade,
}: {
  itens: LeadDaProspeccao[];
  inicio?: number;
  aoFechar: () => void;
  aoPerder: (item: LeadDaProspeccao) => void;
  aoAbrirOportunidade: (item: LeadDaProspeccao) => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [idx, setIdx] = useState(Math.min(Math.max(0, inicio), Math.max(0, itens.length - 1)));
  // O que foi salvo aqui vale na hora, sem esperar a lista recarregar.
  const [salvos, setSalvos] = useState<Record<string, Partial<LeadDaProspeccao>>>({});
  const base = itens[idx];
  const item = base ? { ...base, ...salvos[base.chave] } : undefined;
  const [comentarios, setComentarios] = useState(item?.comentarios ?? "");
  const [passo, setPasso] = useState(item?.proximaAcao ?? "");
  const [retornoAberto, setRetornoAberto] = useState(false);
  const [dataDoRetorno, setDataDoRetorno] = useState(somarDiasUteis(hojeIso(), 1));
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [feitos, setFeitos] = useState<ReadonlySet<string>>(new Set());
  const ultimaChave = useRef<string | null>(null);

  // Ao trocar de lead, os campos voltam ao valor dele.
  useEffect(() => {
    if (!item || ultimaChave.current === item.chave) return;
    ultimaChave.current = item.chave;
    setComentarios(item.comentarios);
    setPasso(item.proximaAcao);
    setRetornoAberto(false);
  }, [item]);

  const melhor = useQuery({
    queryKey: ["melhor-horario", item?.contactId],
    enabled: Boolean(item),
    staleTime: 5 * 60_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { melhor: { faixa: string; base: number } | null } }>(
          `/api/v1/contacts/${item!.contactId}/melhor-horario`,
        )
      ).data.melhor,
  });

  const proximo = () => setIdx((i) => Math.min(itens.length - 1, i + 1));
  const anterior = () => setIdx((i) => Math.max(0, i - 1));

  async function registrar(r: (typeof RESULTADOS_RAPIDOS)[number], dataEscolhida?: string) {
    if (!item || ocupado) return;
    setOcupado(true);
    try {
      const comPasso = "proximo" in r;
      const dias = "diasUteis" in r ? r.diasUteis : 0;
      await aplicarResultadoRapido({
        leadId: item.leadId,
        contactId: item.contactId,
        resultado: r.resultado,
        proximo: comPasso
          ? { texto: t(r.proximo), em: dataEscolhida ?? somarDiasUteis(hojeIso(), dias) }
          : undefined,
      });
      await qc.invalidateQueries({ queryKey: ["clientes"] });
      setFeitos((f) => new Set(f).add(item.chave));
      if ("perde" in r && r.perde) aoPerder(item);
      else proximo();
    } catch (e) {
      showApiError(e);
    } finally {
      setOcupado(false);
    }
  }

  // Atalhos de teclado (sem atrapalhar quem está digitando).
  const registrarRef = useRef(registrar);
  useEffect(() => {
    registrarRef.current = registrar;
  });
  useEffect(() => {
    const aoTecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= RESULTADOS_RAPIDOS.length) {
        const r = RESULTADOS_RAPIDOS[n - 1]!;
        e.preventDefault();
        if ("pedeData" in r && r.pedeData) setRetornoAberto(true);
        else void registrarRef.current(r);
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
  const botao = "h-9 rounded-xl border px-3 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50";

  return (
    <>
      <Dialog open onOpenChange={(a) => !a && aoFechar()}>
        <DialogContent className="max-h-[92vh] max-w-3xl gap-4 overflow-y-auto p-5 sm:rounded-2xl">
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="text-base font-semibold">
              {t("Modo prospecção")} · {idx + 1} {t("de")} {itens.length}
            </DialogTitle>
            <div className="flex gap-2">
              <button type="button" onClick={anterior} disabled={idx === 0} className={botao}>
                ← {t("Anterior")}
              </button>
              <button type="button" onClick={proximo} disabled={idx >= itens.length - 1} className={botao}>
                {t("Próximo")} →
              </button>
            </div>
          </div>
          <DialogDescription className="sr-only">{t("Trabalhe um lead de cada vez.")}</DialogDescription>

          <section className="grid gap-3 rounded-2xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold break-words">{item.nome}</h2>
                <p className="text-sm text-muted-foreground break-words">{item.titulo}</p>
              </div>
              {feitos.has(item.chave) ? (
                <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
                  {t("Registrado")}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {item.telefone ? (
                <a
                  href={`tel:${item.telefone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  <Phone size={16} aria-hidden />
                  {item.telefone}
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">{t("Sem telefone")}</span>
              )}
              {digitos ? (
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
              {item.instagram && /^https?:\/\//i.test(item.instagram) ? (
                <a
                  href={item.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(botao, "inline-flex items-center gap-1.5")}
                >
                  <InstagramLogo size={14} aria-hidden />
                  Instagram
                </a>
              ) : null}
              <Link href={`/app/contacts/${item.contactId}`} className={botao + " inline-flex items-center"}>
                {t("Ficha do lead")}
              </Link>
              <button type="button" onClick={() => aoAbrirOportunidade(item)} className={botao}>
                {t("Abrir oportunidade")}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {item.tentativas === 0
                ? t("Nenhuma tentativa de ligação ainda.")
                : `${item.tentativas} ${item.tentativas === 1 ? t("tentativa") : t("tentativas")}`}
              {melhor.data
                ? ` · ${t("melhor horário para ligar:")} ${melhor.data.faixa} (${melhor.data.base} ${t("sinais")})`
                : ""}
            </p>
          </section>

          <section className="grid gap-2 rounded-2xl border p-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("Resultado da ligação")}
            </p>
            <div className="flex flex-wrap gap-2">
              {RESULTADOS_RAPIDOS.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={ocupado}
                  onClick={() => {
                    if ("pedeData" in r && r.pedeData) setRetornoAberto((a) => !a);
                    else void registrar(r);
                  }}
                  className={cn(botao, "perde" in r && r.perde && "text-error-fg")}
                >
                  <kbd className="mr-1.5 rounded border px-1 text-[10px] text-muted-foreground">{i + 1}</kbd>
                  {t(r.rotulo)}
                </button>
              ))}
            </div>
            {retornoAberto ? (
              <div className="flex flex-wrap items-end gap-2 rounded-xl bg-secondary/50 p-3">
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">{t("Retornar a ligação em")}</span>
                  <CampoDeData
                    valor={dataDoRetorno}
                    aoMudar={setDataDoRetorno}
                    rotulo={t("Data do retorno")}
                    limpavel={false}
                  />
                </div>
                <button
                  type="button"
                  disabled={ocupado || !dataDoRetorno}
                  onClick={() => {
                    const r = RESULTADOS_RAPIDOS.find((x) => x.id === "retornar")!;
                    setRetornoAberto(false);
                    void registrar(r, dataDoRetorno);
                  }}
                  className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {t("Registrar")}
                </button>
              </div>
            ) : null}
          </section>

          <section className="grid gap-3 rounded-2xl border p-4">
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">{t("Próxima ação")}</span>
              <input
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
          </section>
        </DialogContent>
      </Dialog>

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
