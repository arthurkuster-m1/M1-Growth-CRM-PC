"use client";

/**
 * O painel da tela de Tags: a lista do vocabulário com o PESO de cada etiqueta e
 * as operações — renomear, juntar, excluir (issue #852, fatia S4) e a cor
 * (issue #1271, fatia S6).
 *
 * ── Por que cada linha abre com os números, e não com o botão ───────────────
 *
 * A pergunta que traz o operador até aqui é "posso mexer nesta?". A resposta é o
 * número: quantos contatos, leads e conversas carregam a etiqueta, e quantas
 * regras de agente ainda escrevem esse nome. A coluna de regras é a que a lista
 * de conversas nunca mostrava — foi ela que deixou a grafia antiga voltar depois
 * da "arrumação".
 *
 * ── Por que excluir pede confirmação e renomear não ─────────────────────────
 *
 * Renomear é reversível: o nome novo aparece na lista e dá para voltar. Excluir
 * tira a etiqueta de todos os registros da organização e não existe desfazer —
 * então a confirmação diz exatamente o que sai, com o número na frente. As
 * regras `add_tag` NÃO são apagadas pela exclusão (decisão de outra tela, com o
 * runbook do agente na mão); o aviso informa quantas continuam escrevendo.
 *
 * ── Por que a cor mora NESTA tela, e não numa tela de aparência ─────────────
 *
 * Cor de etiqueta parece cosmético e não é: é a informação que faz o operador
 * achar "reclamação" numa fila de duzentas conversas antes de ler o texto, e é a
 * que denuncia a duplicata que a contagem de uso não mostra ("orçamento" e
 * "orçamento novo" em dois tons do mesmo verde). O lugar de decidir isso é a
 * tela que já responde "onde esta tag está usada" — não um painel de tema,
 * porque quem escolhe a cor aqui é quem arruma o vocabulário.
 *
 * ── Por que os tons têm NOME, e a fileira não é um seletor de cor ───────────
 *
 * A fileira oferece oito tons medidos (`PALETA_DE_ETIQUETAS`), não um seletor
 * livre: seletor livre recria em cada instalação o problema que esta tela veio
 * consertar. Cada tom tem nome porque cor não é o único jeito de escolher —
 * quem não distingue matiz (ou está com o brilho no mínimo) escolhe por
 * "Âmbar"/"Roxo", e o leitor de tela anuncia o mesmo. É a régua de redundância
 * não-cromática que o design system já usa nos estados.
 */
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChipDeEtiqueta } from "@/components/tags/ChipDeEtiqueta";
import { CaixaRedonda } from "@/components/ui/CaixaRedonda";
import { SelectDoApp } from "@/components/ui/SelectDoApp";
import { invalidarCoresDasEtiquetas } from "@/components/tags/CoresDasEtiquetas";
import { cn } from "@/lib/utils";
import { PALETA_DE_ETIQUETAS, normalizarCorDeEtiqueta } from "@/lib/tags/cor-da-etiqueta";
import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";
import { useCategoriasDeTags } from "@/components/tags/CoresDasEtiquetas";
import { categoriaDaTag, corDaCategoria } from "@/lib/tags/categorias";
import type { AcaoDeVocabulario, LinhaDeVocabulario } from "@/lib/schemas/tags";

/**
 * O TETO DA LISTA, e por que ele é declarado aqui.
 *
 * `fn_vocabulario_de_tags` termina em `limit 500` (migration 0264). A rota
 * devolve `meta.total = tags.length`, que é o tamanho da PÁGINA e não o total —
 * então nem o `meta` denuncia o corte. Sem esta linha, numa organização com mais
 * de 500 etiquetas distintas a que o operador veio arrumar podia simplesmente
 * não estar na tela, nem na lista de destinos do "juntar", sem nada dizendo que
 * faltava alguma. Lista truncada em silêncio lê como lista completa.
 *
 * O número vive nos DOIS arquivos e é vigiado por
 * `tests/unit/tags-vocabulario.test.ts` ("o teto da tela é o mesmo `limit` do
 * SQL"), que lê o `limit` da migration e esta constante: mudar um sem o outro
 * reprova.
 */
