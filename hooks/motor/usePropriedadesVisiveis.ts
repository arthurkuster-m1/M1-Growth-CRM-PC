"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Quais colunas da tabela estão ligadas — a escolha de quem olha, guardada neste navegador.
 *
 * `padrao` e `fixas` são listas ESTÁVEIS (constantes do módulo da tela): se fossem
 * recriadas a cada render, o efeito que lê o armazenamento rodaria sem parar.
 *
 * Por navegador, e não por conta: é uma preferência de apresentação, no mesmo molde dos
 * grupos abertos do menu lateral. Quando a tabela ganhar visualizações salvas (filtros,
 * ordenações), as colunas passam a morar no banco junto com elas.
 */
export function usePropriedadesVisiveis(
  chave: string,
  padrao: readonly string[],
  fixas: readonly string[],
) {
  const [escolhidas, setEscolhidas] = useState<string[]>([...padrao]);
  const armazenamento = `motor:propriedades:${chave}`;

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(armazenamento);
      if (salvo)
        setEscolhidas((JSON.parse(salvo) as string[]).filter((id) => typeof id === "string"));
    } catch {
      // Armazenamento bloqueado (aba privada): vale o padrão.
    }
  }, [armazenamento]);

  const alternar = useCallback(
    (id: string) => {
      if (fixas.includes(id)) return;
      setEscolhidas((atual) => {
        const proxima = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id];
        try {
          window.localStorage.setItem(armazenamento, JSON.stringify(proxima));
        } catch {
          // A escolha vale nesta sessão; só não sobrevive a um F5.
        }
        return proxima;
      });
    },
    [armazenamento, fixas],
  );

  return { visiveis: [...fixas, ...escolhidas.filter((id) => !fixas.includes(id))], alternar };
}
