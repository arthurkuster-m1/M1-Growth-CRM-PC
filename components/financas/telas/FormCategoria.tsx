"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash } from "@/lib/ui/icons";
import {
  Button,
  Field,
  Input,
  Segmented,
  Select,
  Sheet,
  Switch,
  ValorInput,
  useToast,
} from "@/components/financas/kit";
import {
  atualizarCategoria,
  criarCategoria,
  criarGrupo,
  excluirCategoria,
  usosDaCategoria,
  useFinancas,
  type Categoria,
  type GrupoCategoria,
} from "@/lib/financas/dados";

/** Cores que a pessoa pode escolher: as 10 da paleta de gráficos (muda com o tema claro/escuro). */
export const NOMES_DAS_CORES = [
  "Azul-marinho",
  "Verde-água",
  "Âmbar",
  "Roxo",
  "Terracota",
  "Verde",
  "Azul-aço",
  "Marrom",
  "Cinza-azulado",
  "Rosa",
];
export const corDaCategoria = (
  cor: number | null | undefined,
  padrao = "var(--color-text-subtle)",
) => (cor ? `var(--chart-${cor})` : padrao);
const porOrdem = <T extends { ordem: number; nome: string }>(a: T, b: T) =>
  a.ordem - b.ordem || a.nome.localeCompare(b.nome);

/**
 * Cria ou edita uma categoria: nome, tipo, grupo cadastrado (ou novo, na hora), cor e orçamento/meta.
 * Serve à tela de Configurações e ao "Criar categoria" de Lançar, Editar e importação em massa
 * (`nomeInicial`/`tipoInicial` já vêm preenchidos; `tipoFixo` impede trocar o tipo quando ele já foi decidido).
 */
