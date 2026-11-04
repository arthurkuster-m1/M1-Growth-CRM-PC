"use client";
import type { ReactNode } from "react";
import { SeletorDeClientes, type OpcaoDeCliente } from "@/components/agencia/SeletorDeClientes";
import { BarraDeProgressoNavegacao } from "@/components/shell/BarraDeProgressoNavegacao";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { TooltipProvider } from "@/components/ui/tooltip";

interface AdminShellProps {
  /** O estado "recolhido" do menu, lido do cookie no servidor (sem piscar). */
  sidebarCollapsed: boolean;
  /** Os clientes que a pessoa pode ver (a mesma lista do Modo agência). Vazia = sem seletor. */
  clientes?: readonly OpcaoDeCliente[];
  /** Os escolhidos no seletor; vazio = todos. */
  selecionados?: readonly string[];
  children: ReactNode;
}

/**
 * A casca de /admin/*. Desde 04/11/2026 ela é a MESMA do app: o menu lateral (`Sidebar`, que no
 * Modo agência mostra Campanhas, Cronograma… e o grupo Plataforma) e a barra de cima (`TopBar`, com
 * o seletor de empresa, a busca, os avisos e o menu da pessoa — tema incluído). O painel de
 * plataforma e o Modo agência são uma visão só: trocar de uma tela da agência para uma do painel
 * não muda nada em volta. O seletor de empresas do Modo agência também aparece no topo de cada tela. As URLs seguem separadas (`/admin` e `/app/agencia`), e é a casca igual
 * que faz isso não aparecer para quem usa.
 *
 * O `AuthProvider` que `Sidebar` e `TopBar` leem é montado em `app/admin/(protected)/layout.tsx`.
 *
 * ── Por que o `TooltipProvider` mora AQUI, e não em cada componente ─────────────────────────────
 *
 * O Radix exige um Provider ANCESTRAL de todo `Tooltip`: sem ele o componente lança "`Tooltip` must
 * be used within `TooltipProvider`" no cliente, e o React derruba a árvore inteira — a tela vira a
 * página de erro do Next, não um tooltip quebrado. O dono vê "Algo deu errado" e um ID opaco
 * (`app/error.tsx`), e no servidor não há rastro, porque o erro é do cliente.
 *
 * Quem é atingido: o `TenantBadge`, montado em /admin/inbox, /admin/inbox/[conversationId],
 * /admin/lgpd e /admin/lgpd/requests/[id]. A quebra é CONDICIONAL A DADO (os mounts estão atrás de
 * guarda de organização resolvida), então uma instalação sem conversas abre as telas mesmo com o
 * defeito. O que este Provider NÃO conserta: /admin/usage — os gráficos importam o `Tooltip` do
 * **recharts**, que não usa Provider (o nome colide, a origem não). Um Provider na casca cobre as
 * telas de uma vez e faz tela nova nascer funcionando.
 */
export function AdminShell({
  sidebarCollapsed,
  clientes = [],
  selecionados = [],
  children,
}: AdminShellProps) {
  return (
    <TooltipProvider>
      <div className="flex min-h-dvh w-full bg-background">
        <BarraDeProgressoNavegacao />
        <div className="hidden md:block">
          <Sidebar collapsed={sidebarCollapsed} />
        </div>
        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <TopBar />
          {/* `overflow-x-hidden` como rede de segurança — mesmo motivo do `AppShell`: se algo
              estourar a largura, a PÁGINA não rola de lado; quem precisa de scroll horizontal é o
              componente específico, contido nele mesmo. */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 pb-area-segura sm:p-6">
            {/* O MESMO seletor de empresas do Modo agência (a escolha é uma só, vale nas duas áreas). */}
            {clientes.length > 0 ? (
              <div className="mb-4 flex justify-end">
                <SeletorDeClientes clientes={clientes} selecionados={selecionados} />
              </div>
            ) : null}
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
