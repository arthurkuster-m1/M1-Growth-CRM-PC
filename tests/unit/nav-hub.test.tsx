/**
 * O hub é a vitrine de um grupo: mostra TUDO que ele tem, com descrição,
 * organizado pela jornada de quem usa. É onde as sete telas que só existiam
 * atrás das abas de IA passam a ser descobertas.
 *
 * A permissão é do registro (`navegacao-registry.test.ts`); aqui é o desenho.
 */
import { vi, afterEach, describe, expect, it } from "vitest";

// Estes testes cobrem o hub COM a área de IA ligada; a suspensão tem teste próprio (lib/navigation/suspensao.test.ts).
vi.hoisted(() => {
  process.env.M1_IA_SUSPENSA = "false";
});
import { cleanup, render, screen, within } from "@testing-library/react";

import { OrientacoesInstaladas } from "@/components/extensions/OrientacoesInstaladas";
import { NavHub } from "@/components/shell/NavHub";
import { DICIONARIO } from "@/lib/i18n/dicionario";
import type { ExtensionGuideView } from "@/lib/extensions/view";
import { hubSections } from "@/lib/navigation/registry";

afterEach(cleanup);

describe("NavHub", () => {
  const extensionGuide: ExtensionGuideView = {
    organization_id: "00000000-0000-4000-8000-000000000001",
    installation_id: "00000000-0000-4000-8000-000000000002",
    version: "1.0.0",
    revision: 3,
    configuration: { density: "compact", show_description: false },
    manifest: {
      format_version: 1,
      profile: "declarative",
      publisher: "equipe-exemplo",
      name: "rotina-comercial",
      version: "1.0.0",
      license: "MIT",
      host_api: { min: 1, max: 2 },
      permissions: ["navigation.tasks"],
      dependencies: [],
      data: { mode: "none" },
      display: {
        title: { "pt-BR": "Rotina comercial", es: "Rutina comercial" },
        summary: { "pt-BR": "Organize os próximos passos." },
        category: "sales",
        icon: "ListChecks",
      },
      configuration: { density: "comfortable", show_description: true },
      contributions: {
        crm_cards: [
          {
            id: "primeiro-passo",
            title: { "pt-BR": "Comece por aqui", es: "Empieza aquí" },
            description: { "pt-BR": "Uma descrição que a configuração esconde." },
            icon: "Lightbulb",
            blocks: [],
            action: { label: { "pt-BR": "Abrir tarefas" }, capability: "tasks.open" },
          },
        ],
      },
    },
  };

  it("apresenta a IA nas três etapas da jornada, na ordem", () => {
    render(
      <NavHub
        modulosLigados={[]}
        group="ia"
        isPlatformAdmin
        role={null}
        title="Agente de IA"
        subtitle=""
      />,
    );
    const secoes = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent?.trim());
    expect(secoes).toEqual(["Montar o agente", "Ensinar o agente", "Acompanhar o agente"]);
  });

  it("desenterra Conhecimento, que só existia atrás das abas", () => {
    render(
      <NavHub
        modulosLigados={[]}
        group="ia"
        isPlatformAdmin
        role={null}
        title="Agente de IA"
        subtitle=""
      />,
    );
    const link = screen.getByRole("link", { name: /Conhecimento/ });
    expect(link).toHaveAttribute("href", "/app/ai/knowledge/sources");
  });

  it("cada card explica para que serve — é o que o sidebar não cabe dizer", () => {
    render(
      <NavHub
        modulosLigados={[]}
        group="ia"
        isPlatformAdmin
        role={null}
        title="Agente de IA"
        subtitle=""
      />,
    );
    const link = screen.getByRole("link", { name: /Conhecimento/ });
    expect(link.textContent).toMatch(/consulta antes de responder/i);
  });

  it("mostra também o que já está no sidebar — é inventário, não sobra", () => {
    render(
      <NavHub
        modulosLigados={[]}
        group="ia"
        isPlatformAdmin
        role={null}
        title="Agente de IA"
        subtitle=""
      />,
    );
    expect(screen.getByRole("link", { name: /Agentes/ })).toBeTruthy();
  });

  it("o viewer vê Extensões e Dados externos; a seção aparece filtrada, sem API Tokens nem LGPD", () => {
    /**
     * Esta asserção dizia `not.toContain("Dados e acesso")`, e passava porque os
     * DOIS destinos daquela seção eram `admin`. "Dados externos" entrou nela sem
     * `minRole` (o banco externo é lido por qualquer autenticado — decisão do
     * dono no #1130), e a seção passou a existir para o `viewer`.
     *
     * O que se quer provar continua sendo a filtragem por papel, e ela fica mais
     * forte aqui do que na forma antiga: a seção RENDERIZA e ainda assim os dois
     * destinos de `admin` não estão nela. Sumir a seção inteira é caso de
     * `tests/unit/navegacao-registry.test.ts`, onde a propriedade é afirmada
     * sobre todo grupo e todo papel, em vez de sobre uma seção nomeada.
     */
    render(
      <NavHub
        modulosLigados={["banco_externo"]}
        group="organizacao"
        isPlatformAdmin={false}
        role="viewer"
        title="Org"
        subtitle=""
      />,
    );
    const secoes = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent?.trim());
    expect(secoes).toContain("Sua conta");
    expect(secoes).toContain("Sua empresa");
    expect(secoes).toContain("Dados e acesso");
    expect(screen.getByRole("link", { name: /Extensões/ })).toHaveAttribute(
      "href",
      "/app/extensions",
    );
    expect(screen.getByRole("link", { name: /Dados externos/ })).toHaveAttribute(
      "href",
      "/app/integracao-dados",
    );
    expect(screen.queryByRole("link", { name: /API Tokens/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /LGPD/ })).toBeNull();
  });

  it("a porta do banco externo só existe com o módulo ligado na instalação (doc 37)", () => {
    // Desligado: some para TODO papel, inclusive o admin da empresa — quem liga
    // é quem administra o servidor. Para o viewer, a seção inteira some junto,
    // porque "Dados externos" era a única porta dela ao alcance dele.
    render(
      <NavHub
        group="organizacao"
        isPlatformAdmin={false}
        role="admin"
        title="Org"
        subtitle=""
        modulosLigados={[]}
      />,
    );
    expect(screen.queryByRole("link", { name: /Dados externos/ })).toBeNull();
    expect(screen.getByRole("link", { name: /API Tokens/ })).toBeTruthy();
    cleanup();

    render(
      <NavHub
        group="organizacao"
        isPlatformAdmin={false}
        role="viewer"
        title="Org"
        subtitle=""
        modulosLigados={[]}
      />,
    );
    const secoes = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent?.trim());
    expect(secoes).not.toContain("Dados e acesso");
    cleanup();

    render(
      <NavHub
        group="organizacao"
        isPlatformAdmin={false}
        role="viewer"
        title="Org"
        subtitle=""
        modulosLigados={["banco_externo"]}
      />,
    );
    expect(screen.getByRole("link", { name: /Dados externos/ })).toHaveAttribute(
      "href",
      "/app/integracao-dados",
    );
  });

  it("agrupa os cards sob a própria seção, não numa lista solta", () => {
    render(
      <NavHub
        modulosLigados={[]}
        group="ia"
        isPlatformAdmin
        role={null}
        title="Agente de IA"
        subtitle=""
      />,
    );
    const ensinar = screen.getByRole("region", { name: "Ensinar o agente" });
    expect(within(ensinar).getByRole("link", { name: /Memória/ })).toBeTruthy();
    expect(within(ensinar).queryByRole("link", { name: /Credenciais/ })).toBeNull();
  });

  it("expõe falha de leitura das contribuições instaladas, sem derrubar a página de Extensões", () => {
    render(<OrientacoesInstaladas extensionGuides={[]} extensionsUnavailable />);

    expect(
      screen.getByRole("heading", { name: "Não foi possível conferir as orientações instaladas" }),
    ).toBeInTheDocument();
  });

  it("mostra o cartão que a extensão contribui, e nada quando não há extensão", () => {
    render(
      <OrientacoesInstaladas extensionGuides={[extensionGuide]} extensionsUnavailable={false} />,
    );
    expect(
      screen.getByTestId(`extension-contribution-${extensionGuide.installation_id}-primeiro-passo`),
    ).toHaveAttribute(
      "href",
      `/app/extensions/${extensionGuide.installation_id}?card=primeiro-passo`,
    );
    cleanup();

    const { container } = render(
      <OrientacoesInstaladas extensionGuides={[]} extensionsUnavailable={false} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
