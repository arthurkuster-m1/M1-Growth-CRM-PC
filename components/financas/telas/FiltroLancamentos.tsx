"use client";

import { useState } from "react";
import { Button, DateField, Field, Input, Sheet, ValorInput } from "@/components/financas/kit";

/** Filtros personalizados da tabela do mês. Lista vazia / campo vazio = não filtra por aquilo. */
export type Filtros = {
  contas: string[];
  grupos: string[];
  categorias: string[];
  de: string;
  ate: string;
  min: number;
  max: number;
  nota: string;
};
export const SEM_FILTROS: Filtros = {
  contas: [],
  grupos: [],
  categorias: [],
  de: "",
  ate: "",
  min: 0,
  max: 0,
  nota: "",
};
export type Opcao = { id: string; nome: string };

export const contarFiltros = (f: Filtros) =>
  (f.contas.length ? 1 : 0) +
  (f.grupos.length ? 1 : 0) +
  (f.categorias.length ? 1 : 0) +
  (f.de || f.ate ? 1 : 0) +
  (f.min > 0 || f.max > 0 ? 1 : 0) +
  (f.nota.trim() ? 1 : 0);

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** `valor` em centavos, sempre positivo para comparar (estorno entra pelo módulo). */
export function passaNosFiltros(
  f: Filtros,
  i: {
    data: string;
    valor: number;
    nota: string | null;
    contaId: string | null;
    categoriaId: string | null;
    grupo: string | null;
  },
): boolean {
  if (f.contas.length && !(i.contaId && f.contas.includes(i.contaId))) return false;
  if (f.categorias.length && !f.categorias.includes(i.categoriaId ?? "_sem")) return false;
  if (f.grupos.length && !f.grupos.includes(i.grupo ?? "Sem grupo")) return false;
  if (f.de && i.data < f.de) return false;
  if (f.ate && i.data > f.ate) return false;
  const v = Math.abs(i.valor);
  if (f.min > 0 && v < f.min) return false;
  if (f.max > 0 && v > f.max) return false;
  const n = norm(f.nota).split(/\s+/).filter(Boolean);
  if (n.length) {
    const t = norm(i.nota ?? "");
    if (!n.every((x) => t.includes(x))) return false;
  }
  return true;
}

function Multi({
  rotulo,
  opcoes,
  marcados,
  onChange,
  testid,
}: {
  rotulo: string;
  opcoes: Opcao[];
  marcados: string[];
  onChange: (v: string[]) => void;
  testid: string;
}) {
  if (opcoes.length === 0) return null;
  return (
    <Field label={rotulo}>
      <div className="fi-row fi-row--wrap" role="group" aria-label={rotulo} data-testid={testid}>
        {opcoes.map((o) => {
          const on = marcados.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              className={`mes-chip${on ? "is-ativo" : ""}`}
              aria-pressed={on}
              onClick={() =>
                onChange(on ? marcados.filter((x) => x !== o.id) : [...marcados, o.id])
              }
            >
              {o.nome}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function FiltroLancamentos({
  aberto,
  onClose,
  filtros,
  onAplicar,
  contas,
  grupos,
  categorias,
}: {
  aberto: boolean;
  onClose: () => void;
  filtros: Filtros;
  onAplicar: (f: Filtros) => void;
  contas: Opcao[];
  grupos: Opcao[];
  categorias: Opcao[];
}) {
  return (
    <Sheet open={aberto} onClose={onClose} title="Filtrar lançamentos">
      {aberto && (
        <Formulario
          filtros={filtros}
          onAplicar={(f) => {
            onAplicar(f);
            onClose();
          }}
          contas={contas}
          grupos={grupos}
          categorias={categorias}
        />
      )}
    </Sheet>
  );
}

function Formulario({
  filtros,
  onAplicar,
  contas,
  grupos,
  categorias,
}: {
  filtros: Filtros;
  onAplicar: (f: Filtros) => void;
  contas: Opcao[];
  grupos: Opcao[];
  categorias: Opcao[];
}) {
  const [f, setF] = useState<Filtros>(filtros);
  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <>
      <p className="t-body-sm t-muted" style={{ marginTop: -8 }}>
        Combine o que quiser: só entra na tabela o que passar em todos os filtros. Deixe em branco o
        que não quiser usar.
      </p>
      <Multi
        rotulo="Conta"
        opcoes={contas}
        marcados={f.contas}
        onChange={(v) => set("contas", v)}
        testid="filtro-contas"
      />
      <Multi
        rotulo="Grupo da categoria"
        opcoes={grupos}
        marcados={f.grupos}
        onChange={(v) => set("grupos", v)}
        testid="filtro-grupos"
      />
      <Multi
        rotulo="Categoria"
        opcoes={categorias}
        marcados={f.categorias}
        onChange={(v) => set("categorias", v)}
        testid="filtro-categorias"
      />
      <div className="fi-grid fi-grid--duo">
        <Field label="Data a partir de">
          <DateField value={f.de} onChange={(e) => set("de", e.target.value)} />
        </Field>
        <Field label="Data até">
          <DateField value={f.ate} onChange={(e) => set("ate", e.target.value)} />
        </Field>
      </div>
      <div className="fi-grid fi-grid--duo">
        <Field label="Valor mínimo">
          <ValorInput value={f.min} onChange={(v) => set("min", v)} data-testid="filtro-min" />
        </Field>
        <Field label="Valor máximo">
          <ValorInput value={f.max} onChange={(v) => set("max", v)} data-testid="filtro-max" />
        </Field>
      </div>
      <Field label="Anotação contém">
        <Input
          value={f.nota}
          onChange={(e) => set("nota", e.target.value)}
          placeholder="Ex.: uber, luz…"
          data-testid="filtro-nota"
        />
      </Field>
      <Button size="lg" block onClick={() => onAplicar(f)} data-testid="aplicar-filtros">
        Aplicar filtros
      </Button>
      <Button
        variant="ghost"
        block
        onClick={() => onAplicar(SEM_FILTROS)}
        data-testid="limpar-filtros-sheet"
      >
        Limpar todos os filtros
      </Button>
    </>
  );
}
