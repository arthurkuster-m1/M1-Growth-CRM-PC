"use client";

import { useT } from "@/hooks/i18n/useT";

import { Button } from "@/components/ui/button";
import * as React from "react";
import { useRouter } from "next/navigation";

import { ArrowRight, Check, Copy, GoogleLogo } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/** Um passo do guia: número, título e o que fazer. `desligado` = ainda depende dos passos de cima. */
function Passo({
  numero,
  titulo,
  desligado = false,
  children,
}: {
  numero: number;
  titulo: string;
  desligado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
          desligado ? "bg-secondary text-muted-foreground" : "bg-deep text-deep-foreground",
        )}
      >
        {numero}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <h3 className="text-sm font-bold">
          <span className="sr-only">{`Passo ${numero}: `}</span>
          {titulo}
        </h3>
        <div className="mt-1">{children}</div>
      </div>
    </li>
  );
}

/**
 * O cartão da agenda conectada — e o caso que importa é o de quem NÃO tem.
 *
 * `GOOGLE_CALENDAR_CLIENT_ID` e `_SECRET` são opcionais (decisão 3.1), então
 * **100% das instalações novas** chegam aqui sem elas. Isso não é borda: é a
 * primeira tela que todo self-hoster vê.
 *
 * Nesse estado o botão NÃO aparece. E não é o mesmo que aparecer desabilitado:
 *
 *   indisponível  (falta o meio, vai ter)      -> existe, disabled, diz o motivo
 *   sem sentido   (não se aplica aqui)         -> não existe
 *   NÃO INSTALADO (a instalação não tem isso)  -> não existe, E a tela explica
 *
 * A terceira é esta, e ela é diferente das outras duas porque quem lê PODE
 * agir — falta uma chave, e há um lugar onde se põe. Botão desabilitado aqui
 * diria "você não pode", quando o certo é "esta instalação ainda não tem".
 */
