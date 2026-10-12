"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { DialogoDaVenda, type DadosDaVenda } from "@/components/vendas/DialogoDaVenda";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { Venda } from "@/lib/vendas";

const CHAVE = ["vendas-pendentes"] as const;
const ADIADAS = "m1:vendas-adiadas";

function lerAdiadas(): string[] {
  try {
    return JSON.parse(window.sessionStorage.getItem(ADIADAS) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/**
 * O POP-UP DA VENDA, em QUALQUER tela: toda vez que um lead vira Ganho — pelo CRM, pelo quadro,
 * pela ficha, em lote ou por automação — o banco efetiva a venda marcada "a detalhar", e este
 * componente (montado na casca do app) a encontra e abre o pop-up para registrar produtos,
 * valor real, forma de pagamento e parcelas. Ele reaparece até a venda ser detalhada; "Detalhar
 * depois" só silencia até a próxima sessão do navegador.
 */
export function PopupDeVendaPendente() {
  const t = useT();
  const queryClient = useQueryClient();
  const [adiadas, setAdiadas] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : lerAdiadas(),
  );
  const consulta = useQuery({
    queryKey: CHAVE,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>("/api/v1/vendas?pendentes=1")).data
        .vendas,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: false, // quem não é da equipe do CRM (403) simplesmente não vê o pop-up
    staleTime: 10_000,
  });

  const venda = (consulta.data ?? []).find((v) => !adiadas.includes(v.id)) ?? null;
  if (!venda) return null;

  function adiar(id: string) {
    const novas = [...adiadas, id];
    setAdiadas(novas);
    try {
      window.sessionStorage.setItem(ADIADAS, JSON.stringify(novas));
    } catch {
      /* sem storage: vale só até recarregar */
    }
  }

  async function salvar(v: DadosDaVenda) {
    try {
      const { id, contact_id: _c, ...resto } = v;
      await apiClient.patch(`/api/v1/vendas/${id}`, resto);
      await queryClient.invalidateQueries({ queryKey: CHAVE });
      await queryClient.invalidateQueries({ queryKey: ["vendas"] });
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e) {
      showApiError(e);
    }
  }

  return (
    <DialogoDaVenda
      key={venda.id}
      venda={venda}
      contatoInicial={{ contact_id: venda.contact_id, nome: venda.cliente?.nome ?? "—" }}
      clientes={[]}
      titulo={`${t("Finalizar venda")} — ${venda.cliente?.nome ?? ""}`}
      aoFechar={() => adiar(venda.id)}
      aoSalvar={salvar}
    />
  );
}

/** Pede a releitura imediata (depois de mover um lead para Ganho, por exemplo). */
export const CHAVE_DE_VENDAS_PENDENTES = CHAVE;
