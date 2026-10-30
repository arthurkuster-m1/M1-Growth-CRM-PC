"use client";

import { useEffect, useState } from "react";

import { EVENTO_RECARREGAR_CLIENTE } from "@/components/agencia/JanelaDaCampanha";
import { PARAMETRO_CLIENTE_DA_AGENCIA, PARAMETRO_EMBUTIDO } from "@/lib/agencia/cliente-da-aba";

/**
 * A página REAL de uma empresa (ex.: Campanhas, Tarefas) aberta "dentro" de um cliente, num quadro da
 * própria aplicação: mesma tela, mesmas visualizações, propriedades e edição que a pessoa tem ao
 * entrar naquela organização — só sem o menu em volta. A altura acompanha o conteúdo (o quadro avisa).
 */
export function EmbutidoDoCliente({
  caminho,
  clienteId,
  titulo,
}: {
  caminho: string;
  clienteId: string;
  titulo: string;
}) {
  const [altura, setAltura] = useState(240);
  // O quadro só aparece quando a altura real chega: sem pulo, sem "apagado" enquanto carrega.
  const [pronto, setPronto] = useState(false);
  // Muda a cada fechamento da janela de uma campanha deste cliente: o quadro recarrega e mostra o que foi editado.
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    const recarregar = (e: Event) => {
      if ((e as CustomEvent<string>).detail === clienteId) {
        setPronto(false);
        setVersao((v) => v + 1);
      }
    };
    window.addEventListener(EVENTO_RECARREGAR_CLIENTE, recarregar);
    return () => window.removeEventListener(EVENTO_RECARREGAR_CLIENTE, recarregar);
  }, [clienteId]);
  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { tipo?: string; cliente?: string; altura?: number } | null;
      if (d?.tipo === "agencia-altura" && d.cliente === clienteId && typeof d.altura === "number") {
        setAltura(Math.max(120, Math.ceil(d.altura)));
        setPronto(true);
      }
    };
    window.addEventListener("message", ouvir);
    // Se o aviso de altura nunca chegar, mostra o quadro assim mesmo.
    const limite = window.setTimeout(() => setPronto(true), 12000);
    return () => {
      window.removeEventListener("message", ouvir);
      window.clearTimeout(limite);
    };
  }, [clienteId]);
  const src = `${caminho}?${PARAMETRO_CLIENTE_DA_AGENCIA}=${encodeURIComponent(clienteId)}&${PARAMETRO_EMBUTIDO}=1`;
  return (
    <div className="relative">
      {pronto ? null : (
        <div className="h-60 animate-pulse rounded-2xl bg-secondary/60" aria-busy="true" />
      )}
      <iframe
        key={versao}
        title={titulo}
        src={src}
        style={
          pronto
            ? { height: altura }
            : // Carregando: renderiza fora do fluxo, com uma altura de partida, e escondido.
              {
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: 480,
                visibility: "hidden",
                pointerEvents: "none",
              }
        }
        scrolling="no"
        // Fluido: sem moldura, sem fundo e sem barra de rolagem própria — parece parte da mesma página.
        className="block w-full overflow-hidden border-0 bg-transparent"
      />
    </div>
  );
}
