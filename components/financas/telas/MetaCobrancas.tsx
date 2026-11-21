"use client";

import { useState } from "react";

import { Link } from "@/components/financas/rota";
import {
  atualizarCobrancasDaMeta,
  useMetaEstado,
  useRecarregarMeta,
  useFinancas,
  type CobrancaMeta,
} from "@/lib/financas/dados";
import { dataBR } from "@/lib/financas/formato";
import { Button, Badge, Card, brl, useToast } from "@/components/financas/kit";
import { Linha } from "./Configuracoes";
import { ArrowsClockwise, CreditCard, WarningCircle } from "@/lib/ui/icons";

const dia = (iso: string) =>
  dataBR(new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }));

/** A faixa vermelha no alto das Finanças: cobrança da Meta recusada ou conta com pagamento pendente. */
export function AvisoDaMeta() {
  const estado = useMetaEstado();
  if (!estado || !estado.disponivel || !estado.alerta) return null;
  const a = estado.alerta;
  return (
    <div className="fi-faixa fi-faixa--erro" role="alert" data-testid="aviso-meta">
      <WarningCircle size={20} weight="fill" aria-hidden />
      <div className="fi-faixa__texto">
        {a.tipo === "recusada" ? (
          <>
            <strong>Cobrança da Meta recusada</strong>A cobrança de {dia(a.em)}
            {a.valor_cents ? ` (${brl(a.valor_cents)})` : ""} não passou no cartão. Atualize a forma
            de pagamento no Meta para os anúncios não pararem.
          </>
        ) : (
          <>
            <strong>Conta de anúncios com pagamento pendente</strong>A Meta não conseguiu cobrar o
            cartão. Regularize o pagamento para os anúncios voltarem.
          </>
        )}
      </div>
      <Link className="fi-btn fi-btn--secondary fi-btn--sm" to="/financas/faturas">
        Ver cobranças
      </Link>
    </div>
  );
}

const ESTADO: Record<CobrancaMeta["estado"], { texto: string; tom: "success" | "error" | "info" }> =
  {
    paga: { texto: "Cobrada", tom: "success" },
    recusada: { texto: "Recusada", tom: "error" },
    estornada: { texto: "Estornada", tom: "info" },
  };

/** Por que a leitura falhou, em português. O código vem de `fin_meta_estado.ultimo_erro`. */
const ERRO: Record<string, string> = {
  sem_conexao: "Conecte a conta de anúncios em Conexões › Meta Ads.",
  cifra_indisponivel: "A chave de criptografia do servidor não está disponível.",
  sem_conta: "Escolha a conta de anúncios padrão em Conexões › Meta Ads.",
  conta_nao_liberada: "Esta conta de anúncios não está liberada para a sua empresa.",
  token_invalido: "A Meta recusou o token. Gere um novo em Conexões › Meta Ads.",
  permissao_insuficiente: "O token não tem permissão para ler as cobranças da conta.",
  app_bloqueado: "A Meta bloqueou o acesso à API deste aplicativo.",
  limite_de_chamadas: "A Meta limitou as chamadas. A leitura tenta de novo na próxima hora.",
  campo_invalido: "A Meta recusou um campo da consulta. Avise quem mantém a instalação.",
  transitorio: "Não consegui falar com a Meta agora. A leitura tenta de novo na próxima hora.",
  erro_ao_gravar: "Não consegui guardar as cobranças. Tente de novo.",
};

/** O painel das cobranças da Meta (na tela de Faturas): o que foi cobrado no cartão e o botão de atualizar. */
export function CobrancasDaMeta() {
  const estado = useMetaEstado();
  const recarregarMeta = useRecarregarMeta();
  const { recarregar, conta } = useFinancas();
  const toast = useToast();
  const [lendo, setLendo] = useState(false);
  if (!estado || !estado.disponivel || !estado.conectado) return null;

  async function atualizar() {
    setLendo(true);
    try {
      const r = await atualizarCobrancasDaMeta();
      toast(
        r.recente
          ? "Já foi atualizado há pouco"
          : `Cobranças lidas: ${r.novas ?? 0} novas, ${r.alteradas ?? 0} alteradas`,
      );
      await recarregarMeta();
      recarregar();
    } catch (e) {
      toast((e as Error).message || "Não foi possível atualizar agora");
    } finally {
      setLendo(false);
    }
  }

  const cartao = conta(estado.cartao_id);
  return (
    <Card data-testid="cobrancas-meta">
      <div className="fi-pilha">
        <div className="fi-row fi-row--between">
          <div>
            <h2 className="t-h3">Cobranças da Meta no cartão</h2>
            <p className="t-body-sm t-muted">
              {cartao
                ? `Lançadas em ${cartao.nome}, com o valor que a Meta cobrou (imposto incluído).`
                : "Escolha qual cartão a Meta cobra para lançar as cobranças."}
            </p>
          </div>
          {cartao ? (
            <Button
              size="sm"
              variant="secondary"
              loading={lendo}
              onClick={() => void atualizar()}
              icon={<ArrowsClockwise size={16} />}
            >
              Atualizar agora
            </Button>
          ) : (
            <Link className="fi-btn fi-btn--primary fi-btn--sm" to="/financas/config?aba=cartoes">
              Escolher o cartão
            </Link>
          )}
        </div>
        {estado.ultimo_erro && (
          <Badge tone="warning">
            <WarningCircle size={14} />
            {ERRO[estado.ultimo_erro] ?? "A última leitura falhou."}
          </Badge>
        )}
        {estado.cobrancas.length === 0 ? (
          <p className="t-body-sm t-muted">
            {estado.ultima_leitura_em
              ? "Nenhuma cobrança da Meta nos últimos 60 dias."
              : "Ainda não houve leitura. Clique em Atualizar agora."}
          </p>
        ) : (
          <ul className="fi-list">
            {estado.cobrancas.slice(0, 12).map((c) => (
              <Linha
                key={c.id}
                icone={<CreditCard size={20} />}
                titulo={dia(c.cobrada_em)}
                sub={c.valor_cents === null ? "valor não informado pela Meta" : c.moeda}
                direita={
                  <>
                    <span className="fi-item__valor">
                      {c.valor_cents === null ? "—" : brl(c.valor_cents)}
                    </span>
                    <Badge tone={ESTADO[c.estado].tom}>{ESTADO[c.estado].texto}</Badge>
                  </>
                }
              />
            ))}
          </ul>
        )}
        {estado.ultima_leitura_em && (
          <p className="t-caption t-muted">
            Última leitura: {dia(estado.ultima_leitura_em)}. A leitura automática roda de hora em
            hora.
          </p>
        )}
      </div>
    </Card>
  );
}
