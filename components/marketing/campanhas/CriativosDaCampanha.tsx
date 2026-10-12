"use client";

import { useEffect, useRef, useState } from "react";

import {
  COR_DO_STATUS_DO_CRIATIVO,
  rotuloDoFormato,
  rotuloDoStatusDoCriativo,
} from "@/components/marketing/campanhas/rotulos";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { useT } from "@/hooks/i18n/useT";
import {
  useCriativosDaCampanha,
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
import { Plus, Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const CAMPO =
  "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const AREA =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

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
  return (
    <details className="rounded-xl border p-3" open={preenchidos > 0 && preenchidos <= 1}>
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
    <div className="grid gap-2">
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
}: {
  c: Criativo;
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
    <article className="grid content-start gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary text-xs text-muted-foreground">
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
        <div className="grid min-w-0 flex-1 content-start gap-2">
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
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <select
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
        </select>
        <select
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
        </select>
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
      <div className="grid gap-2 sm:grid-cols-2">
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
            className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
          >
            <Trash size={16} aria-hidden />
          </button>
        </div>
      ) : null}
    </article>
  );
}

type ColunaOrdenavel =
  | "nome"
  | "spend"
  | "impressions"
  | "link_clicks"
  | "ctr"
  | "cpc"
  | "lp_views"
  | "connect"
  | "leads"
  | "cpl"
  | "faturamento"
  | "roas";

/**
 * Os criativos em TABELA, para comparar e achar qual converteu mais: gasto e entrega do Meta,
 * leads e CPL real do CRM, faturamento e ROAS das vendas. Clique no título da coluna para
 * ordenar; o melhor valor de cada coluna de resultado fica em destaque.
 */
