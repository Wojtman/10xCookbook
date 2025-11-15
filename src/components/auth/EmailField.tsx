import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface EmailFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
}

export const EmailField = forwardRef<HTMLInputElement, EmailFieldProps>(function EmailField(
  { id = "email", label = "Email", description, error, className, ...props },
  ref
) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2" data-test-id="email-field">
      <label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-[0.26em] text-ink-muted"
        data-test-id="email-label"
      >
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        type="email"
        inputMode="email"
        autoComplete="email"
        className={cn(
          "w-full rounded-none border border-[rgba(97,64,31,0.45)] bg-[rgba(255,245,220,0.92)] px-4 py-3 text-base text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none transition focus-visible:ring-2 focus-visible:ring-[rgba(248,232,196,0.7)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(50,28,14,0.45)] placeholder:text-ink-soft",
          error ? "border-[rgba(143,58,32,0.55)] ring-1 ring-[rgba(143,58,32,0.4)]" : "",
          className
        )}
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : undefined}
        data-test-id="email-input"
        {...props}
      />
      <div className="space-y-1 text-xs leading-relaxed">
        {description ? (
          <p id={descriptionId} className="text-ink-soft" data-test-id="email-description">
            {description}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="text-[rgba(143,58,32,0.92)]" data-test-id="email-error">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
});
