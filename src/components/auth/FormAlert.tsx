import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FormAlertTone = "info" | "success" | "warning" | "error";

const toneClasses: Record<FormAlertTone, string> = {
  info: "border-[rgba(97,64,31,0.35)] bg-[rgba(255,248,227,0.9)] text-ink",
  success: "border-[rgba(72,107,64,0.45)] bg-[rgba(223,241,209,0.88)] text-[rgba(34,70,26,0.95)]",
  warning: "border-[rgba(200,161,93,0.45)] bg-[rgba(255,236,205,0.9)] text-[rgba(94,62,20,0.95)]",
  error: "border-[rgba(143,58,32,0.45)] bg-[rgba(248,220,203,0.92)] text-[rgba(92,32,16,0.95)]",
};

interface FormAlertProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: string;
  tone?: FormAlertTone;
  className?: string;
  children?: ReactNode;
  dataTestId?: string;
}

export function FormAlert({ title, message, tone = "info", className, children, dataTestId, ...rest }: FormAlertProps) {
  const role = tone === "error" ? "alert" : "status";
  const ariaLive = tone === "error" ? "assertive" : "polite";

  return (
    <div
      role={role}
      aria-live={ariaLive}
      data-test-id={dataTestId ?? "form-alert"}
      data-test-tone={tone}
      className={cn(
        "relative w-full overflow-hidden rounded-none border px-4 py-3 text-sm shadow-[0_12px_16px_-14px_rgba(0,0,0,0.55)] backdrop-blur-sm",
        toneClasses[tone],
        className
      )}
      {...rest}
    >
      <div className="flex flex-col gap-1">
        {title ? (
          <span className="text-xs font-semibold uppercase tracking-[0.26em] text-ink-muted">{title}</span>
        ) : null}
        {message ? <p className="leading-relaxed">{message}</p> : null}
        {children}
      </div>
    </div>
  );
}
