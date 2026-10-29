"use client";

import { useT } from "@/hooks/i18n/useT";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LinhaDoTempoVisual } from "@/components/timeline/LinhaDoTempoVisual";
import { useTimeline } from "@/hooks/contacts/useTimeline";
import type { TimelineItemView as TimelineItem } from "@/lib/types/contacts";

interface Props {
  contactId: string;
  types?: string[];
}

export function TimelineView({ contactId, types }: Props) {
  const t = useT();
  const q = useTimeline(contactId, types);

  if (q.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (q.isError) {
    return (
      <Card className="p-4">
        <p className="text-sm text-error-fg">{t("Erro ao carregar timeline.")}</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => q.refetch()}>
          {t("Tentar novamente")}
        </Button>
      </Card>
    );
  }

  if (!q.data?.pages.some((p) => p.data.length > 0)) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        {t("Nenhuma atividade registrada ainda.")}
      </Card>
    );
  }

  const todos: TimelineItem[] = q.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div className="min-w-0 space-y-6">
      <LinhaDoTempoVisual itens={todos} />
      {q.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
          >
            {q.isFetchingNextPage ? t("Carregando…") : t("Carregar mais")}
          </Button>
        </div>
      )}
    </div>
  );
}
