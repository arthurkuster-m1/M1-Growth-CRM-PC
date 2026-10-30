"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { definirAcessoDoCliente } from "@/app/actions/agencia/delegacao";
import { useT } from "@/hooks/i18n/useT";
import { PAPEIS_DELEGAVEIS, ROTULO_DO_PAPEL_DELEGADO, type Acesso } from "@/lib/agencia/delegacao";

export interface PessoaDaEquipe {
  id: string;
  nome: string;
  /** O papel ativo em cada cliente (`clienteId` → papel); ausente = sem acesso. */
  acessos: Record<string, string>;
}

const ERROS: Record<string, string> = {
  last_admin: "Não é possível tirar o último admin deste cliente.",
  forbidden: "Só o super-admin pode delegar.",
  mfa_required: "Confirme a verificação em duas etapas e tente de novo.",
  not_team_member: "Essa pessoa não é da equipe.",
};

function Celula({
  pessoa,
  cliente,
}: {
  pessoa: PessoaDaEquipe;
  cliente: { id: string; name: string };
}) {
  const t = useT();
  const router = useRouter();
  const inicial = pessoa.acessos[cliente.id] ?? "";
  const [valor, setValor] = useState(inicial);
  const [pendente, iniciar] = useTransition();
  return (
    <select
      value={valor}
      disabled={pendente}
      aria-label={`${pessoa.nome} — ${cliente.name}`}
      onChange={(e) => {
        const novo = e.target.value;
        const anterior = valor;
        setValor(novo);
        iniciar(async () => {
          const r = await definirAcessoDoCliente(pessoa.id, cliente.id, novo === "" ? null : novo);
          if (!r.ok) {
            setValor(anterior);
            toast.error(t(ERROS[r.error] ?? "Não foi possível salvar."));
            return;
          }
          router.refresh();
        });
      }}
      className="h-8 w-full min-w-24 rounded-lg border bg-card px-2 text-xs"
    >
      <option value="">{t("Sem acesso")}</option>
      {PAPEIS_DELEGAVEIS.map((p) => (
        <option key={p} value={p}>
          {t(ROTULO_DO_PAPEL_DELEGADO[p])}
        </option>
      ))}
      {valor && !(PAPEIS_DELEGAVEIS as readonly string[]).includes(valor) ? (
        <option value={valor} disabled>
          {valor}
        </option>
      ) : null}
    </select>
  );
}

export type { Acesso };

export function MatrizDaEquipe({
  equipe,
  clientes,
}: {
  equipe: PessoaDaEquipe[];
  clientes: { id: string; name: string }[];
}) {
  const t = useT();
  if (equipe.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        {t("Nenhuma outra pessoa na equipe. Convide alguém em Equipe e volte aqui.")}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="sticky left-0 bg-secondary/50 px-3 py-2 font-medium">{t("Pessoa")}</th>
            {clientes.map((c) => (
              <th key={c.id} className="px-3 py-2 font-medium whitespace-nowrap">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {equipe.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="sticky left-0 bg-card px-3 py-2 font-medium whitespace-nowrap">
                {p.nome}
              </td>
              {clientes.map((c) => (
                <td key={c.id} className="px-3 py-2">
                  <Celula pessoa={p} cliente={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
