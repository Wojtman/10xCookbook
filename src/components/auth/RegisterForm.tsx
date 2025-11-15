import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { AuthApiError } from "@supabase/supabase-js";

import { EmailField } from "@/components/auth/EmailField";
import { FormAlert, type FormAlertTone } from "@/components/auth/FormAlert";
import { FormSubmitButton } from "@/components/auth/FormSubmitButton";
import { PasswordField } from "@/components/auth/PasswordField";
import { cn } from "@/lib/utils";
import { registerSchema, type RegisterFormData } from "@/lib/validation/auth.validator";

interface RegisterFormProps {
  initialEmail?: string;
  onSubmit?: (values: RegisterFormData) => Promise<void> | void;
  className?: string;
  confirmLabel?: string;
}

type FieldErrors = Partial<Record<keyof RegisterFormData, string>>;

interface AlertState {
  tone: FormAlertTone;
  message: string;
  title?: string;
}

export function RegisterForm({
  initialEmail = "",
  onSubmit,
  className,
  confirmLabel = "Confirm password (optional)",
}: RegisterFormProps) {
  const [formData, setFormData] = useState<RegisterFormData>({
    email: initialEmail,
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordDescription = useMemo(
    () => "Minimum 8 characters. Mixing uppercase, lowercase, numbers, and symbols is recommended.",
    []
  );

  const handleFieldChange = (field: keyof RegisterFormData) => (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAlert(null);

    const parsed = registerSchema.safeParse({
      ...formData,
      confirmPassword: formData.confirmPassword?.trim() ? formData.confirmPassword : undefined,
    });

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
        confirmPassword: fieldErrors.confirmPassword?.[0],
      });
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      if (onSubmit) {
        await onSubmit(parsed.data);
        setAlert({
          tone: "success",
          title: "Account created",
          message:
            "We just emailed you a confirmation link—please verify your address to finish setting up your account.",
        });
        return;
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: parsed.data.email,
          password: parsed.data.password,
        }),
      });

      if (!response.ok) {
        const body = await safeParseJson<{ error?: string }>(response);
        const message = body?.error ?? "Unable to complete registration";
        throw new AuthApiError(message, response.status, response.statusText);
      }

      setFormData((prev) => ({ ...prev, password: "", confirmPassword: "" }));
      setAlert({
        tone: "success",
        title: "Check your inbox",
        message:
          "We just sent a confirmation email. Open the link to activate your account, then you can sign in right away.",
      });
    } catch (error) {
      const message = resolveRegisterErrorMessage(error);
      setAlert({
        tone: "error",
        title: "Registration Failed",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} noValidate>
      {alert ? <FormAlert tone={alert.tone} title={alert.title} message={alert.message} /> : null}

      <EmailField value={formData.email} onChange={handleFieldChange("email")} error={errors.email} />

      <PasswordField
        value={formData.password}
        onChange={handleFieldChange("password")}
        error={errors.password}
        description={passwordDescription}
        autoComplete="new-password"
      />

      <PasswordField
        id="confirm-password"
        label={confirmLabel}
        value={formData.confirmPassword ?? ""}
        onChange={handleFieldChange("confirmPassword")}
        error={errors.confirmPassword}
        showVisibilityToggle={false}
        autoComplete="new-password"
      />

      <div className="space-y-2 text-xs leading-relaxed text-ink-soft">
        <p>A strong password uses at least three of the following:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Lowercase and uppercase letters</li>
          <li>Numbers</li>
          <li>Symbols</li>
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <FormSubmitButton isLoading={isSubmitting} loadingText="Creating account…">
          Create Account
        </FormSubmitButton>
        <p className="text-sm text-ink-soft">
          Already have an account?{" "}
          <a
            href="/auth/login"
            className="font-semibold uppercase tracking-[0.18em] text-ink hover:text-ink-muted transition"
          >
            Sign in
          </a>
        </p>
      </div>

      <p className="text-xs leading-relaxed text-ink-soft">
        Supabase sends a confirmation email after you create an account. Follow the link in your inbox before signing
        in.
      </p>
    </form>
  );
}

async function safeParseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function resolveRegisterErrorMessage(error: unknown): string {
  if (error instanceof AuthApiError) {
    if (error.status === 429) {
      return "Too many attempts. Try again later.";
    }

    if (error.status === 400 && error.message?.toLowerCase().includes("already registered")) {
      return "An account with this email already exists. Try signing in instead.";
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to complete registration. Please try again.";
}
