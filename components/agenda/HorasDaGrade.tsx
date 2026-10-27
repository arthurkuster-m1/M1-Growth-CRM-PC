"use client";

import { SeletorEmPopup } from "@/components/ui/SeletorEmPopup";
import { useT } from "@/hooks/i18n/useT";
import { JANELA_PADRAO, useJanelaDaGrade } from "@/lib/agenda/janela-da-grade";
import { Button } from "@/components/ui/button";

const hora = (h: number) => `${String(h).padStart(2, "0")}:00`;

/**
 * QUAIS HORAS A GRADE DA AGENDA MOSTRA — uma preferência de quem olha, guardada neste navegador.
 *
 * "De 08:00 até 17:00" desenha só esse trecho; reunião marcada fora dele abre espaço sozinha (só ela),
 * então a noite e a madrugada não ocupam a tela, mas nada marcado fica escondido.
 */
export function HorasDaGrade() {
  const t = useT();
  const [janela, gravar] = useJanelaDaGrade();
  // "Até" é o fim da última linha: 17:00 = a última linha desenhada é a das 16h às 17h.
  const de = janela.primeira;
  const ate = janela.ultima + 1;
  const opcoesDe = Array.from({ length: 24 }, (_, h) => ({ id: String(h), rotulo: hora(h) }));
  const opcoesAte = Array.from({ length: 24 }, (_, i) => i + 1).map((h) => ({
    id: String(h),
    rotulo: h === 24 ? "24:00" : hora(h),
  }));
  const ehPadrao =
    janela.primeira === JANELA_PADRAO.primeira && janela.ultima === JANELA_PADRAO.ultima;

  return (
    <section className="space-y-3 rounded-xl border p-4" data-testid="horas-da-grade">
      <h2 className="font-semibold">{t("Horas que aparecem na grade")}</h2>
      <p className="text-sm text-text-muted">
        {t(
          "Escolha o trecho do dia que a grade da Agenda mostra, por exemplo das 08:00 às 17:00. O que estiver fora dele fica escondido — a não ser que haja um compromisso marcado: aí a grade abre espaço só para ele. Vale neste navegador.",
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <span className="text-xs text-text-muted">{t("Mostrar a partir das")}</span>
          <SeletorEmPopup
            rotulo={t("Mostrar a partir das")}
            valor={String(de)}
            opcoes={opcoesDe}
            aoEscolher={(v) => {
              const novo = Number(v);
              gravar({ primeira: novo, ultima: Math.max(janela.ultima, novo) });
            }}
          />
        </div>
        <div className="grid gap-1">
          <span className="text-xs text-text-muted">{t("Mostrar até as")}</span>
          <SeletorEmPopup
            rotulo={t("Mostrar até as")}
            valor={String(ate)}
            opcoes={opcoesAte}
            aoEscolher={(v) => {
              const fim = Number(v);
              gravar({ primeira: Math.min(janela.primeira, fim - 1), ultima: fim - 1 });
            }}
          />
        </div>
      </div>
      {!ehPadrao ? (
        <Button variant="ghost" size="sm" onClick={() => gravar(JANELA_PADRAO)}>
          {t("Voltar ao padrão (07:00 às 22:00)")}
        </Button>
      ) : null}
    </section>
  );
}