export function CartaoDaConexaoGoogle({
  configurado,
  falta,
  contaConectada,
  enderecoDeRetorno,
  linkDeConfiguracao,
  acaoDeSincronizar,
}: {
  configurado: boolean;
  /**
   * Para onde mandar quem PODE resolver — a tela do app OAuth no admin da
   * plataforma. Só vem preenchido para quem administra a INSTALAÇÃO: para o
   * resto, nomear a tela seria oferecer uma porta que dá em `notFound()`.
   */
  linkDeConfiguracao?: string;
  /** O que falta, PELO NOME — para a tela dizer em vez de só esconder o botão. */
  falta: string[];
  contaConectada?: string | null;
  /** O endereço EXATO que o Google exige registrado. Ver o bloco no JSX. */
  enderecoDeRetorno?: string;
  /**
   * O botão "Sincronizar com o Google", que no CELULAR mora aqui, embaixo de "Configurar suas
   * agendas" e "Desconectar" (no computador ele fica no topo). Só aparece abaixo de `sm`.
   */
  acaoDeSincronizar?: React.ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const [desconectando, setDesconectando] = React.useState(false);
  const [copiado, setCopiado] = React.useState(false);

  if (!configurado) {
    const administra = Boolean(linkDeConfiguracao);
    return (
      <div
        data-testid="google-nao-configurado"
        className="rounded-[22px] border border-border bg-card p-5 shadow-xs sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-primary">
            <GoogleLogo size={22} weight="bold" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">
              {t("Sincronizar com o Google ainda não está disponível")}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("Até lá a agenda funciona normalmente, só não troca compromissos com o Google.")}
            </p>
          </div>
        </div>

        {/* O passo a passo: cada passo diz o que fazer e traz o botão que leva até lá. */}
        <ol className="mt-5 grid gap-4">
          <Passo
            numero={1}
            titulo={
              administra
                ? t("Cadastre o aplicativo do Google")
                : t("Peça a quem instalou o sistema")
            }
          >
            {administra ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "Falta cadastrar o aplicativo do Google desta instalação. Leva um minuto e você faz por aqui mesmo.",
                  )}
                </p>
                <Button asChild size="sm" className="mt-3 w-fit rounded-full">
                  <a href={linkDeConfiguracao} data-testid="ir-configurar-google">
                    {t("Cadastrar as credenciais do Google")}
                    <ArrowRight size={14} aria-hidden />
                  </a>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t(
                  "Esta instalação não tem as credenciais do Google cadastradas — não é nada que você tenha feito. Quem instalou o sistema precisa configurar",
                )}
                {falta.length > 0 ? (
                  <>
                    {" "}
                    <span data-testid="o-que-falta" className="font-mono text-[11px]">
                      {falta.join(` ${t("e")} `)}
                    </span>
                  </>
                ) : (
                  ` ${t("as credenciais")}`
                )}
              </p>
            )}
          </Passo>

          {enderecoDeRetorno ? (
            <Passo numero={2} titulo={t("Registre o endereço de retorno no Google")}>
              {/* ⚠️ ESTE BLOCO EXISTE PORQUE A AUSÊNCIA DELE JÁ CUSTOU UMA SESSÃO.
                  O Google compara o endereço de retorno BYTE A BYTE, e recusa com
                  `redirect_uri_mismatch` — um erro que aponta para o Google e não
                  para a divergência. Quem cria a credencial no console registra o
                  endereço do app (`http://.../`) e não o da ROTA, porque nada no
                  produto dizia qual é. Agora diz, e dá para copiar. */}
              <p className="text-sm text-muted-foreground">
                {t("E, no console do Google, registrar este endereço de retorno —")}{" "}
                <span className="font-medium text-foreground">{t("exatamente assim")}</span>:
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code
                  data-testid="endereco-de-retorno"
                  className="min-w-0 rounded-xl bg-secondary px-3 py-2 font-mono text-[11px] break-all text-text select-all"
                >
                  {enderecoDeRetorno}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-full"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(enderecoDeRetorno)
                      .then(() => {
                        setCopiado(true);
                        setTimeout(() => setCopiado(false), 2000);
                      })
                      .catch(() => undefined);
                  }}
                >
                  {copiado ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                  {copiado ? t("Copiado") : t("Copiar endereço")}
                </Button>
              </div>
            </Passo>
          ) : null}

          <Passo
            numero={enderecoDeRetorno ? 3 : 2}
            titulo={t("Conecte sua conta do Google")}
            desligado
          >
            <p className="text-sm text-muted-foreground">
              {t("Quando os passos acima estiverem feitos, o botão Conectar Google aparece aqui.")}
            </p>
            <Button type="button" size="sm" disabled className="mt-3 w-fit rounded-full">
              <GoogleLogo size={14} weight="bold" aria-hidden />
              {t("Conectar Google")}
            </Button>
          </Passo>

          <Passo
            numero={enderecoDeRetorno ? 4 : 3}
            titulo={t("Escolha quais agendas contam")}
            desligado
          >
            <p className="text-sm text-muted-foreground">
              {t(
                "Em Configuração da Agenda › Suas agendas Google, marque quais agendas ocupam seus horários e onde publicar os novos compromissos.",
              )}
            </p>
          </Passo>
        </ol>
      </div>
    );
  }

  if (contaConectada) {
    return (
      <div
        data-testid="google-conectado"
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-4"
      >
        <GoogleLogo size={16} weight="bold" className="shrink-0 text-text-muted" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-sm">
          <span className="text-text-muted">{t("Agenda conectada:")} </span>
          <span className="font-medium">{contaConectada}</span>
        </p>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <a href="/app/settings/tenant/agenda">{t("Configurar suas agendas")}</a>
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="desconectar-google"
          disabled={desconectando}
          onClick={() => {
            setDesconectando(true);
            void fetch("/api/v1/agenda/google/desconectar", { method: "DELETE" })
              .then(async (r) => {
                if (!r.ok) throw new Error(await r.text());
                // `refresh` e não estado local: quem sabe se a conexão saiu é o
                // servidor. Trocar o cartão no cliente repetiria o "Marcado ✓"
                // que esta mesma entrega acabou de pagar.
                router.refresh();
              })
              .catch(() => setDesconectando(false));
          }}
        >
          {desconectando ? t("Desconectando…") : t("Desconectar")}
        </Button>
        {acaoDeSincronizar ? (
          <div className="flex w-full justify-center sm:hidden">{acaoDeSincronizar}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
      <p className="min-w-0 flex-1 text-sm text-text-muted">
        {t(
          "Conecte sua agenda do Google para ver aqui o que já está marcado lá — e enviar para lá o que for marcado aqui.",
        )}
      </p>
      <Button variant="outline" size="sm" data-testid="conectar-google" asChild>
        <a href="/api/v1/agenda/google/connect">
          <GoogleLogo size={16} weight="bold" aria-hidden />
          <span>{t("Conectar Google")}</span>
        </a>
      </Button>
    </div>
  );
}