const TETO_DA_LISTA = 500;

/**
 * O NOME DE CADA TOM DA PALETA, e o teste que impede os dois divergirem.
 *
 * `tests/unit/tags-cor-de-etiqueta.test.ts` cobra que este mapa tenha
 * EXATAMENTE as chaves de `PALETA_DE_ETIQUETAS`. Sem ele, acrescentar um tom à
 * paleta deixaria um quarto círculo mudo na fileira (o `?? tom` abaixo cobre a
 * tela, mas o nome iria embora em silêncio) — o mesmo defeito que o `TETO_DA_LISTA`
 * previne para o `limit` do SQL.
 */
const NOME_DO_TOM: Record<string, string> = {
  "#ffe629": "Amarelo",
  "#ffb224": "Âmbar",
  "#cf3716": "Vermelho",
  "#00655a": "Verde-água",
  "#0091ff": "Azul",
  "#3e63dd": "Índigo",
  "#ab4aba": "Roxo",
  "#6f6f6f": "Cinza",
};

/** Cada recusa do servidor vira uma frase que diz O QUE FAZER. */
const ERRO_EM_PORTUGUES: Record<string, string> = {
  validation_failed: "Confira a tag, o novo nome e a cor.",
  forbidden: "Só um gerente ou administrador da organização pode mudar as tags.",
  unauthenticated: "Sua sessão expirou. Entre de novo.",
  mfa_required: "Confirme o segundo fator para mudar as tags.",
  forbidden_tenant: "Você não está em nenhuma organização ativa.",
};

