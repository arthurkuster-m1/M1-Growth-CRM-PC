"use client";

import { useEffect, useState } from "react";

import { toast } from "sonner";

import {
  ColecaoDaCampanha,
  type CampoDaColecao,
} from "@/components/marketing/campanhas/ColecaoDaCampanha";
import {
  COR_DO_STATUS_DO_CRIATIVO,
  rotuloDoMeio,
  rotuloDoStatusDoCriativo,
} from "@/components/marketing/campanhas/rotulos";
import { CelulaDeTexto } from "@/components/motor/CelulaDeTexto";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { SeletorDeOpcao } from "@/components/motor/SeletorDeOpcao";
import type { ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { useT } from "@/hooks/i18n/useT";
import { useAbordagensDaCampanha } from "@/hooks/marketing/useCampanhasDeDemanda";
import {
  MEIOS_DA_ABORDAGEM,
  STATUS_DA_ABORDAGEM,
  type Abordagem,
} from "@/lib/marketing/abordagens";
import { Plus, TextAa, Trash } from "@/lib/ui/icons";

const CAMPO =
  "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const AREA =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

function Texto({
  valor,
  aoGravar,
  desabilitado,
  rotulo,
  longo,
  max,
}: {
  valor: string;
  aoGravar: (v: string) => void;
  desabilitado: boolean;
  rotulo: string;
  longo?: boolean;
  max: number;
}) {
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  const comum = {
    value: v,
    maxLength: max,
    disabled: desabilitado,
    placeholder: rotulo,
    "aria-label": rotulo,
    onChange: (e: { target: { value: string } }) => setV(e.target.value),
    onBlur: () => v !== valor && aoGravar(v),
  };
  return longo ? (
    <textarea rows={5} className={AREA} {...comum} />
  ) : (
    <input className={CAMPO} {...comum} />
  );
}

function Cartao({
  a,
  podeEditar,
  editar,
  apagar,
}: {
  a: Abordagem;
  podeEditar: boolean;
  editar: (p: Partial<Abordagem>) => void;
  apagar: () => void;
}) {
  const t = useT();
  const bloqueado = !podeEditar;
  return (
    <article className="grid grid-cols-1 content-start gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Etiqueta cor={COR_DO_STATUS_DO_CRIATIVO[a.status]}>
          {rotuloDoStatusDoCriativo(t, a.status)}
        </Etiqueta>
        <Etiqueta cor="blue">{rotuloDoMeio(t, a.medium)}</Etiqueta>
      </div>
      <Texto
        valor={a.name}
        aoGravar={(name) => name.trim() && editar({ name })}
        desabilitado={bloqueado}
        rotulo={t("Nome da abordagem")}
        max={160}
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select
          className={CAMPO}
          disabled={bloqueado}
          value={a.medium}
          aria-label={t("Meio de contato")}
          onChange={(e) => editar({ medium: e.target.value as Abordagem["medium"] })}
        >
          {MEIOS_DA_ABORDAGEM.map((m) => (
            <option key={m} value={m}>
              {rotuloDoMeio(t, m)}
            </option>
          ))}
        </select>
        <select
          className={CAMPO}
          disabled={bloqueado}
          value={a.status}
          aria-label={t("Status")}
          onChange={(e) => editar({ status: e.target.value as Abordagem["status"] })}
        >
          {STATUS_DA_ABORDAGEM.map((s) => (
            <option key={s} value={s}>
              {rotuloDoStatusDoCriativo(t, s)}
            </option>
          ))}
        </select>
      </div>
      <Texto
        valor={a.audience}
        aoGravar={(audience) => editar({ audience })}
        desabilitado={bloqueado}
        rotulo={t("Para quem")}
        max={500}
      />
      <Texto
        valor={a.hook}
        aoGravar={(hook) => editar({ hook })}
        desabilitado={bloqueado}
        rotulo={t("Gancho (a primeira frase)")}
        max={500}
      />
      <Texto
        valor={a.script}
        aoGravar={(script) => editar({ script })}
        desabilitado={bloqueado}
        rotulo={t("Mensagem ou roteiro")}
        longo
        max={6000}
      />
      <Texto
        valor={a.follow_up}
        aoGravar={(follow_up) => editar({ follow_up })}
        desabilitado={bloqueado}
        rotulo={t("Follow-up")}
        longo
        max={6000}
      />
      <Texto
        valor={a.notes}
        aoGravar={(notes) => editar({ notes })}
        desabilitado={bloqueado}
        rotulo={t("Observações")}
        max={2000}
      />
      {podeEditar ? (
        <div className="flex justify-end">
          <button
            type="button"
            aria-label={t("Apagar abordagem")}
            onClick={() => {
              if (window.confirm(t("Apagar esta abordagem?"))) apagar();
            }}
            className="grid h-9 w-9 grid-cols-1 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
          >
            <Trash size={16} aria-hidden />
          </button>
        </div>
      ) : null}
    </article>
  );
}

interface LinhaDaAbordagem {
  id: string;
  position: number;
  a: Abordagem;
}

/** As ABORDAGENS da campanha de contato direto: o equivalente aos criativos de anúncio. */
export function AbordagensDaCampanha({
  campanhaId,
  podeEditar,
}: {
  campanhaId: string;
  podeEditar: boolean;
}) {
  const t = useT();
  const { abordagens, carregando, criar, editar, apagar } = useAbordagensDaCampanha(campanhaId);
  const [novaId, setNovaId] = useState<string | null>(null);
  const linhas: LinhaDaAbordagem[] = abordagens.map((a) => ({
    id: a.id,
    position: a.position,
    a,
  }));
  const opcoesDeStatus = STATUS_DA_ABORDAGEM.map((s) => ({
    id: s,
    rotulo: rotuloDoStatusDoCriativo(t, s),
    cor: COR_DO_STATUS_DO_CRIATIVO[s],
  }));
  const opcoesDeMeio = MEIOS_DA_ABORDAGEM.map((m) => ({
    id: m,
    rotulo: rotuloDoMeio(t, m),
    cor: "blue" as const,
  }));

  const campos: CampoDaColecao<LinhaDaAbordagem>[] = [
    { id: "nome", titulo: t("Abordagem"), tipo: "texto", valorDe: (l) => l.a.name },
    {
      id: "status",
      titulo: t("Status"),
      tipo: "opcao",
      valorDe: (l) => l.a.status,
      opcoes: opcoesDeStatus,
      ordemDoValor: (v) => STATUS_DA_ABORDAGEM.indexOf(v as (typeof STATUS_DA_ABORDAGEM)[number]),
    },
    {
      id: "meio",
      titulo: t("Meio de contato"),
      tipo: "opcao",
      valorDe: (l) => l.a.medium,
      opcoes: opcoesDeMeio,
    },
    { id: "publico", titulo: t("Para quem"), tipo: "texto", valorDe: (l) => l.a.audience },
    { id: "gancho", titulo: t("Gancho"), tipo: "texto", valorDe: (l) => l.a.hook },
  ];
  const texto = (v: string) => (
    <span className="block truncate px-2 text-sm" title={v}>
      {v || "—"}
    </span>
  );
  const colunas: ColunaDoMotor<LinhaDaAbordagem>[] = [
    {
      id: "nome",
      titulo: t("Abordagem"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 260,
      semOcultar: true,
      celula: (l) => (
        <CelulaDeTexto
          valor={l.a.name}
          rotulo={t("Nome da abordagem")}
          podeEditar={podeEditar}
          aoSalvar={(name) => void editar(l.a.id, { name })}
        />
      ),
    },
    {
      id: "status",
      titulo: t("Status"),
      largura: 150,
      celula: (l) => (
        <SeletorDeOpcao
          opcoes={opcoesDeStatus}
          valorId={l.a.status}
          podeEditar={podeEditar}
          rotulo={t("Status")}
          aoEscolher={(id) => void editar(l.a.id, { status: id as Abordagem["status"] })}
        >
          <Etiqueta ponto cor={COR_DO_STATUS_DO_CRIATIVO[l.a.status]}>
            {rotuloDoStatusDoCriativo(t, l.a.status)}
          </Etiqueta>
        </SeletorDeOpcao>
      ),
    },
    {
      id: "meio",
      titulo: t("Meio de contato"),
      largura: 170,
      celula: (l) => (
        <SeletorDeOpcao
          opcoes={opcoesDeMeio}
          valorId={l.a.medium}
          podeEditar={podeEditar}
          rotulo={t("Meio de contato")}
          aoEscolher={(id) => void editar(l.a.id, { medium: id as Abordagem["medium"] })}
        >
          <Etiqueta cor="blue">{rotuloDoMeio(t, l.a.medium)}</Etiqueta>
        </SeletorDeOpcao>
      ),
    },
    { id: "publico", titulo: t("Para quem"), largura: 220, celula: (l) => texto(l.a.audience) },
    { id: "gancho", titulo: t("Gancho"), largura: 280, celula: (l) => texto(l.a.hook) },
    {
      id: "followup",
      titulo: t("Follow-up"),
      largura: 280,
      padrao: false,
      celula: (l) => texto(l.a.follow_up),
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("Abordagens")}</h2>
        {podeEditar ? (
          <button
            type="button"
            onClick={async () => {
              const nova = await criar({ name: t("Nova abordagem") });
              if (nova) {
                setNovaId(nova.id);
                toast.success(t("Abordagem criada. Preencha os dados dela."));
              }
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium whitespace-nowrap text-primary-foreground"
          >
            <Plus size={14} weight="bold" aria-hidden />
            {t("Nova abordagem")}
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          "O que a equipe fala e como: meio, gancho, mensagem e follow-up. Os números de cada dia vão na página Dia a dia.",
        )}
      </p>
      <ColecaoDaCampanha
        tela="campanha-abordagens"
        itens={linhas}
        carregando={carregando}
        podeEditar={podeEditar}
        vazio={t("Nenhuma abordagem ainda. Crie a primeira.")}
        rotuloDaTabela={t("Abordagens")}
        campos={campos}
        colunas={colunas}
        textoDaBusca={(l) => `${l.a.name} ${l.a.audience} ${l.a.hook} ${l.a.script}`}
        aoMudarPosicao={(id, position) => void editar(id, { position })}
        destacarId={novaId}
        cartao={(l) => (
          <Cartao
            a={l.a}
            podeEditar={podeEditar}
            editar={(p) => void editar(l.a.id, p)}
            apagar={() => void apagar(l.a.id)}
          />
        )}
      />
    </section>
  );
}
