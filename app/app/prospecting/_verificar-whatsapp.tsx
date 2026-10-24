"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { ResumoDaVerificacao } from "@/lib/prospecting/verificar-whatsapp";

interface Canal {
  id: string;
  display_name: string | null;
  phone_number: string | null;
}

/**
 * VERIFICAR WHATSAPP: pergunta ao WhatsApp, pela conexão escolhida, se o número de cada empresa
 * marcada existe — antes de abordar. Roda em lotes pequenos (o servidor pausa entre as consultas)
 * e a tela repete até acabar. Quem não tem WhatsApp sai da fila; "incerta" é quando a consulta
 * falhou e dá para tentar de novo.
 */
export function VerificarWhatsapp({
  campanhaId,
  canais,
  canalInicial,
  contagem,
  aoTerminar,
}: {
  campanhaId: string;
  /** As conexões de WhatsApp comum (WAHA). */
  canais: readonly Canal[];
  canalInicial: string;
  contagem: { tem: number; naoTem: number; incerta: number; pendente: number };
  aoTerminar: () => Promise<unknown>;
}) {
  const t = useT();
  const [canal, setCanal] = useState(
    canais.some((c) => c.id === canalInicial) ? canalInicial : (canais[0]?.id ?? ""),
  );
  const [rodando, setRodando] = useState(false);
  const [feitas, setFeitas] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  async function rodar(refazerIncertas: boolean) {
    if (!canal) return;
    setRodando(true);
    setErro(null);
    setFeitas(0);
    try {
      let primeira = true;
      for (let volta = 0; volta < 50; volta++) {
        const r = await apiClient.post<{ data: ResumoDaVerificacao }>("/api/v1/prospecting", {
          action: "verify_whatsapp",
          id: campanhaId,
          channel_session_id: canal,
          ...(primeira && refazerIncertas ? { refazer_incertas: true } : {}),
        });
        primeira = false;
        setFeitas((n) => n + r.data.verificadas);
        await aoTerminar();
        // Terminou quando não sobra ninguém, ou quando o lote não andou (nada a fazer).
        if (r.data.restantes === 0 || r.data.verificadas === 0) break;
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("Não foi possível verificar agora."));
    } finally {
      setRodando(false);
    }
  }

  if (canais.length === 0) {
    return (
      <div className="border-b px-5 py-3 text-sm text-muted-foreground">
        {t(
          "Para verificar quem tem WhatsApp, conecte um número de WhatsApp comum em Canais. As conexões oficiais da Meta não têm essa consulta.",
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-2 border-b px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t("Verificar WhatsApp")}</span>
        <select
          aria-label={t("Conexão para verificar")}
          value={canal}
          onChange={(e) => setCanal(e.target.value)}
          disabled={rodando}
          className="h-9 rounded-full border bg-card px-3 text-sm"
        >
          {canais.map((session) => (
            <option key={session.id} value={session.id}>
              {session.display_name || session.phone_number || session.id.slice(0, 8)}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          className="rounded-full"
          disabled={rodando || contagem.pendente === 0}
          onClick={() => void rodar(false)}
        >
          {rodando
            ? `${t("Verificando…")} ${feitas}`
            : `${t("Verificar")} ${contagem.pendente} ${t("empresas")}`}
        </Button>
        {contagem.incerta > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={rodando}
            onClick={() => void rodar(true)}
          >
            {t("Tentar de novo as incertas")} ({contagem.incerta})
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {`${contagem.tem} ${t("com WhatsApp")} · ${contagem.naoTem} ${t("sem WhatsApp")} · ${contagem.incerta} ${t("incertas")} · ${contagem.pendente} ${t("a verificar")}. `}
        {t(
          "Quem não tem WhatsApp fica de fora da fila. A consulta não envia mensagem e vai devagar, de propósito.",
        )}
      </p>
      {erro ? (
        <p role="alert" className="rounded-xl bg-error-bg px-3 py-2 text-xs text-error-fg">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
