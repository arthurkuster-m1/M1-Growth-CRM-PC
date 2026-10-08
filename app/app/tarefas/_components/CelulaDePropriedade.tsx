"use client";

import { CelulaDeCaixa } from "@/components/motor/CelulaDeCaixa";
import { CelulaDeDia } from "@/components/motor/CelulaDeDia";
import { CelulaDeTexto } from "@/components/motor/CelulaDeTexto";
import { EditorDeOpcoesDePropriedade } from "@/components/motor/EditorDeOpcoesDePropriedade";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { SeletorDeOpcao } from "@/components/motor/SeletorDeOpcao";
import { SeletorMultiplo } from "@/components/motor/SeletorMultiplo";
import { useT } from "@/hooks/i18n/useT";
import type {
  OpcaoDePropriedade,
  PropriedadeDaTarefa,
  ValorDePropriedade,
} from "@/lib/tarefas/propriedades";
import { LinkSimple } from "@/lib/ui/icons";

interface Props {
  propriedade: PropriedadeDaTarefa;
  /** O valor guardado na tarefa (`custom_fields[propriedade.id]`), ou `undefined`. */
  valor: unknown;
  podeEditar: boolean;
  /** `manager` ou acima: edita as opções de uma propriedade de seleção. */
  podeConfigurar: boolean;
  tag: string;
  /** `null` limpa o valor. */
  aoSalvar: (valor: ValorDePropriedade | null) => void;
  aoMudarOpcoes: (opcoes: OpcaoDePropriedade[]) => void;
}

/** "12,5" e "12.5" valem o mesmo; `NaN` vira `undefined` (o texto não era um número). */
function lerNumero(texto: string): number | undefined {
  const n = Number(texto.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/** A célula de UMA propriedade personalizada: escolhe o desenho pelo TIPO. */
export function CelulaDePropriedade({
  propriedade,
  valor,
  podeEditar,
  podeConfigurar,
  tag,
  aoSalvar,
  aoMudarOpcoes,
}: Props) {
  const t = useT();
  const rotulo = propriedade.name;
  const opcoes = propriedade.options.map((o) => ({ id: o.id, rotulo: o.name, cor: o.color }));
  const renderizarEditor = podeConfigurar
    ? (voltar: () => void) => (
        <EditorDeOpcoesDePropriedade
          opcoes={propriedade.options}
          aoMudar={aoMudarOpcoes}
          voltar={voltar}
        />
      )
    : undefined;

  switch (propriedade.type) {
    case "text":
      return (
        <CelulaDeTexto
          valor={typeof valor === "string" ? valor : ""}
          rotulo={rotulo}
          vazioRotulo={t("Vazio")}
          permitirVazio
          podeEditar={podeEditar}
          aoSalvar={(texto) => aoSalvar(texto || null)}
        />
      );

    case "number": {
      const numero = typeof valor === "number" ? valor : undefined;
      return (
        <CelulaDeTexto
          valor={numero === undefined ? "" : String(numero)}
          exibir={numero === undefined ? undefined : new Intl.NumberFormat(tag).format(numero)}
          inputMode="decimal"
          rotulo={rotulo}
          vazioRotulo={t("Vazio")}
          permitirVazio
          podeEditar={podeEditar}
          aoSalvar={(texto) => {
            if (texto === "") return aoSalvar(null);
            const lido = lerNumero(texto);
            // Texto que não é número não vira valor: a célula volta ao anterior.
            if (lido !== undefined) aoSalvar(lido);
          }}
        />
      );
    }

    case "url": {
      const link = typeof valor === "string" ? valor : "";
      return (
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <CelulaDeTexto
              valor={link}
              inputMode="url"
              rotulo={rotulo}
              vazioRotulo={t("Vazio")}
              permitirVazio
              podeEditar={podeEditar}
              aoSalvar={(texto) => aoSalvar(texto || null)}
            />
          </div>
          {/^https?:\/\//i.test(link) ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("Abrir link")}
              title={t("Abrir link")}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary"
            >
              <LinkSimple size={14} aria-hidden />
            </a>
          ) : null}
        </div>
      );
    }

    case "select": {
      const atual = opcoes.find((o) => o.id === valor);
      return (
        <SeletorDeOpcao
          opcoes={opcoes}
          valorId={atual?.id}
          podeEditar={podeEditar}
          rotulo={rotulo}
          aoEscolher={(id) => aoSalvar(id)}
          aoLimpar={() => aoSalvar(null)}
          renderizarEditor={renderizarEditor}
        >
          {atual ? (
            <Etiqueta cor={atual.cor}>{atual.rotulo}</Etiqueta>
          ) : (
            <span className="text-sm text-text-subtle">{t("Vazio")}</span>
          )}
        </SeletorDeOpcao>
      );
    }

    case "multi_select":
      return (
        <SeletorMultiplo
          opcoes={opcoes}
          valorIds={
            Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : []
          }
          podeEditar={podeEditar}
          rotulo={rotulo}
          aoMudar={(ids) => aoSalvar(ids.length ? ids : null)}
          renderizarEditor={renderizarEditor}
        />
      );

    case "date":
      return (
        <CelulaDeDia
          valor={typeof valor === "string" ? valor : null}
          tag={tag}
          podeEditar={podeEditar}
          rotulo={rotulo}
          aoSalvar={(dia) => aoSalvar(dia)}
        />
      );

    case "checkbox":
      return (
        <CelulaDeCaixa
          marcada={valor === true}
          podeEditar={podeEditar}
          rotulo={rotulo}
          aoMudar={(marcada) => aoSalvar(marcada)}
        />
      );
  }
}