export function PainelDeTags({ tags, idioma }: { tags: LinhaDeVocabulario[]; idioma: Idioma }) {
  const t = (texto: string) => traduzir(texto, idioma);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [alvo, setAlvo] = useState<LinhaDeVocabulario | null>(null);
  const [acao, setAcao] = useState<AcaoDeVocabulario>("renomear");
  const [destino, setDestino] = useState("");
  const [cor, setCor] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Visão por categoria: filtrar, agrupar e ordenar.
  const config = useCategoriasDeTags();
  const [filtro, setFiltro] = useState("");
  const [agrupar, setAgrupar] = useState(false);
  const [ordem, setOrdem] = useState<"padrao" | "nome" | "categoria" | "uso">("padrao");
  // Seleção em massa: as tags marcadas e a operação que está sendo montada para elas.
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [lote, setLote] = useState<"definir_cor" | "juntar" | "excluir" | null>(null);
  const [loteDestino, setLoteDestino] = useState("");
  const [loteCor, setLoteCor] = useState<string | null>(null);

  const grupos = useMemo(() => {
    const posicao = (tag: string) => {
      const id = categoriaDaTag(tag, config)?.id;
      const i = id ? config.categorias.findIndex((c) => c.id === id) : -1;
      return i < 0 ? config.categorias.length : i;
    };
    const uso = (l: LinhaDeVocabulario) => l.uso_em_contatos + l.uso_em_leads + l.uso_em_conversas;
    const filtradas = tags.filter((l) =>
      filtro === ""
        ? true
        : filtro === "__sem__"
          ? categoriaDaTag(l.tag, config) === null
          : categoriaDaTag(l.tag, config)?.id === filtro,
    );
    const ordenadas = [...filtradas].sort((a, b) =>
      ordem === "padrao"
        ? 0
        : ordem === "categoria"
          ? posicao(a.tag) - posicao(b.tag) || a.tag.localeCompare(b.tag)
          : ordem === "uso"
            ? uso(b) - uso(a) || a.tag.localeCompare(b.tag)
            : a.tag.localeCompare(b.tag),
    );
    if (!agrupar) return [{ chave: "todas", titulo: null as string | null, linhas: ordenadas }];
    const porCategoria = new Map<string, LinhaDeVocabulario[]>();
    for (const l of ordenadas) {
      const id = categoriaDaTag(l.tag, config)?.id ?? "__sem__";
      porCategoria.set(id, [...(porCategoria.get(id) ?? []), l]);
    }
    return [...config.categorias.map((c) => c.id), "__sem__"]
      .filter((id) => porCategoria.has(id))
      .map((id) => ({
        chave: id,
        titulo: config.categorias.find((c) => c.id === id)?.nome ?? "Sem categoria",
        linhas: porCategoria.get(id)!,
      }));
  }, [tags, config, filtro, agrupar, ordem]);

  const destinos = useMemo(
    () => tags.filter((linha) => linha.tag.toLowerCase() !== alvo?.tag.toLowerCase()),
    [tags, alvo],
  );

  const visiveis = useMemo(() => grupos.flatMap((g) => g.linhas), [grupos]);
  const todasMarcadas = visiveis.length > 0 && visiveis.every((l) => marcadas.has(l.tag));
  const algumaMarcada = visiveis.some((l) => marcadas.has(l.tag));
  const linhasMarcadas = useMemo(() => tags.filter((l) => marcadas.has(l.tag)), [tags, marcadas]);
  const destinosDoLote = useMemo(() => tags.filter((l) => !marcadas.has(l.tag)), [tags, marcadas]);
  const alternarMarca = (tag: string) =>
    setMarcadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(tag)) novo.delete(tag);
      else novo.add(tag);
      return novo;
    });
  const alternarTodas = () =>
    setMarcadas(todasMarcadas ? new Set() : new Set(visiveis.map((l) => l.tag)));
  function abrirLote(qual: "definir_cor" | "juntar" | "excluir") {
    setAlvo(null);
    setLote(qual);
    setLoteDestino("");
    setLoteCor(null);
  }
  function fecharLote() {
    setLote(null);
  }

  /** Aplica a operação a cada tag marcada, uma de cada vez (o servidor opera uma tag por chamada). */
  async function enviarLote() {
    if (!lote || linhasMarcadas.length === 0) return;
    setOcupado(true);
    let feitas = 0;
    let falhas = 0;
    let codigoDaFalha = "";
    try {
      for (const linha of linhasMarcadas) {
        const resposta = await fetch("/api/v1/tags/vocabulario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            acao: lote,
            tag: linha.tag,
            destino: lote === "juntar" ? loteDestino : null,
            ...(lote === "definir_cor" ? { cor: loteCor } : {}),
          }),
        }).catch(() => null);
        if (resposta?.ok) {
          feitas += 1;
        } else {
          falhas += 1;
          if (!codigoDaFalha) {
            const corpo = (await resposta?.json().catch(() => null)) as {
              error?: { code?: string };
            } | null;
            codigoDaFalha = corpo?.error?.code ?? "internal_error";
          }
        }
      }
    } finally {
      setOcupado(false);
    }
    if (lote === "definir_cor") invalidarCoresDasEtiquetas(queryClient);
    // O número entra fora do `t()` (a frase montada em runtime não casa o dicionário).
    if (falhas === 0) {
      toast.success(`${feitas} ${t("tag(s) atualizada(s).")}`);
    } else {
      toast.error(
        `${feitas} ${t("de")} ${feitas + falhas} ${t("tag(s) atualizada(s).")} ${t(
          ERRO_EM_PORTUGUES[codigoDaFalha] ?? "Não foi possível concluir agora. Tente de novo.",
        )}`,
      );
    }
    setMarcadas(new Set());
    setLote(null);
    router.refresh();
  }

  function abrir(linha: LinhaDeVocabulario, qual: AcaoDeVocabulario) {
    setLote(null);
    setAlvo(linha);
    setAcao(qual);
    setDestino("");
    // A cor já vem do servidor (`linha.cor`): a fileira abre com a escolha atual
    // marcada. Sem isso, abrir a cor de uma etiqueta que JÁ tem uma faria parecer
    // que ela não tem nenhuma, e "Confirmar" apagaria o que estava lá. Lida pela
    // normalização porque `linha.cor` vem crua do SQL: uma etiqueta com o tom
    // antigo da #2373 abre com o tom novo marcado.
    setCor(qual === "definir_cor" ? normalizarCorDeEtiqueta(linha.cor) : null);
  }

  async function enviar() {
    if (!alvo) return;
    setOcupado(true);
    try {
      const resposta = await fetch("/api/v1/tags/vocabulario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `cor` só viaja na ação que fala dela: o servidor recusa o campo nas
        // outras (`cor_invalida_para_acao`), e mandar sempre faria a tela
        // depender de o servidor ignorar o que não pediu.
        body: JSON.stringify({
          acao,
          tag: alvo.tag,
          destino: destino || null,
          ...(acao === "definir_cor" ? { cor } : {}),
        }),
      });
      const corpo = (await resposta.json().catch(() => null)) as {
        data?: Record<string, number | string | boolean | null>;
        error?: { code?: string };
      } | null;
      if (!resposta.ok) {
        const codigo = corpo?.error?.code ?? "internal_error";
        toast.error(
          t(ERRO_EM_PORTUGUES[codigo] ?? "Não foi possível concluir agora. Tente de novo."),
        );
        return;
      }
      const dados = corpo?.data ?? {};
      if (acao === "definir_cor") {
        // Escrever a cor é o ÚNICO caso em que esta tela muda o que outra tela
        // mostra: o chip da lista de conversas, o funil e os filtros leem o mapa
        // do provider. Sem esta invalidação o operador trocaria a cor, voltaria
        // para o Inbox e veria a antiga até o `staleTime` de 5 min vencer.
        invalidarCoresDasEtiquetas(queryClient);
        toast.success(t("Cor da tag atualizada."));
        setAlvo(null);
        router.refresh();
        return;
      }
      const alterados =
        Number(dados.contatos ?? 0) + Number(dados.leads ?? 0) + Number(dados.conversas ?? 0);
      // ⚠️ O DADO ENTRA FORA DO `t()`. `traduzir()` casa a string EXATA, então
      // uma frase montada em runtime nunca casa chave nenhuma —
      // a frase sai em português para quem escolheu espanhol, e o guarda de i18n
      // não acusa (ele só registra literal sem substituição).
      toast.success(
        acao === "excluir"
          ? `${t("Tag removida de")} ${alterados} ${t("registro(s).")}`
          : `${t("Tag atualizada em")} ${alterados} ${t("registro(s) e em")} ${Number(dados.regras ?? 0)} ${t("regra(s) de agente.")}`,
      );
      setAlvo(null);
      router.refresh();
    } catch {
      // Sem este ramo, uma falha de REDE (app reiniciando, conexão caída) não
      // dizia nada: o botão voltava de "Aplicando..." para "Confirmar", que lê
      // como "nada aconteceu" — enquanto a operação pode ter sido aplicada no
      // servidor. O caminho de erro do SERVIDOR já era tratado acima.
      toast.error(
        t(
          "Não foi possível falar com o servidor. Recarregue a página e confira antes de tentar de novo.",
        ),
      );
    } finally {
      setOcupado(false);
    }
  }

  if (tags.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        {t(
          "Nenhuma tag nesta organização ainda. Elas aparecem aqui conforme os agentes, o Inbox e o funil usarem.",
        )}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">{t("Categoria")}</span>
          <SelectDoApp
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            aria-label={t("Categoria")}
            className="min-w-40"
          >
            <option value="">{t("Todas")}</option>
            {config.categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
            <option value="__sem__">{t("Sem categoria")}</option>
          </SelectDoApp>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">{t("Ordenar por")}</span>
          <SelectDoApp
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as "padrao" | "nome" | "categoria" | "uso")}
            aria-label={t("Ordenar por")}
            className="min-w-36"
          >
            <option value="padrao">{t("Padrão")}</option>
            <option value="nome">{t("Nome")}</option>
            <option value="categoria">{t("Categoria")}</option>
            <option value="uso">{t("Mais usadas")}</option>
          </SelectDoApp>
        </label>
        <label className="flex items-center gap-2">
          <CaixaRedonda checked={agrupar} onChange={(e) => setAgrupar(e.target.checked)} />
          {t("Agrupar por categoria")}
        </label>
      </div>
      {marcadas.size > 0 ? (
        <div
          data-testid="barra-de-tags-em-massa"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-sm"
        >
          <span className="font-medium">
            {marcadas.size} {t("selecionada(s)")}
          </span>
          <Button size="sm" variant="outline" onClick={() => abrirLote("definir_cor")}>
            {t("Cor")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => abrirLote("juntar")}>
            {t("Juntar em…")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => abrirLote("excluir")}>
            {t("Excluir")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setMarcadas(new Set());
              setLote(null);
            }}
          >
            {t("Limpar seleção")}
          </Button>
        </div>
      ) : null}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("Tags da organização e onde são usadas")}</caption>
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="w-10 p-3">
                <CaixaRedonda
                  checked={todasMarcadas}
                  parcial={algumaMarcada && !todasMarcadas}
                  onChange={alternarTodas}
                  aria-label={t("Selecionar todas as tags da lista")}
                />
              </th>
              <th className="p-3 font-medium">{t("Tag")}</th>
              <th className="p-3 font-medium">{t("Categoria")}</th>
              <th className="p-3 font-medium">{t("Contatos")}</th>
              <th className="p-3 font-medium">{t("Leads")}</th>
              <th className="p-3 font-medium">{t("Conversas")}</th>
              <th className="p-3 font-medium">{t("Regras de agente")}</th>
              <th className="p-3 font-medium">{t("Ações")}</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <Fragment key={g.chave}>
                {g.titulo ? (
                  <tr className="bg-muted/40">
                    <td colSpan={8} className="px-3 py-1.5 text-xs font-semibold">
                      {g.titulo}{" "}
                      <span className="font-normal text-muted-foreground">({g.linhas.length})</span>
                    </td>
                  </tr>
                ) : null}
                {g.linhas.map((linha) => (
                  <tr
                    key={linha.tag}
                    className={cn(
                      "border-t border-border/60",
                      marcadas.has(linha.tag) && "bg-primary/5",
                    )}
                  >
                    <td className="w-10 p-3">
                      <CaixaRedonda
                        checked={marcadas.has(linha.tag)}
                        onChange={() => alternarMarca(linha.tag)}
                        aria-label={`${t("Selecionar")} ${linha.tag}`}
                      />
                    </td>
                    <td className="p-3">
                      {/* A cor do SERVIDOR, não a do cache do chip: esta lista acabou
                      de ler o vocabulário, e mostrar o que a outra leitura
                      devolveu seria a tela discordando de si mesma por alguns
                      segundos. */}
                      <ChipDeEtiqueta
                        tag={linha.tag}
                        cor={linha.cor ?? corDaCategoria(linha.tag, config)}
                      />
                      {!linha.no_vocabulario && (
                        // Em uso e fora do vocabulário curado: existe em algum
                        // registro sem passar por nenhuma tela de cadastro. Dar cor
                        // (o botão ao lado) traz a etiqueta para o vocabulário —
                        // escolher como ela aparece É curá-la.
                        <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {t("em uso, fora do vocabulário")}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {categoriaDaTag(linha.tag, config)?.nome ?? "—"}
                    </td>
                    <td className="p-3 tabular-nums">{linha.uso_em_contatos}</td>
                    <td className="p-3 tabular-nums">{linha.uso_em_leads}</td>
                    <td className="p-3 tabular-nums">{linha.uso_em_conversas}</td>
                    <td className="p-3 tabular-nums">
                      {linha.em_regras > 0 ? (
                        <span className="font-medium">{linha.em_regras}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="flex flex-wrap gap-2 p-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrir(linha, "definir_cor")}
                      >
                        {t("Cor")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => abrir(linha, "renomear")}>
                        {t("Renomear")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => abrir(linha, "juntar")}>
                        {t("Juntar")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => abrir(linha, "excluir")}>
                        {t("Excluir")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
        {tags.length >= TETO_DA_LISTA && (
          <p className="border-t border-border/60 p-3 text-sm text-muted-foreground">
            {t(
              "Mostrando as 500 primeiras tags em ordem alfabética. Se a que você procura não está aqui, arrume primeiro as que aparecem.",
            )}
          </p>
        )}
      </Card>

      {lote && linhasMarcadas.length > 0 && (
        <Card className="flex flex-col gap-4 p-4" data-testid="painel-de-tags-em-massa">
          <p className="text-sm">
            {lote === "excluir" && (
              <>
                {t("Excluir")} <strong>{linhasMarcadas.length}</strong> {t("tag(s) de")}{" "}
                {linhasMarcadas.reduce((n, l) => n + l.uso_em_contatos, 0)} {t("contato(s),")}{" "}
                {linhasMarcadas.reduce((n, l) => n + l.uso_em_leads, 0)} {t("lead(s) e")}{" "}
                {linhasMarcadas.reduce((n, l) => n + l.uso_em_conversas, 0)} {t("conversa(s).")}
              </>
            )}
            {lote === "juntar" && (
              <>
                {t("Juntar")} <strong>{linhasMarcadas.length}</strong>{" "}
                {t("tag(s) em uma tag existente:")}
              </>
            )}
            {lote === "definir_cor" && (
              <>
                {t("Cor para")} <strong>{linhasMarcadas.length}</strong> {t("tag(s):")}
              </>
            )}
          </p>
          {lote === "excluir" && linhasMarcadas.some((l) => l.em_regras > 0) && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              {t("Atenção:")} {linhasMarcadas.reduce((n, l) => n + l.em_regras, 0)}{" "}
              {t(
                "regra(s) de agente continuam escrevendo estas tags. Excluir aqui não apaga a regra — o agente vai recriar a tag no próximo atendimento.",
              )}
            </p>
          )}
          {lote === "juntar" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="destino-da-juncao-em-massa">{t("Tag de destino")}</Label>
              <SelectDoApp
                id="destino-da-juncao-em-massa"
                aria-label={t("Tag de destino")}
                value={loteDestino}
                onChange={(e) => setLoteDestino(e.target.value)}
              >
                <option value="">{t("Escolha a tag que fica")}</option>
                {destinosDoLote.map((l) => (
                  <option key={l.tag} value={l.tag}>
                    {l.tag}
                  </option>
                ))}
              </SelectDoApp>
            </div>
          )}
          {lote === "definir_cor" && (
            <div className="flex flex-wrap items-center gap-2">
              {PALETA_DE_ETIQUETAS.map((tom) => (
                <button
                  key={tom}
                  type="button"
                  onClick={() => setLoteCor(tom)}
                  aria-pressed={loteCor === tom}
                  aria-label={t(NOME_DO_TOM[tom] ?? tom)}
                  title={tom}
                  className={cn(
                    "size-7 rounded-full border-2 transition-transform",
                    loteCor === tom
                      ? "border-foreground ring-2 ring-ring ring-offset-1 ring-offset-background"
                      : "border-transparent hover:scale-110",
                  )}
                  style={{ backgroundColor: tom }}
                />
              ))}
              <Button
                type="button"
                size="sm"
                variant={loteCor === null ? "default" : "outline"}
                aria-pressed={loteCor === null}
                onClick={() => setLoteCor(null)}
              >
                {t("Sem cor")}
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              onClick={enviarLote}
              disabled={ocupado || (lote === "juntar" && loteDestino === "")}
              variant={lote === "excluir" ? "destructive" : "default"}
            >
              {ocupado ? t("Aplicando...") : t("Confirmar")}
            </Button>
            <Button variant="ghost" onClick={fecharLote} disabled={ocupado}>
              {t("Cancelar")}
            </Button>
          </div>
        </Card>
      )}

      {alvo && (
        <Card className="flex flex-col gap-4 p-4">
          <p className="text-sm">
            {/* Mesma regra do toast: o texto estático passa por `t()`, a
                etiqueta entra fora dele. */}
            {acao === "renomear" && (
              <>
                {t("Renomear")} <strong>{alvo.tag}</strong> {t("para:")}
              </>
            )}
            {acao === "juntar" && (
              <>
                {t("Juntar")} <strong>{alvo.tag}</strong> {t("em outra tag existente:")}
              </>
            )}
            {acao === "excluir" && (
              <>
                {t("Excluir")} <strong>{alvo.tag}</strong> {t("de")} {alvo.uso_em_contatos}{" "}
                {t("contato(s),")} {alvo.uso_em_leads} {t("lead(s) e")} {alvo.uso_em_conversas}{" "}
                {t("conversa(s).")}
              </>
            )}
            {acao === "definir_cor" && (
              <>
                {t("Cor")} <strong>{alvo.tag}</strong> {t("nas listas e nos filtros:")}
              </>
            )}
          </p>

          {acao === "excluir" ? (
            alvo.em_regras > 0 && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                {t("Atenção:")} {alvo.em_regras}{" "}
                {t(
                  "regra(s) de agente continuam escrevendo esta tag. Excluir aqui não apaga a regra — o agente vai recriar a tag no próximo atendimento.",
                )}
              </p>
            )
          ) : acao === "juntar" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="destino-da-juncao">{t("Tag de destino")}</Label>
              <SelectDoApp
                id="destino-da-juncao"
                aria-label={t("Tag de destino")}
                value={destino}
                onChange={(evento) => setDestino(evento.target.value)}
              >
                <option value="">{t("Escolha a tag que fica")}</option>
                {destinos.map((linha) => (
                  <option key={linha.tag} value={linha.tag}>
                    {linha.tag}
                  </option>
                ))}
              </SelectDoApp>
            </div>
          ) : acao === "definir_cor" ? (
            <div className="flex flex-col gap-3">
              <Label>{t("Cor da tag")}</Label>
              <div className="flex flex-wrap items-center gap-2">
                {PALETA_DE_ETIQUETAS.map((tom) => (
                  <button
                    key={tom}
                    type="button"
                    onClick={() => setCor(tom)}
                    aria-pressed={cor === tom}
                    // O nome do tom é o rótulo acessível; a cor é reforço. Quem
                    // escolhe por "Âmbar" e quem escolhe pelo círculo chegam ao
                    // mesmo lugar.
                    aria-label={t(NOME_DO_TOM[tom] ?? tom)}
                    title={tom}
                    className={cn(
                      "size-7 rounded-full border-2 transition-transform",
                      cor === tom
                        ? "border-foreground ring-2 ring-ring ring-offset-1 ring-offset-background"
                        : "border-transparent hover:scale-110",
                    )}
                    style={{ backgroundColor: tom }}
                  />
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={cor === null ? "default" : "outline"}
                  aria-pressed={cor === null}
                  onClick={() => setCor(null)}
                >
                  {t("Sem cor")}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{t("Prévia:")}</span>
                {/* A prévia usa o TOM SELECIONADO antes de salvar: escolher cor
                    por paleta sem ver o resultado no próprio chip é adivinhação. */}
                <ChipDeEtiqueta tag={alvo.tag} cor={cor} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="novo-nome-da-tag">{t("Novo nome")}</Label>
              <Input
                id="novo-nome-da-tag"
                value={destino}
                onChange={(evento) => setDestino(evento.target.value)}
                maxLength={60}
                placeholder={alvo.tag}
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={enviar}
              disabled={
                ocupado ||
                (acao !== "excluir" && acao !== "definir_cor" && destino.trim().length === 0)
              }
              variant={acao === "excluir" ? "destructive" : "default"}
            >
              {ocupado ? t("Aplicando...") : t("Confirmar")}
            </Button>
            <Button variant="ghost" onClick={() => setAlvo(null)} disabled={ocupado}>
              {t("Cancelar")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
