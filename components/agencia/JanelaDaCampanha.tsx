"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { PARAMETRO_CLIENTE_DA_AGENCIA, PARAMETRO_EMBUTIDO } from "@/lib/agencia/cliente-da-aba";
import { ehCaminhoDeCampanha, TIPO_ABRIR_NA_AGENCIA, TIPO_FECHAR_JANELA } from "@/lib/agencia/embutido";

export const EVENTO_RECARREGAR_CLIENTE = "agencia-recarregar-cliente";

interface Aberta {
  clienteId: string;
  caminho: string;
}

/**
 * A JANELA DA CAMPANHA do Modo agência: o "Abrir" de uma campanha, em qualquer tabela de cliente,
 * abre aqui um pop-up com a página da campanha DAQUELE cliente — então tudo o que se edita nele grava
 * na campanha certa. Voltar (o botão do navegador, o Esc ou o X) fecha o pop-up e deixa a pessoa
 * exatamente onde estava na página da agência; ao fechar, a tabela do cliente recarrega.
 */
export function JanelaDaCampanha({ nomes }: { nomes: Record<string, string> }) {
  const t = useT();
  const [aberta, setAberta] = useState<Aberta | null>(null);
  const empilhou = useRef(false);

  const fechar = useCallback((clienteId: string | null) => {
    setAberta(null);
    if (clienteId) window.dispatchEvent(new CustomEvent(EVENTO_RECARREGAR_CLIENTE, { detail: clienteId }));
  }, []);

  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { tipo?: string; cliente?: string; caminho?: string } | null;
      if (!d?.cliente || !(d.cliente in nomes)) return;
      if (d.tipo === TIPO_ABRIR_NA_AGENCIA && d.caminho && ehCaminhoDeCampanha(d.caminho)) {
        // Uma entrada no histórico: o "voltar" do navegador fecha a janela em vez de sair da página.
        window.history.pushState({ agenciaJanela: true }, "");
        empilhou.current = true;
        setAberta({ clienteId: d.cliente, caminho: d.caminho });
      } else if (d.tipo === TIPO_FECHAR_JANELA) {
        pedirParaFechar();
      }
    };
    const aoVoltar = () => {
      if (empilhou.current) {
        empilhou.current = false;
        setAberta((atual) => {
          if (atual) window.dispatchEvent(new CustomEvent(EVENTO_RECARREGAR_CLIENTE, { detail: atual.clienteId }));
          return null;
        });
      }
    };
    function pedirParaFechar() {
      if (empilhou.current) window.history.back(); // dispara o popstate, que fecha
      else fechar(null);
    }
    window.addEventListener("message", ouvir);
    window.addEventListener("popstate", aoVoltar);
    return () => {
      window.removeEventListener("message", ouvir);
      window.removeEventListener("popstate", aoVoltar);
    };
  }, [nomes, fechar]);

  const src = aberta
    ? `${aberta.caminho}?${PARAMETRO_CLIENTE_DA_AGENCIA}=${encodeURIComponent(aberta.clienteId)}&${PARAMETRO_EMBUTIDO}=1&_janela=1`
    : "";
  return (
    <Dialog
      open={aberta !== null}
      onOpenChange={(aberto) => {
        if (!aberto) {
          if (empilhou.current) window.history.back();
          else fechar(aberta?.clienteId ?? null);
        }
      }}
    >
      <DialogContent className="h-[92dvh] w-[min(1280px,96vw)] max-w-none gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">
          {t("Campanha")} {aberta ? `· ${nomes[aberta.clienteId] ?? ""}` : ""}
        </DialogTitle>
        {aberta ? (
          <div className="flex h-full flex-col">
            <p className="border-b px-5 py-3 text-sm font-medium text-muted-foreground">
              {t("Campanha")} · {nomes[aberta.clienteId]}
            </p>
            <iframe title={t("Campanha")} src={src} className="min-h-0 w-full flex-1 border-0" />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