export function FormCategoria({
  categoria,
  nomeInicial,
  tipoInicial,
  tipoFixo,
  grupoInicial,
  onClose,
  onSalvo,
}: {
  categoria: Categoria | null;
  nomeInicial?: string;
  tipoInicial?: "saida" | "entrada";
  tipoFixo?: boolean;
  /** abre já no grupo (o "+" dentro do grupo) */ grupoInicial?: string;
  onClose: () => void;
  onSalvo: (c: Categoria) => void;
}) {
  const toast = useToast();
  const { categorias, grupos, incluirCategoria, recarregar } = useFinancas();
  const [nome, setNome] = useState(categoria?.nome ?? nomeInicial ?? "");
  const [tipo, setTipo] = useState<"saida" | "entrada">(categoria?.tipo ?? tipoInicial ?? "saida");
  const [grupoId, setGrupoId] = useState(categoria?.group_id ?? grupoInicial ?? "");
  const [cor, setCor] = useState<number | null>(categoria?.cor ?? null);
  const [criados, setCriados] = useState<GrupoCategoria[]>([]);
  const [criandoGrupo, setCriandoGrupo] = useState(false);
  const [nomeGrupo, setNomeGrupo] = useState("");
  const [mensal, setMensal] = useState(categoria?.orcamento_mensal_cents ?? 0);
  const [ativa, setAtiva] = useState(categoria?.ativa ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [usos, setUsos] = useState<number | null>(null); // null = ainda conferindo
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  useEffect(() => {
    let vivo = true;
    if (categoria)
      usosDaCategoria(categoria.id).then(
        (n) => vivo && setUsos(n),
        () => vivo && setUsos(1),
      ); // na dúvida, não oferece excluir
    return () => {
      vivo = false;
    };
  }, [categoria]);

  async function excluir() {
    if (!categoria) return;
    setOcupado(true);
    setErro(null);
    try {
      await excluirCategoria(categoria.id);
      toast("Categoria excluída");
      recarregar();
      onClose();
    } catch (e) {
      const m = (e as Error).message;
      setErro(
        /foreign key|violates|23503/i.test(m)
          ? "Essa categoria já tem lançamentos: arquive em vez de excluir."
          : m,
      );
      setConfirmaExcluir(false);
    } finally {
      setOcupado(false);
    }
  }

  const opcoesGrupo = useMemo(() => {
    const base = grupos.filter((g) => !g.sistema);
    return [...base, ...criados.filter((c) => !base.some((g) => g.id === c.id))].sort(porOrdem);
  }, [grupos, criados]);

  async function criarGrupoAqui() {
    if (!nomeGrupo.trim()) return setErro("Dê um nome ao grupo.");
    setErro(null);
    try {
      const g = await criarGrupo(
        nomeGrupo,
        Math.max(0, ...grupos.map((x) => x.ordem), ...criados.map((x) => x.ordem)) + 10,
      );
      setCriados((c) => [...c, g]);
      setGrupoId(g.id);
      setNomeGrupo("");
      setCriandoGrupo(false);
      recarregar();
    } catch (e) {
      const m = (e as Error).message;
      setErro(/duplicate|unique/i.test(m) ? "Já existe um grupo com esse nome." : m);
    }
  }

  async function salvar() {
    if (!nome.trim()) return setErro("Dê um nome à categoria.");
    setOcupado(true);
    setErro(null);
    try {
      // a meta de ganho do mês só existe para entrada; o orçamento de gastos é o teto do mês, não é por categoria
      const dados = {
        nome: nome.trim(),
        group_id: grupoId || null,
        cor,
        ativa,
        ...(tipo === "entrada" ? { orcamento_mensal_cents: mensal } : {}),
      };
      const salva = categoria
        ? await atualizarCategoria(categoria.id, dados)
        : await criarCategoria({
            ...dados,
            tipo,
            ordem:
              Math.max(0, ...categorias.filter((c) => c.tipo === tipo).map((c) => c.ordem)) + 10,
          });
      if (!categoria) incluirCategoria({ ...salva, orcamento_anual_cents: 0 });
      toast(categoria ? "Categoria atualizada" : "Categoria criada");
      recarregar();
      onSalvo(salva);
      onClose();
    } catch (e) {
      const m = (e as Error).message;
      setErro(/duplicate|unique/i.test(m) ? "Já existe uma categoria com esse nome." : m);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="fi-form-cat">
      {!categoria && !tipoFixo && (
        <Segmented
          block
          value={tipo}
          onChange={setTipo}
          options={[
            { value: "saida", label: "Saída" },
            { value: "entrada", label: "Entrada" },
          ]}
        />
      )}
      <Field label="Nome">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Saúde" />
      </Field>

      {criandoGrupo ? (
        <div className="fi-form-cat__grupo">
          <Field label="Novo grupo">
            <Input
              aria-label="Nome do novo grupo"
              autoFocus
              value={nomeGrupo}
              onChange={(e) => setNomeGrupo(e.target.value)}
              placeholder="Nome do grupo"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void criarGrupoAqui();
                }
              }}
            />
          </Field>
          <div className="fi-row">
            <Button onClick={() => void criarGrupoAqui()}>Criar grupo</Button>
            <Button variant="ghost" onClick={() => setCriandoGrupo(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="fi-form-cat__grupo">
          <Field label="Grupo">
            <Select value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
              <option value="">Sem grupo</option>
              {opcoesGrupo.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Button variant="ghost" onClick={() => setCriandoGrupo(true)}>
            <Plus size={14} weight="bold" />
            Novo grupo
          </Button>
        </div>
      )}

      <div className="fi-field" role="radiogroup" aria-label="Cor da categoria">
        <span className="fi-label">Cor</span>
        <div className="fi-cores">
          <button
            type="button"
            role="radio"
            aria-checked={cor === null}
            aria-label="Cor automática"
            className={cor === null ? "fi-cor fi-cor--auto is-sel" : "fi-cor fi-cor--auto"}
            onClick={() => setCor(null)}
          >
            Auto
          </button>
          {NOMES_DAS_CORES.map((n, i) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={cor === i + 1}
              aria-label={`Cor ${n}`}
              title={n}
              className={cor === i + 1 ? "fi-cor is-sel" : "fi-cor"}
              style={{ background: `var(--chart-${i + 1})` }}
              onClick={() => setCor(i + 1)}
            />
          ))}
        </div>
      </div>

      {tipo === "entrada" && (
        <Field label="Meta de ganho do mês (opcional)">
          <ValorInput value={mensal} onChange={setMensal} />
        </Field>
      )}
      {tipo === "saida" && (
        <p className="t-caption t-muted" style={{ margin: 0 }}>
          O orçamento de gastos é o teto do mês (na Visão do mês), não é por categoria.
        </p>
      )}
      <div className="fi-row fi-row--between fi-form-cat__rodape">
        <span />
        {categoria && (
          <div className="fi-row">
            <span className="t-body-sm">Ativa</span>
            <Switch label="Categoria ativa" checked={ativa} onChange={setAtiva} />
          </div>
        )}
      </div>
      {erro && (
        <p className="fi-error-text" role="alert">
          {erro}
        </p>
      )}
      <Button size="lg" block loading={ocupado} onClick={() => void salvar()}>
        {categoria ? "Salvar" : "Criar categoria"}
      </Button>
      {categoria &&
        usos === 0 &&
        (confirmaExcluir ? (
          <Button variant="danger" block disabled={ocupado} onClick={() => void excluir()}>
            Confirmar: excluir "{categoria.nome}" para sempre
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            block
            disabled={ocupado}
            onClick={() => setConfirmaExcluir(true)}
          >
            <Trash size={16} aria-hidden />
            Excluir categoria (nunca foi usada)
          </Button>
        ))}
      {categoria && usos !== null && usos > 0 && (
        <p className="t-caption t-muted" style={{ margin: 0, textAlign: "center" }}>
          Já tem lançamentos, então não dá para excluir: use "Ativa" para arquivar.
        </p>
      )}
    </div>
  );
}

/** A janela do "Criar categoria": usada onde a pessoa digita uma categoria que ainda não existe. */
export function CriarCategoriaSheet({
  aberto,
  nome,
  tipo,
  onClose,
  onCriada,
}: {
  aberto: boolean;
  nome: string;
  tipo: "saida" | "entrada";
  onClose: () => void;
  onCriada: (c: Categoria) => void;
}) {
  return (
    <Sheet open={aberto} onClose={onClose} title="Nova categoria">
      {aberto && (
        <FormCategoria
          key={`${nome}|${tipo}`}
          categoria={null}
          nomeInicial={nome}
          tipoInicial={tipo}
          tipoFixo
          onClose={onClose}
          onSalvo={onCriada}
        />
      )}
    </Sheet>
  );
}