function TabelaDeCriativos({
  criativos,
  origem,
  podeEditar,
  aoAbrir,
}: {
  criativos: Criativo[];
  origem: ReturnType<typeof useOrigemDosLeads>["origem"];
  podeEditar: boolean;
  aoAbrir: () => void;
}) {
  const t = useT();
  const [ordem, setOrdem] = useState<{ col: ColunaOrdenavel; desc: boolean }>({
    col: "leads",
    desc: true,
  });

  const linhas = criativos.map((c) => {
    const x = taxasDoCriativo(c);
    const leads = origem?.porCriativo[c.id] ?? 0;
    const faturamento = (origem?.faturamento?.porCriativo[c.id] ?? 0) / 100;
    return {
      c,
      nome: c.name,
      spend: c.spend,
      impressions: c.impressions,
      link_clicks: c.link_clicks,
      ctr: x.ctr,
      cpc: x.cpc,
      lp_views: c.lp_views,
      connect: x.connectRate,
      leads,
      cpl: leads > 0 && c.spend > 0 ? c.spend / leads : null,
      faturamento,
      roas: c.spend > 0 && faturamento > 0 ? faturamento / c.spend : null,
    };
  });
  const valorDe = (l: (typeof linhas)[number], col: ColunaOrdenavel): number | string | null =>
    l[col];
  const ordenadas = [...linhas].sort((a, b) => {
    const va = valorDe(a, ordem.col);
    const vb = valorDe(b, ordem.col);
    if (va === null && vb === null) return 0;
    if (va === null) return 1; // sem número vai para o fim
    if (vb === null) return -1;
    const cmp = typeof va === "string" ? va.localeCompare(String(vb)) : Number(va) - Number(vb);
    return ordem.desc ? -cmp : cmp;
  });

  // O melhor de cada coluna: maior para resultado, menor para custo.
  const melhor = (col: "ctr" | "connect" | "leads" | "faturamento" | "roas" | "cpc" | "cpl") => {
    const nums = linhas
      .map((l) => l[col])
      .filter((v): v is number => typeof v === "number" && v > 0);
    if (nums.length < 2) return null;
    return col === "cpc" || col === "cpl" ? Math.min(...nums) : Math.max(...nums);
  };
  const m = {
    ctr: melhor("ctr"),
    connect: melhor("connect"),
    leads: melhor("leads"),
    faturamento: melhor("faturamento"),
    roas: melhor("roas"),
    cpc: melhor("cpc"),
    cpl: melhor("cpl"),
  };

  const alternar = (col: ColunaOrdenavel) =>
    setOrdem((o) => (o.col === col ? { col, desc: !o.desc } : { col, desc: col !== "nome" }));
  const cab = (col: ColunaOrdenavel, rotulo: string, esquerda = false) => (
    <th
      key={col}
      className={cn(
        "px-3 py-2 font-medium whitespace-nowrap",
        esquerda ? "text-left" : "text-right",
      )}
      aria-sort={ordem.col === col ? (ordem.desc ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={() => alternar(col)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {rotulo}
        <span aria-hidden className="text-[10px]">
          {ordem.col === col ? (ordem.desc ? "▼" : "▲") : ""}
        </span>
      </button>
    </th>
  );
  const destaque = (v: number | null, melhorValor: number | null) =>
    v !== null && melhorValor !== null && v === melhorValor ? "font-semibold text-success-fg" : "";

  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              {cab("nome", t("Criativo"), true)}
              <th className="px-3 py-2 text-left font-medium">{t("Situação")}</th>
              {cab("spend", t("Investido"))}
              {cab("impressions", t("Impressões"))}
              {cab("link_clicks", t("Cliques no link"))}
              {cab("ctr", t("CTR"))}
              {cab("cpc", t("CPC"))}
              {cab("lp_views", t("Visitas à LP"))}
              {cab("connect", t("Connection rate"))}
              {cab("leads", t("Leads (CRM)"))}
              {cab("cpl", t("CPL real"))}
              {cab("faturamento", t("Faturamento"))}
              {cab("roas", t("ROAS"))}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((l) => (
              <tr key={l.c.id} className="border-t">
                <td className="max-w-72 px-3 py-2">
                  <button
                    type="button"
                    onClick={aoAbrir}
                    className="block max-w-full truncate text-left font-medium hover:underline"
                    title={podeEditar ? t("Abrir nos cartões para editar") : l.nome}
                  >
                    {l.nome}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <Etiqueta cor={COR_DO_STATUS_DO_CRIATIVO[l.c.status]}>
                    {rotuloDoStatusDoCriativo(t, l.c.status)}
                  </Etiqueta>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{moedaDoNumero(l.spend)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{inteiro(l.impressions)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{inteiro(l.link_clicks)}</td>
                <td className={cn("px-3 py-2 text-right tabular-nums", destaque(l.ctr, m.ctr))}>
                  {pct(l.ctr)}
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums", destaque(l.cpc, m.cpc))}>
                  {reais(l.cpc)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{inteiro(l.lp_views)}</td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums",
                    destaque(l.connect, m.connect),
                  )}
                >
                  {pct(l.connect)}
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums", destaque(l.leads, m.leads))}>
                  {inteiro(l.leads)}
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums", destaque(l.cpl, m.cpl))}>
                  {reais(l.cpl)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums",
                    destaque(l.faturamento > 0 ? l.faturamento : null, m.faturamento),
                  )}
                >
                  {l.faturamento > 0 ? moedaDoNumero(l.faturamento) : "—"}
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums", destaque(l.roas, m.roas))}>
                  {l.roas === null
                    ? "—"
                    : `${l.roas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          "Em verde, o melhor de cada coluna. Leads, CPL, faturamento e ROAS vêm do CRM, pela origem de cada lead e venda; gasto e entrega vêm do Meta.",
        )}
      </p>
    </div>
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
    case "limite_de_chamadas":
      return t("O Meta limitou as chamadas. Tente de novo em alguns minutos.");
    default:
      return t("Não foi possível sincronizar com o Meta agora.");
  }
}

/**
 * Os CRIATIVOS da campanha: cada anúncio com legenda, mídia, LP e as métricas de entrega do
 * Meta. Importar traz os anúncios das campanhas atreladas (nome, título, legenda, miniatura).
 * Leads e CPL por criativo vêm do CRM, quando a origem do lead estiver ligada (C5).
 */
export function CriativosDaCampanha({
  campanhaId,
  podeEditar,
}: {
  campanhaId: string;
  podeEditar: boolean;
}) {
  const t = useT();
  const { criativos, carregando, criar, editar, duplicar, apagar, importarDoMeta } =
    useCriativosDaCampanha(campanhaId);
  const { origem } = useOrigemDosLeads(campanhaId);
  const [filtro, setFiltro] = useState<Criativo["status"] | null>(null);
  const [vista, setVista] = useState<"cartoes" | "tabela">("cartoes");
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const visiveis = filtro === null ? criativos : criativos.filter((c) => c.status === filtro);

  return (
    <section className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("Criativos e legendas")}</h2>
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
              onClick={() => void criar({ name: t("Novo criativo") })}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium whitespace-nowrap text-primary-foreground"
            >
              <Plus size={14} weight="bold" aria-hidden />
              {t("Novo criativo")}
            </button>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          "Do Meta entram só gasto, impressões, cliques e visitas à LP. Os leads e o CPL real vêm do CRM, pela origem de cada lead.",
        )}
      </p>
      {aviso ? (
        <p role="status" className="text-sm text-muted-foreground">
          {aviso}
        </p>
      ) : null}

      {criativos.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              aria-pressed={filtro === null}
              onClick={() => setFiltro(null)}
              className={cn(
                "h-8 rounded-lg border px-3 text-xs font-medium whitespace-nowrap",
                filtro === null ? "border-primary bg-primary/10" : "hover:bg-secondary",
              )}
            >
              {t("Todos")}
            </button>
            {STATUS_DO_CRIATIVO.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={filtro === s}
                onClick={() => setFiltro(s)}
                className={cn(
                  "h-8 rounded-lg border px-3 text-xs font-medium whitespace-nowrap",
                  filtro === s ? "border-primary bg-primary/10" : "hover:bg-secondary",
                )}
              >
                {rotuloDoStatusDoCriativo(t, s)}
              </button>
            ))}
          </div>
          <div
            role="group"
            aria-label={t("Como ver os criativos")}
            className="inline-flex rounded-xl bg-secondary p-0.5"
          >
            {(
              [
                ["cartoes", t("Cartões")],
                ["tabela", t("Tabela")],
              ] as const
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={vista === valor}
                onClick={() => setVista(valor)}
                className={cn(
                  "h-9 rounded-[10px] px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  vista === valor
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {carregando ? (
        <div className="h-24 animate-pulse rounded-xl bg-secondary" aria-busy="true" />
      ) : visiveis.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {t("Nenhum criativo ainda. Importe do Meta ou crie um novo.")}
        </p>
      ) : vista === "tabela" ? (
        <TabelaDeCriativos
          criativos={visiveis}
          origem={origem}
          podeEditar={podeEditar}
          aoAbrir={() => setVista("cartoes")}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visiveis.map((c) => (
            <CartaoDoCriativo
              key={c.id}
              c={c}
              leads={origem?.porCriativo[c.id] ?? 0}
              podeEditar={podeEditar}
              editar={(patch) => void editar(c.id, patch)}
              duplicar={() => void duplicar(c.id)}
              apagar={() => void apagar(c.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
