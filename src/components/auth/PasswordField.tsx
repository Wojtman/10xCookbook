import { forwardRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

export interface PasswordFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
  showVisibilityToggle?: boolean;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  {
    id = "password",
    label = "Password",
    description,
    error,
    showVisibilityToggle = true,
    className,
    type: overrideType,
    autoComplete,
    ...props
  },
  ref
) {
  const [isVisible, setIsVisible] = useState(false);
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  const toggleVisibility = () => {
    if (!showVisibilityToggle) {
      return;
    }
    setIsVisible((prev) => !prev);
  };

  const resolvedType = overrideType ?? (isVisible ? "text" : "password");
  const resolvedAutoComplete = autoComplete ?? "current-password";

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.26em] text-ink-muted">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={resolvedType}
          autoComplete={resolvedAutoComplete}
          className={cn(
            "w-full rounded-none border border-[rgba(97,64,31,0.45)] bg-[rgba(255,245,220,0.92)] px-4 py-3 pr-12 text-base text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none transition focus-visible:ring-2 focus-visible:ring-[rgba(248,232,196,0.7)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(50,28,14,0.45)] placeholder:text-ink-soft",
            error ? "border-[rgba(143,58,32,0.55)] ring-1 ring-[rgba(143,58,32,0.4)]" : "",
            className
          )}
          aria-describedby={describedBy}
          aria-invalid={error ? "true" : undefined}
          {...props}
        />
        {showVisibilityToggle ? (
          <button
            type="button"
            onClick={toggleVisibility}
            className="absolute inset-y-0 right-0 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft transition hover:text-ink"
            aria-label={isVisible ? "Hide password" : "Show password"}
            aria-pressed={isVisible}
          >
            {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            <span>{isVisible ? "Hide" : "Show"}</span>
          </button>
        ) : null}
      </div>
      <div className="space-y-1 text-xs leading-relaxed">
        {description ? (
          <p id={descriptionId} className="text-ink-soft">
            {description}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="text-[rgba(143,58,32,0.92)]">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
});
