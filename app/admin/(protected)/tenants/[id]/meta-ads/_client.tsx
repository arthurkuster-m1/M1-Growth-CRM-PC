"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { liberarContasDeAnuncio } from "@/app/actions/admin/liberarContasDeAnuncio";
import { Button } from "@/components/ui/button";

interface Conta {
  id: string;
  nome: string;
  moeda: string;
  status: number;
}

const ERROS: Record<string, string> = {
  validation_failed: "Confira os dados e tente de novo.",
  unauthenticated: "Sua sessão expirou. Entre de novo.",
  forbidden_role: "Só o administrador da plataforma pode liberar contas.",
  mfa_required: "Confirme o segundo fator para salvar.",
  erro_ao_gravar: "Não consegui gravar agora. Tente de novo em instantes.",
};

export function LiberarContas({
  organizationId,
  restringirInicial,
  liberadasIniciais,
  contas,
  aviso,
}: {
  organizationId: string;
  restringirInicial: boolean;
  liberadasIniciais: string[];
  contas: Conta[];
  aviso: string | null;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [restringir, setRestringir] = useState(restringirInicial);
  const norm = (x: string) => x.replace(/^act_/, "");
  const [liberadas, setLiberadas] = useState<string[]>(
    liberadasIniciais.map((x) => `act_${norm(x)}`),
  );
  const [resultado, setResultado] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const visiveis = contas.filter(
    (c) => termo === "" || c.nome.toLowerCase().includes(termo) || c.id.includes(termo),
  );
  const alternar = (id: string) =>
    setLiberadas((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  function salvar() {
    setResultado(null);
    iniciar(async () => {
      const r = await liberarContasDeAnuncio({
        organization_id: organizationId,
        restringir,
        contas: liberadas,
      });
      if (r.ok) {
        setResultado("Salvo.");
        router.refresh();
      } else {
        setResultado(ERROS[r.error] ?? "Não foi possível salvar.");
      }
    });
  }

  return (
    <section className="grid max-w-3xl gap-4 py-4">
      <div>
        <h2 className="text-base font-semibold">Contas de anúncio do Meta</h2>
        <p className="text-sm text-muted-foreground">
          O token desta organização pode enxergar contas de outros clientes. Marque só as contas que
          ESTA organização pode listar, escolher e ler. Com a trava ligada e nenhuma conta marcada,
          a organização não enxerga conta nenhuma.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
        <input
          type="checkbox"
          checked={restringir}
          onChange={(e) => setRestringir(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          <strong>Restringir às contas marcadas (recomendado)</strong>
          <span className="block text-muted-foreground">
            Desligue só se o token for da própria empresa cliente, e portanto só alcança as contas
            dela.
          </span>
        </span>
      </label>

      {aviso ? (
        <p role="alert" className="rounded-xl bg-warning-bg px-3 py-2 text-sm text-warning-fg">
          {aviso}
        </p>
      ) : null}

      {contas.length > 0 ? (
        <>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar conta por nome ou número"
            className="h-10 rounded-xl border bg-card px-3 text-sm"
          />
          <ul className="grid max-h-96 gap-1 overflow-y-auto rounded-xl border p-2">
            {visiveis.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-secondary">
                  <input
                    type="checkbox"
                    checked={liberadas.includes(c.id)}
                    onChange={() => alternar(c.id)}
                    className="h-4 w-4"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{c.nome}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {c.id} · {c.moeda}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {liberadas.length} conta(s) liberada(s) de {contas.length} que o token alcança.
          </p>
        </>
      ) : null}

      <div className="flex items-center gap-3">
        <Button onClick={salvar} disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar"}
        </Button>
        {resultado ? <span className="text-sm text-muted-foreground">{resultado}</span> : null}
      </div>
    </section>
  );
}
