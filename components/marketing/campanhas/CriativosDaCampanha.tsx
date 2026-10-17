"use client";

import { SelectDoApp } from "@/components/ui/SelectDoApp";
import { useEffect, useRef, useState } from "react";

import {
  COR_DO_STATUS_DO_CRIATIVO,
  rotuloDoFormato,
  rotuloDoStatusDoCriativo,
} from "@/components/marketing/campanhas/rotulos";
import { toast } from "sonner";

import {
  FiltroDePeriodoDaCampanha,
  usePeriodoDaCampanha,
} from "@/components/marketing/campanhas/FiltroDePeriodoDaCampanha";
import {
  ColecaoDaCampanha,
  type CampoDaColecao,
} from "@/components/marketing/campanhas/ColecaoDaCampanha";
import { ConjuntosDeAnuncios } from "@/components/marketing/campanhas/ConjuntosDeAnuncios";
import { AcoesDaColecao } from "@/components/marketing/campanhas/AcoesDaColecao";
import { LinkComVer } from "@/components/marketing/campanhas/LinkComVer";
import { CelulaDeTexto } from "@/components/motor/CelulaDeTexto";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { SeletorDeOpcao } from "@/components/motor/SeletorDeOpcao";
import type { ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { useT } from "@/hooks/i18n/useT";
import {
  useCriativosDaCampanha,
  useMetaPorAnuncio,
  useOrigemDosLeads,
  type EdicaoDeCriativo,
} from "@/hooks/marketing/useCampanhasDeDemanda";
import {
  FORMATOS_DO_CRIATIVO,
  STATUS_DO_CRIATIVO,
  taxasDoCriativo,
  type Criativo,
} from "@/lib/marketing/criativos";
import { BASE_DAS_IMAGENS_DO_PAINEL, TAMANHO_MAXIMO_DA_IMAGEM } from "@/lib/marketing/imagens";
import { MAXIMO_DE_IMAGENS, MAXIMO_DE_VARIACOES } from "@/lib/marketing/criativos";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import { Check, Plus, TextAa, Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const CAMPO =
  "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const AREA =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

const FAIXA_DO_STATUS: Record<Criativo["status"], string> = {
  ativo: "border-l-emerald-500",
  pausado: "border-l-amber-500",
  encerrado: "border-l-slate-400",
};

const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pct = (n: number | null) =>
  n === null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const reais = (n: number | null) => (n === null ? "—" : moedaDoNumero(n));

/** Texto que grava ao sair do campo, só se mudou. */
function Texto({
  valor,
  aoGravar,
  desabilitado,
  rotulo,
  longo,
  max,
  placeholder,
}: {
  valor: string;
  aoGravar: (v: string) => void;
  desabilitado: boolean;
  rotulo: string;
  longo?: boolean;
  max: number;
  placeholder?: string;
}) {
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  const comum = {
    value: v,
    maxLength: max,
    disabled: desabilitado,
    placeholder,
    "aria-label": rotulo,
    onChange: (e: { target: { value: string } }) => setV(e.target.value),
    onBlur: () => v !== valor && aoGravar(v),
  };
  return longo ? (
    <textarea rows={4} className={AREA} {...comum} />
  ) : (
    <input className={CAMPO} {...comum} />
  );
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{rotulo}</p>
      <p className="text-sm font-semibold tabular-nums">{valor}</p>
    </div>
  );
}

/** Até 5 variações de um texto (como no anúncio dinâmico do Meta); grava a lista inteira ao sair. */
function Variacoes({
  titulo,
  valores,
  rotuloDoItem,
  longo,
  max,
  desabilitado,
  aoGravar,
}: {
  titulo: string;
  valores: string[];
  rotuloDoItem: string;
  longo?: boolean;
  max: number;
  desabilitado: boolean;
  aoGravar: (lista: string[]) => void;
}) {
  const [lista, setLista] = useState<string[]>(() =>
    Array.from({ length: MAXIMO_DE_VARIACOES }, (_, i) => valores[i] ?? ""),
  );
  const chave = valores.join("\u0000");
  useEffect(() => {
    setLista(Array.from({ length: MAXIMO_DE_VARIACOES }, (_, i) => valores[i] ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `chave` resume `valores`
  }, [chave]);
  const preenchidos = lista.filter((x) => x.trim() !== "").length;
  const gravar = () => {
    const limpa = lista.map((x) => x.trim());
    while (limpa.length > 0 && limpa[limpa.length - 1] === "") limpa.pop();
    if (limpa.join("\u0000") !== chave) aoGravar(limpa);
  };
  // Sempre começa FECHADO ao abrir a página: são textos longos e ocupam a tela.
  return (
    <details className="rounded-xl border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        {titulo}{" "}
        <span className="text-xs font-normal text-muted-foreground">
          ({preenchidos}/{MAXIMO_DE_VARIACOES})
        </span>
      </summary>
      <div className="mt-2 grid gap-2">
        {lista.map((v, i) => {
          const rotulo = `${rotuloDoItem} ${i + 1}`;
          const comum = {
            value: v,
            maxLength: max,
            disabled: desabilitado,
            placeholder: rotulo,
            "aria-label": rotulo,
            onChange: (e: { target: { value: string } }) =>
              setLista((l) => l.map((x, k) => (k === i ? e.target.value : x))),
            onBlur: gravar,
          };
          return longo ? (
            <textarea key={i} rows={3} className={AREA} {...comum} />
          ) : (
            <input key={i} className={CAMPO} {...comum} />
          );
        })}
      </div>
    </details>
  );
}

/** As imagens do criativo: várias de uma vez, com prévia e remoção. */
function ImagensDoCriativo({
  imagens,
  desabilitado,
  aoMudar,
}: {
  imagens: string[];
  desabilitado: boolean;
  aoMudar: (lista: string[]) => void;
}) {
  const t = useT();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(arquivos: File[]) {
    setErro(null);
    setEnviando(true);
    const novos: string[] = [];
    try {
      for (const f of arquivos.slice(0, MAXIMO_DE_IMAGENS - imagens.length)) {
        if (f.size > TAMANHO_MAXIMO_DA_IMAGEM) {
          setErro(t("A imagem precisa ter até 5 MB."));
          continue;
        }
        const form = new FormData();
        form.set("file", f);
        const r = await fetch("/api/v1/marketing/imagens", { method: "POST", body: form });
        const corpo = (await r.json().catch(() => null)) as {
          data?: { arquivo?: string };
          error?: { message?: string };
        } | null;
        if (r.ok && corpo?.data?.arquivo) novos.push(corpo.data.arquivo);
        else setErro(corpo?.error?.message ?? t("Erro ao enviar a imagem."));
      }
      if (novos.length > 0) aoMudar([...imagens, ...novos]);
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      {imagens.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {imagens.map((arq, i) => (
            <li key={arq} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem da agência, servida pela rota do painel */}
              <img
                src={`${BASE_DAS_IMAGENS_DO_PAINEL}${arq}`}
                alt={`${t("Imagem")} ${i + 1}`}
                className="h-20 w-20 rounded-xl border object-cover"
              />
              {!desabilitado ? (
                <button
                  type="button"
                  aria-label={t("Tirar imagem")}
                  onClick={() => aoMudar(imagens.filter((_, k) => k !== i))}
                  className="absolute -top-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full border bg-card text-muted-foreground shadow-sm hover:text-error-fg"
                >
                  <Trash size={12} aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!desabilitado ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={entrada}
            type="file"
            multiple
            accept="image/png,image/jpeg"
            className="sr-only"
            aria-label={t("Escolher imagens")}
            onChange={(e) => {
              const f = Array.from(e.target.files ?? []);
              if (f.length > 0) void enviar(f);
            }}
          />
          <button
            type="button"
            disabled={enviando || imagens.length >= MAXIMO_DE_IMAGENS}
            onClick={() => entrada.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            <Plus size={14} weight="bold" aria-hidden />
            {enviando ? t("Enviando…") : t("Subir imagens")}
          </button>
          <span className="text-xs text-muted-foreground">
            {imagens.length}/{MAXIMO_DE_IMAGENS} · {t("PNG ou JPG, até 5 MB cada")}
          </span>
        </div>
      ) : null}
      {erro ? (
        <p role="alert" className="text-xs text-error-fg">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

function CartaoDoCriativo({
  c,
  leads,
  podeEditar,
  editar,
  duplicar,
  apagar,
  propriedades,
}: {
  c: Criativo;
  /** As propriedades escolhidas na visualização (no lugar das métricas de fábrica). */
  propriedades?: React.ReactNode;
  /** Leads do CRM que vieram deste criativo. */
  leads: number;
  podeEditar: boolean;
  editar: (patch: EdicaoDeCriativo) => void;
  duplicar: () => void;
  apagar: () => void;
}) {
  const t = useT();
  const [imagemFalhou, setImagemFalhou] = useState(false);
  const taxas = taxasDoCriativo(c);
  const imagem =
    c.thumbnail_url || (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(c.media_url) ? c.media_url : "");
  const bloqueado = !podeEditar;
  return (
    <article
      className={cn(
        "grid grid-cols-1 content-start gap-3 rounded-2xl border border-l-4 bg-card p-4 shadow-sm",
        FAIXA_DO_STATUS[c.status],
      )}
    >
      <div className="flex gap-3">
        <div className="grid h-24 w-24 shrink-0 grid-cols-1 place-items-center overflow-hidden rounded-xl bg-secondary text-xs text-muted-foreground">
          {imagem && !imagemFalhou ? (
            // eslint-disable-next-line @next/next/no-img-element -- miniatura externa (Meta), sem otimização do Next
            <img
              src={imagem}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImagemFalhou(true)}
            />
          ) : (
            rotuloDoFormato(t, c.format)
          )}
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 content-start gap-2">
          <Texto
            valor={c.name}
            aoGravar={(name) => name.trim() && editar({ name })}
            desabilitado={bloqueado}
            rotulo={t("Nome do criativo")}
            max={160}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Etiqueta cor={COR_DO_STATUS_DO_CRIATIVO[c.status]}>
              {rotuloDoStatusDoCriativo(t, c.status)}
            </Etiqueta>
            {c.ad_id ? <Etiqueta cor="blue">{t("Meta")}</Etiqueta> : null}
            {c.ad_id ? (
              <span
                title={t("ID do anúncio no Meta")}
                className="text-[11px] text-muted-foreground tabular-nums select-all"
              >
                {c.ad_id}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <SelectDoApp
          className={CAMPO}
          disabled={bloqueado}
          value={c.status}
          aria-label={t("Status")}
          onChange={(e) => editar({ status: e.target.value as Criativo["status"] })}
        >
          {STATUS_DO_CRIATIVO.map((s) => (
            <option key={s} value={s}>
              {rotuloDoStatusDoCriativo(t, s)}
            </option>
          ))}
        </SelectDoApp>
        <SelectDoApp
          className={CAMPO}
          disabled={bloqueado}
          value={c.format}
          aria-label={t("Formato")}
          onChange={(e) => editar({ format: e.target.value as Criativo["format"] })}
        >
          {FORMATOS_DO_CRIATIVO.map((f) => (
            <option key={f} value={f}>
              {rotuloDoFormato(t, f)}
            </option>
          ))}
        </SelectDoApp>
      </div>

      <ImagensDoCriativo
        imagens={c.images}
        desabilitado={bloqueado}
        aoMudar={(images) => editar({ images })}
      />
      <Variacoes
        titulo={t("Textos principais (legendas)")}
        valores={c.bodies}
        rotuloDoItem={t("Texto principal")}
        longo
        max={4000}
        desabilitado={bloqueado}
        aoGravar={(bodies) => editar({ bodies })}
      />
      <Variacoes
        titulo={t("Títulos")}
        valores={c.headlines}
        rotuloDoItem={t("Título")}
        max={300}
        desabilitado={bloqueado}
        aoGravar={(headlines) => editar({ headlines })}
      />
      <Variacoes
        titulo={t("Descrições")}
        valores={c.descriptions}
        rotuloDoItem={t("Descrição")}
        max={1000}
        desabilitado={bloqueado}
        aoGravar={(descriptions) => editar({ descriptions })}
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Texto
          valor={c.media_url}
          aoGravar={(media_url) => editar({ media_url })}
          desabilitado={bloqueado}
          rotulo={t("Link da imagem ou do vídeo")}
          placeholder={t("Link da imagem ou do vídeo")}
          max={1000}
        />
        <Texto
          valor={c.link_url}
          aoGravar={(link_url) => editar({ link_url })}
          desabilitado={bloqueado}
          rotulo={t("Página de destino (LP)")}
          placeholder={t("Página de destino (LP)")}
          max={1000}
        />
      </div>

      {propriedades ?? (
      <div className="grid grid-cols-3 gap-x-3 gap-y-2 rounded-xl bg-secondary/40 p-3">
        <Metrica rotulo={t("Investido")} valor={moedaDoNumero(c.spend)} />
        <Metrica rotulo={t("Impressões")} valor={inteiro(c.impressions)} />
        <Metrica rotulo={t("Cliques no link")} valor={inteiro(c.link_clicks)} />
        <Metrica rotulo={t("CTR")} valor={pct(taxas.ctr)} />
        <Metrica rotulo={t("CPC")} valor={reais(taxas.cpc)} />
        <Metrica rotulo={t("Visitas à LP")} valor={inteiro(c.lp_views)} />
        <Metrica rotulo={t("Leads (CRM)")} valor={inteiro(leads)} />
        <Metrica
          rotulo={t("CPL real")}
          valor={leads > 0 && c.spend > 0 ? moedaDoNumero(c.spend / leads) : "—"}
        />
        </div>
      )}

      {podeEditar ? (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={duplicar}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {t("Duplicar")}
          </button>
          <button
            type="button"
            aria-label={t("Apagar criativo")}
            onClick={() => {
              if (window.confirm(t("Apagar este criativo?"))) apagar();
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

function textoDaFalha(t: (s: string) => string, motivo: string): string {
  switch (motivo) {
    case "sem_campanhas":
      return t("Escolha da lista do Meta ao menos uma campanha para sincronizar.");
    case "sem_conexao":
      return t("O Meta não está conectado. Conecte em Configurações › Meta Ads.");
    case "token_invalido":
      return t("O Meta recusou o token de acesso. Gere um novo em Configurações › Meta Ads.");
    case "permissao_insuficiente":
      return t(
        "O token não tem permissão de leitura de anúncios (ads_read) ou não alcança esta conta.",
      );
    case "app_bloqueado":
      return t(
        "A Meta bloqueou o acesso à API do aplicativo (API access blocked). Resolva a restrição no painel do app no Meta for Developers.",
      );
    case "limite_de_chamadas":
      return t("O Meta limitou as chamadas. Tente de novo em alguns minutos.");
    default:
      return t("Não foi possível sincronizar com o Meta agora.");
  }
}

interface LinhaDoCriativo {
  id: string;
  position: number;
  c: Criativo;
  leads: number;
  faturamento: number;
  x: ReturnType<typeof taxasDoCriativo>;
  cpl: number | null;
  roas: number | null;
  /** Desqualificados do criativo e a taxa sobre os leads (0 a 1; nulo sem leads). */
  desqualificados: number;
  taxaDeDesqualificacao: number | null;
  mql: number;
  custoPorMql: number | null;
}

/**
 * Os CRIATIVOS da campanha: cada anúncio com legenda, mídia, LP e as métricas de entrega do
 * Meta. Importar traz os anúncios das campanhas atreladas (nome, título, legenda, miniatura).
 * Leads e CPL por criativo vêm do CRM, quando a origem do lead estiver ligada (C5).
 * Cartões para editar, tabela para comparar; filtros, ordem, grupos e visualizações salvas.
 */
export function CriativosDaCampanha({
  campanhaId,
  podeEditar,
  periodoPadrao,
}: {
  campanhaId: string;
  podeEditar: boolean;
  /** O período da campanha (início e fim; contínua = mês atual). */
  periodoPadrao: { de: string; ate: string };
}) {
  const t = useT();
  const {
    criativos: criativosCrus,
    carregando,
    criar,
    editar,
    duplicar,
    apagar,
    importarDoMeta,
  } = useCriativosDaCampanha(campanhaId);
  const periodo = usePeriodoDaCampanha(periodoPadrao);
  const { origem } = useOrigemDosLeads(campanhaId, periodo.janela);
  const { dados: meta } = useMetaPorAnuncio(campanhaId, periodo.janela);
  // Com a base diária, cada criativo mostra o que o anúncio dele fez NO PERÍODO escolhido.
  const criativos: Criativo[] = criativosCrus.map((c) => {
    const d = meta?.base && c.ad_id ? meta.anuncios[c.ad_id] : undefined;
    if (!meta?.base || !c.ad_id) return c;
    return {
      ...c,
      spend: d?.spend ?? 0,
      impressions: d?.impressions ?? 0,
      link_clicks: d?.link_clicks ?? 0,
      lp_views: d?.lp_views ?? 0,
    };
  });
  const semDeliveryNoPeriodo = !meta?.base && !periodo.ehPadrao;
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [novoId, setNovoId] = useState<string | null>(null);

  const linhas: LinhaDoCriativo[] = criativos.map((c) => {
    const leads = origem?.porCriativo[c.id] ?? 0;
    const faturamento = (origem?.faturamento?.porCriativo[c.id] ?? 0) / 100;
    const desqualificados = origem?.desqualificadosPorCriativo?.[c.id] ?? 0;
    const mql = origem?.mqlPorCriativo?.[c.id] ?? 0;
    return {
      desqualificados,
      taxaDeDesqualificacao: leads > 0 ? desqualificados / leads : null,
      mql,
      custoPorMql: !semDeliveryNoPeriodo && mql > 0 && c.spend > 0 ? c.spend / mql : null,
      id: c.id,
      position: c.position,
      c,
      leads,
      faturamento,
      x: taxasDoCriativo(c),
      cpl: !semDeliveryNoPeriodo && leads > 0 && c.spend > 0 ? c.spend / leads : null,
      roas: !semDeliveryNoPeriodo && c.spend > 0 && faturamento > 0 ? faturamento / c.spend : null,
    };
  });
  const opcoesDeStatus = STATUS_DO_CRIATIVO.map((s) => ({
    id: s,
    rotulo: rotuloDoStatusDoCriativo(t, s),
    cor: COR_DO_STATUS_DO_CRIATIVO[s],
  }));
  const opcoesDeFormato = FORMATOS_DO_CRIATIVO.map((f) => ({
    id: f,
    rotulo: rotuloDoFormato(t, f),
    cor: "gray" as const,
  }));

  const campos: CampoDaColecao<LinhaDoCriativo>[] = [
    { id: "nome", titulo: t("Criativo"), tipo: "texto", valorDe: (l) => l.c.name },
    {
      id: "campanha_meta",
      titulo: t("Campanha (Meta)"),
      tipo: "texto",
      valorDe: (l) => l.c.meta_campanha ?? "",
    },
    {
      id: "conjunto_meta",
      titulo: t("Conjunto de anúncios"),
      tipo: "texto",
      valorDe: (l) => l.c.meta_conjunto ?? "",
    },
    {
      id: "status",
      titulo: t("Status"),
      tipo: "opcao",
      valorDe: (l) => l.c.status,
      opcoes: opcoesDeStatus,
      ordemDoValor: (v) => STATUS_DO_CRIATIVO.indexOf(v as (typeof STATUS_DO_CRIATIVO)[number]),
    },
    {
      id: "formato",
      titulo: t("Formato"),
      tipo: "opcao",
      valorDe: (l) => l.c.format,
      opcoes: opcoesDeFormato,
    },
    { id: "investido", titulo: t("Investido"), tipo: "numero", valorDe: (l) => l.c.spend },
    { id: "impressoes", titulo: t("Impressões"), tipo: "numero", valorDe: (l) => l.c.impressions },
    {
      id: "cliques",
      titulo: t("Cliques no link"),
      tipo: "numero",
      valorDe: (l) => l.c.link_clicks,
    },
    { id: "ctr", titulo: t("CTR"), tipo: "numero", valorDe: (l) => l.x.ctr },
    { id: "cpc", titulo: t("CPC"), tipo: "numero", valorDe: (l) => l.x.cpc },
    { id: "visitas", titulo: t("Visitas à LP"), tipo: "numero", valorDe: (l) => l.c.lp_views },
    {
      id: "connection",
      titulo: t("Connection rate"),
      tipo: "numero",
      valorDe: (l) => l.x.connectRate,
    },
    { id: "leads", titulo: t("Leads (CRM)"), tipo: "numero", valorDe: (l) => l.leads },
    { id: "cpl", titulo: t("CPL real"), tipo: "numero", valorDe: (l) => l.cpl },
    { id: "mql", titulo: t("MQL"), tipo: "numero", valorDe: (l) => l.mql },
    { id: "custo_mql", titulo: t("Custo por MQL"), tipo: "numero", valorDe: (l) => l.custoPorMql },
    {
      id: "desqualificados",
      titulo: t("Desqualificados"),
      tipo: "numero",
      valorDe: (l) => l.desqualificados,
    },
    {
      id: "taxa_desq",
      titulo: t("Taxa de desqualificação"),
      tipo: "numero",
      valorDe: (l) => (l.taxaDeDesqualificacao === null ? null : l.taxaDeDesqualificacao * 100),
    },
    { id: "faturamento", titulo: t("Faturamento"), tipo: "numero", valorDe: (l) => l.faturamento },
    { id: "roas", titulo: t("ROAS"), tipo: "numero", valorDe: (l) => l.roas },
  ];

  const numero = (texto: string) => (
    <span className="block truncate px-2 text-sm tabular-nums">{texto}</span>
  );
  const colunas: ColunaDoMotor<LinhaDoCriativo>[] = [
    {
      id: "nome",
      titulo: t("Criativo"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 280,
      semOcultar: true,
      celula: (l) => (
        <CelulaDeTexto
          valor={l.c.name}
          rotulo={t("Nome do criativo")}
          podeEditar={podeEditar}
          aoSalvar={(name) => void editar(l.c.id, { name })}
        />
      ),
    },
    {
      id: "status",
      titulo: t("Status"),
      icone: <Check size={14} aria-hidden />,
      largura: 150,
      celula: (l) => (
        <SeletorDeOpcao
          opcoes={opcoesDeStatus}
          valorId={l.c.status}
          podeEditar={podeEditar}
          rotulo={t("Status")}
          aoEscolher={(id) => void editar(l.c.id, { status: id as Criativo["status"] })}
        >
          <Etiqueta ponto cor={COR_DO_STATUS_DO_CRIATIVO[l.c.status]}>
            {rotuloDoStatusDoCriativo(t, l.c.status)}
          </Etiqueta>
        </SeletorDeOpcao>
      ),
    },
    {
      id: "campanha_meta",
      titulo: t("Campanha (Meta)"),
      largura: 240,
      celula: (l) => (
        <span className="block truncate px-2 text-sm" title={l.c.meta_campanha ?? ""}>
          {l.c.meta_campanha || "—"}
        </span>
      ),
    },
    {
      id: "conjunto_meta",
      titulo: t("Conjunto de anúncios"),
      largura: 240,
      celula: (l) => (
        <span className="block truncate px-2 text-sm" title={l.c.meta_conjunto ?? ""}>
          {l.c.meta_conjunto || "—"}
        </span>
      ),
    },
    {
      id: "link",
      titulo: t("Link de destino"),
      largura: 320,
      celula: (l) => (
        <LinkComVer url={l.c.link_url}>
          <CelulaDeTexto
            valor={l.c.link_url}
            rotulo={t("Link de destino")}
            vazioRotulo="—"
            permitirVazio
            inputMode="url"
            podeEditar={podeEditar}
            aoSalvar={(link_url) => void editar(l.c.id, { link_url })}
          />
        </LinkComVer>
      ),
    },
    {
      id: "formato",
      titulo: t("Formato"),
      largura: 130,
      padrao: false,
      celula: (l) => numero(rotuloDoFormato(t, l.c.format)),
    },
    {
      id: "investido",
      titulo: t("Investido"),
      largura: 130,
      celula: (l) => numero(moedaDoNumero(l.c.spend)),
    },
    {
      id: "impressoes",
      titulo: t("Impressões"),
      largura: 130,
      celula: (l) => numero(inteiro(l.c.impressions)),
    },
    {
      id: "cliques",
      titulo: t("Cliques no link"),
      largura: 130,
      celula: (l) => numero(inteiro(l.c.link_clicks)),
    },
    { id: "ctr", titulo: t("CTR"), largura: 90, celula: (l) => numero(pct(l.x.ctr)) },
    { id: "cpc", titulo: t("CPC"), largura: 100, celula: (l) => numero(reais(l.x.cpc)) },
    {
      id: "visitas",
      titulo: t("Visitas à LP"),
      largura: 120,
      celula: (l) => numero(inteiro(l.c.lp_views)),
    },
    {
      id: "connection",
      titulo: t("Connection rate"),
      largura: 140,
      celula: (l) => numero(pct(l.x.connectRate)),
    },
    {
      id: "leads",
      titulo: t("Leads (CRM)"),
      largura: 120,
      celula: (l) => numero(inteiro(l.leads)),
    },
    { id: "cpl", titulo: t("CPL real"), largura: 110, celula: (l) => numero(reais(l.cpl)) },
    { id: "mql", titulo: t("MQL"), largura: 90, celula: (l) => numero(inteiro(l.mql)) },
    {
      id: "custo_mql",
      titulo: t("Custo por MQL"),
      largura: 130,
      celula: (l) => numero(reais(l.custoPorMql)),
    },
    {
      id: "desqualificados",
      titulo: t("Desqualificados"),
      largura: 130,
      celula: (l) => numero(inteiro(l.desqualificados)),
    },
    {
      // Barato e fora do perfil: CPL baixo com taxa alta é o criativo que atrai a pessoa errada.
      id: "taxa_desq",
      titulo: t("Taxa de desqualificação"),
      largura: 170,
      celula: (l) =>
        l.taxaDeDesqualificacao === null ? (
          numero("—")
        ) : (
          <span
            title={`${l.desqualificados} ${t("de")} ${l.leads}`}
            className={`block truncate px-2 text-sm font-medium tabular-nums ${
              l.taxaDeDesqualificacao >= 0.5
                ? "text-error-fg"
                : l.taxaDeDesqualificacao >= 0.3
                  ? "text-warning-fg"
                  : ""
            }`}
          >
            {`${Math.round(l.taxaDeDesqualificacao * 100)}%`}
          </span>
        ),
    },
    {
      id: "faturamento",
      titulo: t("Faturamento"),
      largura: 130,
      celula: (l) => numero(l.faturamento > 0 ? moedaDoNumero(l.faturamento) : "—"),
    },
    {
      id: "roas",
      titulo: t("ROAS"),
      largura: 90,
      celula: (l) =>
        numero(
          l.roas === null
            ? "—"
            : `${l.roas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`,
        ),
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 rounded-2xl border border-l-4 border-l-violet-500 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("Criativos e legendas")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <FiltroDePeriodoDaCampanha periodo={periodo} />
          {podeEditar ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={importando}
                onClick={async () => {
                  setImportando(true);
                  setAviso(null);
                  const r = await importarDoMeta();
                  setImportando(false);
                  setAviso(
                    r.ok
                      ? `${r.criados} ${t("criativos novos trazidos do Meta.")}`
                      : textoDaFalha(t, r.motivo),
                  );
                }}
                className="h-9 rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary disabled:opacity-50"
              >
                {importando ? t("Importando…") : t("Importar do Meta")}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const novo = await criar({ name: t("Novo criativo") });
                  if (novo) {
                    setNovoId(novo.id);
                    toast.success(t("Criativo criado. Preencha os dados dele."));
                  }
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium whitespace-nowrap text-primary-foreground"
              >
                <Plus size={14} weight="bold" aria-hidden />
                {t("Novo criativo")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {aviso ? (
        <p role="status" className="text-sm text-muted-foreground">
          {aviso}
        </p>
      ) : null}

      {meta?.base && meta.diferenca_pct !== null && Math.abs(meta.diferenca_pct) > 2 ? (
        <p role="status" className="rounded-xl bg-warning-bg px-3 py-2 text-xs text-warning-fg">
          {t("Atenção: a soma dos anúncios difere do total da campanha em")}{" "}
          {meta.diferenca_pct.toLocaleString("pt-BR")}%.
        </p>
      ) : null}

      <ColecaoDaCampanha
        tela="campanha-criativos"
        itens={linhas}
        carregando={carregando}
        podeEditar={podeEditar}
        vazio={t("Nenhum criativo ainda. Importe do Meta ou crie um novo.")}
        rotuloDaTabela={t("Criativos")}
        campos={campos}
        colunas={colunas}
        textoDaBusca={(l) => `${l.c.name} ${l.c.headline} ${l.c.caption} ${l.c.ad_name}`}
        aoMudarPosicao={(id, position) => void editar(id, { position })}
        destacarId={novoId}
        acoesEmMassa={(ids, limpar) => (
          <AcoesDaColecao
            ids={ids}
            limpar={limpar}
            nomeDoItem={t("criativos")}
            grupos={[
              {
                rotulo: t("Status"),
                opcoes: opcoesDeStatus,
                aplicar: async (alvo, status) => {
                  await Promise.all(
                    alvo.map((id) => editar(id, { status: status as Criativo["status"] })),
                  );
                },
              },
              {
                rotulo: t("Formato"),
                opcoes: opcoesDeFormato,
                aplicar: async (alvo, formato) => {
                  await Promise.all(
                    alvo.map((id) => editar(id, { format: formato as Criativo["format"] })),
                  );
                },
              },
            ]}
            apagar={async (alvo) => {
              await Promise.all(alvo.map((id) => apagar(id)));
            }}
          />
        )}
        cartao={(l, propriedades) => (
          <CartaoDoCriativo
            propriedades={propriedades}
            c={l.c}
            leads={l.leads}
            podeEditar={podeEditar}
            editar={(patch) => void editar(l.c.id, patch)}
            duplicar={() => void duplicar(l.c.id)}
            apagar={() => void apagar(l.c.id)}
          />
        )}
      />
      <ConjuntosDeAnuncios meta={meta} origem={origem} />
    </section>
  );
}
