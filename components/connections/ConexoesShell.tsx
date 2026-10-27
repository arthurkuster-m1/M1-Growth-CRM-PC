"use client";
import { useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { RedesSociaisClient } from "./RedesSociaisClient";
import { CanalGraphParceiroClient } from "./CanalGraphParceiroClient";
import { CanalOficialClient } from "./CanalOficialClient";
import { ConnectionsClient } from "./ConnectionsClient";
import { TemplatesClient } from "./TemplatesClient";
import { TemplatesParceiroClient } from "./TemplatesParceiroClient";
import { WebhooksClient } from "@/app/app/webhooks/_components/WebhooksClient";
import { useT } from "@/hooks/i18n/useT";
import { rotaDeTemplates } from "@/lib/channels/templates-fonte";

/**
 * Conexões — TODOS os canais em um lugar só.
 *
 * ─── Por que isto existe ────────────────────────────────────────────────────
 * Conectar o número por QR ficava aqui; conectar o número OFICIAL ficava em
 * Configurações; os templates, que só existem por causa do canal oficial, ficavam
 * numa terceira tela. Três lugares para uma coisa só — e o usuário precisava saber
 * de antemão que a resposta para "conectar meu WhatsApp" dependia de QUAL WhatsApp.
 *
 * A pergunta que a tela responde é "por onde meu negócio fala com o cliente". A
 * resposta é uma lista de canais, não um mapa do nosso código: quem instala não
 * sabe (nem deve saber) que um passa por QR e o outro por credencial da Meta.
 *
 * Templates entram como sub-aba do canal oficial, e não como item de topo, porque
 * eles NÃO existem fora dele: num canal por QR não há template a aprovar. Promovê-los
 * a item de primeiro nível sugeriria uma escolha que não existe.
 *
 * ─── A aba vive na URL ──────────────────────────────────────────────────────
 * `?aba=` e `?sub=` em vez de estado só em memória: as rotas antigas
 * (`/app/settings/canal-oficial`, `/app/settings/templates`) redirecionam para cá
 * apontando a aba certa, e um link colado no chat abre onde deveria. Aba que só
 * existe em `useState` transforma todo link salvo em "abre e procura de novo".
 */
export function ConexoesShell({
  wahaConfigured,
  graphParceiro = null,
}: {
  wahaConfigured: boolean;
  /**
   * O canal parceiro que espelha a Cloud API (recorte do #1130) é OPCIONAL DA
   * INSTALAÇÃO e nasce desligado (decisão do dono, doc 54). `null` = a
   * instalação não o liga, e a aba nem é montada — nem por `?aba=` na URL.
   * O rótulo vem do servidor porque a tela não pode nomear provider.
   */
  graphParceiro?: { label: string } | null;
}) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const abaParam = params.get("aba");
  // Chamada de voz, Telefone e Provedor parceiro saíram da tela por enquanto; o endereço antigo
  // (?aba=voz|telefonia|parceiro) cai em Números por QR.
  const aba =
    abaParam === "sociais"
      ? "sociais"
      : abaParam === "oficial"
        ? "oficial"
        : abaParam === "webhooks"
          ? "webhooks"
          : abaParam === "graph" && graphParceiro
            ? "graph"
            : "numeros";
  const sub = params.get("sub") === "templates" ? "templates" : "conexao";

  const irPara = (proximaAba: string, proximaSub?: string): void => {
    const q = new URLSearchParams();
    if (proximaAba !== "numeros") q.set("aba", proximaAba);
    if (proximaSub && proximaSub !== "conexao") q.set("sub", proximaSub);
    const qs = q.toString();
    // `scroll: false`: trocar de aba não é navegar para outra página; jogar o
    // usuário para o topo a cada clique faz a tela parecer que recarregou.
    router.replace(qs ? `/app/connections?${qs}` : "/app/connections", { scroll: false });
  };

  return (
    <Tabs value={aba} onValueChange={(v) => irPara(v, sub)} className="flex flex-col gap-4">
      {/* Uma fila só, que rola na horizontal no celular: abas que quebram em várias linhas
          viravam um bloco confuso. Rótulos nunca quebram (whitespace-nowrap no gatilho). */}
      <TabsList className="h-11 w-full justify-start gap-1 sm:w-auto">
        <TabsTrigger value="numeros">{t("Números por QR")}</TabsTrigger>
        <TabsTrigger value="oficial">{t("API Oficial (Meta)")}</TabsTrigger>
        <TabsTrigger value="sociais">{t("Redes sociais")}</TabsTrigger>
        {graphParceiro && <TabsTrigger value="graph">{graphParceiro.label}</TabsTrigger>}
        <TabsTrigger value="webhooks">{t("Webhooks")}</TabsTrigger>
      </TabsList>

      <TabsContent value="webhooks" className="mt-0">
        {/* Webhooks era página própria (/app/webhooks); agora é mais uma conexão. */}
        <p className="mb-3 text-sm text-muted-foreground">
          {t("Receba contatos de fora (landing pages, formulários) e crie automações que agem sozinhas.")}
        </p>
        <WebhooksClient />
      </TabsContent>

      <TabsContent value="numeros" className="mt-0">
        <ConnectionsClient wahaConfigured={wahaConfigured} />
      </TabsContent>


      <TabsContent value="sociais" className="mt-0"><RedesSociaisClient /></TabsContent>


      {graphParceiro && (
        <TabsContent value="graph" className="mt-0">
          {/* Sub-abas como nas demais: conectar e gerenciar modelos são tarefas
              diferentes. O componente de modelos é o MESMO do outro parceiro,
              apontado para a rota desta fonte. */}
          <Tabs value={sub} onValueChange={(v) => irPara("graph", v)} className="flex flex-col gap-4">
            <TabsList>
              <TabsTrigger value="conexao">{t("Conexão")}</TabsTrigger>
              <TabsTrigger value="templates">{t("Modelos")}</TabsTrigger>
            </TabsList>
            <TabsContent value="conexao" className="mt-0">
              <CanalGraphParceiroClient />
            </TabsContent>
            <TabsContent value="templates" className="mt-0">
              {/* Editar e apagar valem aqui como no outro parceiro: desde a
                  #1734 o alvo resolve o id da variante (nome + idioma) antes de
                  falar com a plataforma, então a tela apaga UMA tradução, não
                  todas (#1728 era este o motivo de ficar desligado). */}
              <TemplatesParceiroClient rota={rotaDeTemplates("graph")} />
            </TabsContent>
          </Tabs>
        </TabsContent>
      )}

      <TabsContent value="oficial" className="mt-0">
        <Tabs value={sub} onValueChange={(v) => irPara("oficial", v)} className="flex flex-col gap-4">
          <TabsList>
            <TabsTrigger value="conexao">{t("Conexão")}</TabsTrigger>
            {/* "Templates da Meta", não "Templates": a barra lateral já tem um item
                com esse nome que significa OUTRA coisa — respostas rápidas salvas
                pelo atendente (`/app/templates`). Dois conceitos com o mesmo rótulo
                fazem o operador clicar no errado e concluir que a tela está quebrada.
                A colisão é anterior a esta mudança; o que dá para fazer aqui é não
                agravá-la. */}
            <TabsTrigger value="templates">{t("Templates da Meta")}</TabsTrigger>
          </TabsList>
          <TabsContent value="conexao" className="mt-0">
            <CanalOficialClient />
          </TabsContent>
          <TabsContent value="templates" className="mt-0">
            <TemplatesClient />
          </TabsContent>
        </Tabs>
      </TabsContent>
    </Tabs>
  );
}
