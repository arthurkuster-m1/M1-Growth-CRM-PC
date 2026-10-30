"use client";

import { useEffect, useState } from "react";

import {
  PARAMETRO_CLIENTE_DA_AGENCIA,
  PARAMETRO_EMBUTIDO,
} from "@/lib/agencia/cliente-da-aba";

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
  const [altura, setAltura] = useState(480);
  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { tipo?: string; cliente?: string; altura?: number } | null;
      if (d?.tipo === "agencia-altura" && d.cliente === clienteId && typeof d.altura === "number") {
        setAltura(Math.max(240, Math.ceil(d.altura)));
      }
    };
    window.addEventListener("message", ouvir);
    return () => window.removeEventListener("message", ouvir);
  }, [clienteId]);
  const src = `${caminho}?${PARAMETRO_CLIENTE_DA_AGENCIA}=${encodeURIComponent(clienteId)}&${PARAMETRO_EMBUTIDO}=1`;
  return (
    <iframe
      title={titulo}
      src={src}
      loading="lazy"
      style={{ height: altura }}
      className="w-full rounded-2xl border bg-background"
    />
  );
}
