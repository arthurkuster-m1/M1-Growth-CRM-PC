"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

type CardProps = HTMLAttributes<HTMLDivElement> & { tone?: "default" | "brand"; flush?: boolean };

export function Card({ tone = "default", flush, className, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        "fi-card",
        tone === "brand" && "fi-card--brand",
        flush && "fi-card--flush",
        className,
      )}
      {...rest}
    />
  );
}

/** Card clicável (tile de app, item de lista): é um <button> de verdade, com foco e teclado. */
export function CardButton({
  className,
  ...rest
}: HTMLAttributes<HTMLButtonElement> & { disabled?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className={cx("fi-card", "fi-card--interactive", className)} {...rest} />
  );
}

export function IconChip({ children }: { children: ReactNode }) {
  return (
    <span className="fi-iconchip" aria-hidden>
      {children}
    </span>
  );
}
