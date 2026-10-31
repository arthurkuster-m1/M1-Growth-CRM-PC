"use client";

import { useEffect, useRef, useState } from "react";

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
  // Um pop-up aberto dentro do quadro: o quadro ocupa a janela inteira até ele fechar.
  const [modal, setModal] = useState(false);
  // As alturas que chegam com o pop-up aberto são da janela inteira: não valem para o quadro.
  const modalRef = useRef(false);
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
      const d = e.data as {
        tipo?: string;
        cliente?: string;
        altura?: number;
        aberto?: boolean;
      } | null;
      if (d?.tipo === "agencia-modal" && d.cliente === clienteId) {
        modalRef.current = d.aberto === true;
        setModal(d.aberto === true);
        return;
      }
      if (
        !modalRef.current &&
        d?.tipo === "agencia-altura" &&
        d.cliente === clienteId &&
        typeof d.altura === "number"
      ) {
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
    // Com o pop-up aberto o quadro sai do fluxo (fixo, na janela toda); este espaço guarda o lugar.
    <div className="relative" style={modal && pronto ? { height: altura } : undefined}>
      {pronto ? null : (
        <div className="h-60 animate-pulse rounded-2xl bg-secondary/60" aria-busy="true" />
      )}
      <iframe
        key={versao}
        title={titulo}
        src={src}
        style={
          pronto
            ? modal
              ? { position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 60 }
              : { height: altura }
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
