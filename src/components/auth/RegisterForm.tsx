import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

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
          message: "Your registration completed successfully. We will wire up automatic sign-in next.",
        });
      } else {
        setAlert({
          tone: "info",
          title: "Registration UI Ready",
          message:
            "This form validates inputs and prepares the UI. The Supabase sign-up call will be added in the next milestone.",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to complete registration. Please try again.";
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
        Supabase integration ships next; for now this form focuses on the experience and validation rules.
      </p>
    </form>
  );
}
