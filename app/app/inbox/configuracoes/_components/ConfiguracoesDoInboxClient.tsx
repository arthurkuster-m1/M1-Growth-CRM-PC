"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CaretLeft } from "@phosphor-icons/react";
import { toast } from "sonner";

import { TemplatesClient } from "@/app/app/templates/_components/TemplatesClient";
import { useCategoriasDeTags } from "@/components/tags/CoresDasEtiquetas";
import { ChipDeEtiqueta } from "@/components/tags/ChipDeEtiqueta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { channelLabel, useChannelSessions } from "@/hooks/channels/useChannelSessions";
import { useContactTagVocabulary } from "@/hooks/contacts/useContactTagVocabulary";
import { useT } from "@/hooks/i18n/useT";
import { useConversationTagVocabulary } from "@/hooks/inbox/useConversationTags";
import { useConfigDoInbox, useSalvarConfigDoInbox } from "@/hooks/inbox/useConfigDoInbox";
import {
  CORES_DOS_NUMEROS,
  type ConfigDoInbox,
  type NumeroDoInbox,
} from "@/lib/inbox/configuracao";
import { categoriaDaTag } from "@/lib/tags/categorias";
import { chaveDaEtiqueta } from "@/lib/tags/cor-da-etiqueta";
import { cn } from "@/lib/utils";

type Aba = "etiquetas" | "respostas" | "numeros";

interface Props {
  podeEditar: boolean;
  canShare: boolean;
  currentUserId: string;
}

export function ConfiguracoesDoInboxClient({ podeEditar, canShare, currentUserId }: Props) {
  const t = useT();
  const [aba, setAba] = useState<Aba>("etiquetas");
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/app/inbox"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <CaretLeft size={14} aria-hidden /> {t("Voltar ao Inbox")}
      </Link>
      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
        <TabsList>
          <TabsTrigger value="etiquetas">{t("Tags")}</TabsTrigger>
          <TabsTrigger value="respostas">{t("Respostas rápidas")}</TabsTrigger>
          <TabsTrigger value="numeros">{t("Números")}</TabsTrigger>
        </TabsList>
      </Tabs>
      {aba === "etiquetas" && <EtiquetasDoFiltro podeEditar={podeEditar} />}
      {aba === "respostas" && <TemplatesClient canShare={canShare} currentUserId={currentUserId} />}
      {aba === "numeros" && <NumerosDeAtendimento podeEditar={podeEditar} />}
    </div>
  );
}

