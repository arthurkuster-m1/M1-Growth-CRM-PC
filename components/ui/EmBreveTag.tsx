import { cn } from "@/lib/utils";

/** O selo "Em breve" do menu e dos títulos. */
export function EmBreveTag({
  texto = "Em breve",
  className,
}: {
  texto?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary normal-case",
        className,
      )}
    >
      {texto}
    </span>
  );
}
