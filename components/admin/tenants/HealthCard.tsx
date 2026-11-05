"use client";

import type { ReactNode } from "react";
import type { HealthStatus } from "@/app/api/v1/admin/tenants/[id]/health/route";
import { useT } from "@/hooks/i18n/useT";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthCardDetail {
  label: string;
  value: ReactNode;
}

export interface HealthCardProps {
  title: string;
  status: HealthStatus;
  icon: ReactNode;
  primaryValue: ReactNode;
  details?: HealthCardDetail[];
  lastUpdated?: string;
}

// ---------------------------------------------------------------------------
// Status palette
// ---------------------------------------------------------------------------

const STATUS_BORDER: Record<HealthStatus, string> = {
  ok: "border-border",
  warning: "border-warning/40",
  critical: "border-error/50",
};

const STATUS_BADGE_BG: Record<HealthStatus, string> = {
  ok: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  critical: "bg-error-bg text-error-fg",
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  ok: "OK",
  warning: "Atenção",
  critical: "Crítico",
};

const STATUS_DOT: Record<HealthStatus, string> = {
  ok: "bg-success",
  warning: "bg-warning",
  critical: "bg-error",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HealthCard({
  title,
  status,
  icon,
  primaryValue,
  details,
  lastUpdated,
}: HealthCardProps) {
  const t = useT();
  const isCritical = status === "critical";

  return (
    <div
      className={[
        "flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-xs transition-colors",
        STATUS_BORDER[status],
      ].join(" ")}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-text-muted">
          <span className="h-5 w-5 shrink-0" aria-hidden>
            {icon}
          </span>
          <span className="text-xs leading-none font-medium tracking-wide uppercase">{title}</span>
        </div>

        {/* Status badge + pulse */}
        <div className="flex items-center gap-1.5">
          {isCritical && (
            <span className="relative flex h-2 w-2" aria-hidden>
              <span
                className={[
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                  STATUS_DOT[status],
                ].join(" ")}
              />
              <span
                className={["relative inline-flex h-2 w-2 rounded-full", STATUS_DOT[status]].join(
                  " ",
                )}
              />
            </span>
          )}
          <span
            className={[
              "rounded-full px-2 py-0.5 text-xs font-medium",
              STATUS_BADGE_BG[status],
            ].join(" ")}
          >
            {t(STATUS_LABEL[status])}
          </span>
        </div>
      </div>

      {/* Primary value */}
      <div className="text-2xl leading-none font-bold tracking-tight">{primaryValue}</div>

      {/* Details */}
      {details && details.length > 0 && (
        <div className="space-y-1.5 border-t pt-3">
          {details.map((d) => (
            <div key={d.label} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-xs whitespace-nowrap text-text-muted">{d.label}</span>
              <span className="text-right text-xs font-medium">{d.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Last updated */}
      {lastUpdated && <p className="mt-auto text-[11px] text-text-muted">{lastUpdated}</p>}
    </div>
  );
}