/** Quais categorias e etiquetas aparecem no filtro de tags do Inbox. */
function EtiquetasDoFiltro({ podeEditar }: { podeEditar: boolean }) {
  const t = useT();
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.orgId ?? null;
  const config = useConfigDoInbox();
  const salvar = useSalvarConfigDoInbox();
  const categorias = useCategoriasDeTags();
  const { data: deConversa } = useConversationTagVocabulary(orgId);
  const { data: deContato } = useContactTagVocabulary(orgId);

  const grupos = useMemo(() => {
    const todas = [...new Set([...(deConversa ?? []), ...(deContato ?? [])])].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
    const porCategoria = new Map<string, { id: string; nome: string; tags: string[] }>();
    for (const tag of todas) {
      const c = categoriaDaTag(tag, categorias);
      const id = c?.id ?? "_sem";
      const g = porCategoria.get(id) ?? { id, nome: c?.nome ?? "Sem categoria", tags: [] };
      g.tags.push(tag);
      porCategoria.set(id, g);
    }
    return [...porCategoria.values()];
  }, [deConversa, deContato, categorias]);

  function gravar(proxima: ConfigDoInbox) {
    salvar.mutate(proxima, {
      onError: () => toast.error(t("Não foi possível salvar.")),
    });
  }
  const alternaCategoria = (id: string, visivel: boolean) =>
    gravar({
      ...config,
      categorias_ocultas: visivel
        ? config.categorias_ocultas.filter((c) => c !== id)
        : [...config.categorias_ocultas, id],
    });
  const alternaTag = (tag: string, visivel: boolean) => {
    const chave = chaveDaEtiqueta(tag);
    gravar({
      ...config,
      tags_ocultas: visivel
        ? config.tags_ocultas.filter((x) => x !== chave)
        : [...config.tags_ocultas, chave],
    });
  };

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("Escolha o que aparece no filtro de tags do Inbox. Para criar, renomear ou recolorir, use o editor de tags.")}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/settings/tags">{t("Editar tags")}</Link>
        </Button>
      </div>
      {grupos.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("Ainda não há tags.")}</p>
      )}
      {grupos.map((g) => {
        const categoriaVisivel = !config.categorias_ocultas.includes(g.id);
        return (
          <div key={g.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{g.nome}</p>
              <Switch
                aria-label={`${t("Mostrar categoria")} ${g.nome}`}
                checked={categoriaVisivel}
                disabled={!podeEditar || salvar.isPending}
                onCheckedChange={(v) => alternaCategoria(g.id, v)}
              />
            </div>
            <ul className={cn("mt-2 flex flex-col gap-1", !categoriaVisivel && "opacity-50")}>
              {g.tags.map((tag) => {
                const visivel = !config.tags_ocultas.includes(chaveDaEtiqueta(tag));
                return (
                  <li key={tag} className="flex items-center justify-between gap-3">
                    <ChipDeEtiqueta tag={tag} contorno />
                    <Switch
                      aria-label={`${t("Mostrar tag")} ${tag}`}
                      checked={visivel}
                      disabled={!podeEditar || salvar.isPending || !categoriaVisivel}
                      onCheckedChange={(v) => alternaTag(tag, v)}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {!podeEditar && (
        <p className="text-xs text-muted-foreground">
          {t("Só gerentes e administradores alteram estas opções.")}
        </p>
      )}
    </section>
  );
}

/** Nome e cor de cada número de atendimento (aparecem no seletor do rodapé da lista). */
function NumerosDeAtendimento({ podeEditar }: { podeEditar: boolean }) {
  const t = useT();
  const { data: canais } = useChannelSessions();
  const config = useConfigDoInbox();
  const salvar = useSalvarConfigDoInbox();
  const [rascunho, setRascunho] = useState<Record<string, NumeroDoInbox>>({});

  const valor = (id: string): NumeroDoInbox => ({ ...config.numeros[id], ...rascunho[id] });
  const editar = (id: string, parte: NumeroDoInbox) =>
    setRascunho((r) => ({ ...r, [id]: { ...r[id], ...parte } }));

  function gravar() {
    const numeros: Record<string, NumeroDoInbox> = { ...config.numeros };
    for (const id of Object.keys(rascunho)) {
      const v = valor(id);
      const nome = v.nome?.trim() ?? "";
      if (nome || v.cor) numeros[id] = { ...(nome ? { nome } : {}), ...(v.cor ? { cor: v.cor } : {}) };
      else delete numeros[id];
    }
    salvar.mutate(
      { ...config, numeros },
      {
        onSuccess: () => {
          setRascunho({});
          toast.success(t("Números salvos."));
        },
        onError: () => toast.error(t("Não foi possível salvar.")),
      },
    );
  }

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t("Dê um nome e uma cor a cada número. Eles aparecem como tags coloridas no rodapé da lista de conversas. Para conectar um número novo, vá em Conexões.")}
      </p>
      {(canais ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">{t("Nenhum número conectado.")}</p>
      )}
      {(canais ?? []).map((c) => {
        const v = valor(c.id);
        return (
          <div key={c.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">
              {channelLabel(c, t)}
              {c.phone_number ? ` · ${c.phone_number}` : ""}
            </p>
            <Input
              aria-label={`${t("Nome do número")} ${channelLabel(c, t)}`}
              value={v.nome ?? ""}
              maxLength={40}
              disabled={!podeEditar}
              placeholder={t("Ex.: Comercial, Suporte")}
              onChange={(e) => editar(c.id, { nome: e.target.value })}
            />
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("Cor do número")}>
              {CORES_DOS_NUMEROS.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  role="radio"
                  aria-checked={v.cor === cor}
                  aria-label={cor}
                  disabled={!podeEditar}
                  onClick={() => editar(c.id, { cor })}
                  className={cn(
                    "size-6 rounded-full border-2 border-transparent",
                    v.cor === cor && "border-foreground",
                  )}
                  style={{ backgroundColor: cor }}
                />
              ))}
            </div>
          </div>
        );
      })}
      {podeEditar && (canais ?? []).length > 0 && (
        <Button
          className="w-fit"
          onClick={gravar}
          disabled={salvar.isPending || Object.keys(rascunho).length === 0}
        >
          {t("Salvar")}
        </Button>
      )}
    </section>
  );
}
