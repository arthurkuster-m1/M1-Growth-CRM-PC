"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { definirCorDaOrganizacao } from "@/app/actions/agencia/corDaOrganizacao";
import { TagDoCliente } from "@/components/agencia/TagDoCliente";
import { PALETA_DE_CLIENTES } from "@/lib/agencia/cor-do-cliente";
import { cn } from "@/lib/utils";

/**
 * A cor desta organização no Modo agência — só a agência a vê e a escolhe. `cor` é a que vale hoje (a
 * escolhida ou a automática); `escolhida` diz se foi escolhida.
 */
export function CorDaOrganizacao({
  orgId,
  nome,
  cor,
  escolhida,
}: {
  orgId: string;
  nome: string;
  cor: string;
  escolhida: boolean;
}) {
  const router = useRouter();
  const [atual, setAtual] = useState(cor);
  const [pendente, iniciar] = useTransition();
  function gravar(nova: string | null) {
    iniciar(async () => {
      const r = await definirCorDaOrganizacao(orgId, nova);
      if (!r.ok) {
        toast.error("Não foi possível salvar a cor.");
        return;
      }
      if (nova) setAtual(nova);
      router.refresh();
    });
  }
  return (
    <section className="grid gap-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Cor no Modo agência</h2>
          <p className="text-xs text-muted-foreground">
            A tag desta organização no Modo agência. Só a agência vê.
          </p>
        </div>
        <TagDoCliente nome={nome} cor={atual} grande />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PALETA_DE_CLIENTES.map((c) => (
          <button
            key={c}
            type="button"
            disabled={pendente}
            aria-label={`Cor ${c}`}
            onClick={() => gravar(c)}
            className={cn(
              "h-8 w-8 rounded-full border-2",
              atual === c ? "border-foreground/70" : "border-transparent",
            )}
            style={{ backgroundColor: c }}
          />
        ))}
        {escolhida ? (
          <button
            type="button"
            disabled={pendente}
            onClick={() => gravar(null)}
            className="ml-1 text-xs text-muted-foreground underline"
          >
            Voltar à automática
          </button>
        ) : null}
      </div>
    </section>
  );
}
