import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { AuthApiError } from "@supabase/supabase-js";

import { EmailField } from "@/components/auth/EmailField";
import { FormAlert, type FormAlertTone } from "@/components/auth/FormAlert";
import { FormSubmitButton } from "@/components/auth/FormSubmitButton";
import { PasswordField } from "@/components/auth/PasswordField";
import { cn } from "@/lib/utils";
import { loginSchema, type LoginFormData } from "@/lib/validation/auth.validator";
import { supabaseClient } from "@/db/supabase.client";

interface LoginFormProps {
  initialEmail?: string;
  next?: string | null;
  onSubmit?: (values: LoginFormData & { next?: string | null }) => Promise<void> | void;
  className?: string;
}

type FieldErrors = Partial<Record<keyof LoginFormData, string>>;

interface AlertState {
  tone: FormAlertTone;
  message: string;
  title?: string;
}

export function LoginForm({ initialEmail = "", next, onSubmit, className }: LoginFormProps) {
  const [formData, setFormData] = useState<LoginFormData>({
    email: initialEmail,
    password: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFieldChange = (field: keyof LoginFormData) => (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAlert(null);

    const parsed = loginSchema.safeParse(formData);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      });
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      if (onSubmit) {
        await onSubmit({ ...parsed.data, next: next ?? undefined });
        return;
      }

      const { error } = await supabaseClient.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (error) {
        throw error;
      }

      window.location.assign(next ?? "/recipes");
    } catch (error) {
      const message = resolveLoginErrorMessage(error);
      setAlert({
        tone: "error",
        title: "Sign-in Failed",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} noValidate>
      {alert ? <FormAlert tone={alert.tone} title={alert.title} message={alert.message} /> : null}

      {next ? (
        <FormAlert tone="info" title="Next Step" message="After sign-in we will return you to your previous page." />
      ) : null}

      <EmailField value={formData.email} onChange={handleFieldChange("email")} error={errors.email} />

      <PasswordField
        value={formData.password}
        onChange={handleFieldChange("password")}
        error={errors.password}
        autoComplete="current-password"
      />

      <div className="flex flex-col gap-3">
        <FormSubmitButton isLoading={isSubmitting} loadingText="Signing in…">
          Sign In
        </FormSubmitButton>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
          <a
            href="/auth/forgot-password"
            className="font-semibold uppercase tracking-[0.18em] text-ink hover:text-ink-muted transition"
          >
            Forgot password?
          </a>
          <a
            href="/auth/register"
            className="font-semibold uppercase tracking-[0.18em] text-ink hover:text-ink-muted transition"
          >
            Create account
          </a>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-ink-soft">
        Your credentials are processed securely with Supabase Auth. We will redirect you to your cookbook after a
        successful sign-in.
      </p>
    </form>
  );
}

function resolveLoginErrorMessage(error: unknown): string {
  if (error instanceof AuthApiError) {
    if (error.status === 400 || error.status === 401) {
      return "Invalid email or password";
    }

    if (error.status === 429) {
      return "Too many attempts. Try again later.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to sign in. Please try again.";
}
