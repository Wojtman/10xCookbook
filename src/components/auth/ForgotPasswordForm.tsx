import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { EmailField } from "@/components/auth/EmailField";
import { FormAlert, type FormAlertTone } from "@/components/auth/FormAlert";
import { FormSubmitButton } from "@/components/auth/FormSubmitButton";
import { cn } from "@/lib/utils";
import { forgotPasswordSchema, type ForgotPasswordData } from "@/lib/validation/auth.validator";

interface ForgotPasswordFormProps {
  initialEmail?: string;
  onSubmit?: (values: ForgotPasswordData) => Promise<void> | void;
  className?: string;
}

type FieldErrors = Partial<Record<keyof ForgotPasswordData, string>>;

interface AlertState {
  tone: FormAlertTone;
  message: string;
  title?: string;
}

export function ForgotPasswordForm({ initialEmail = "", onSubmit, className }: ForgotPasswordFormProps) {
  const [formData, setFormData] = useState<ForgotPasswordData>({ email: initialEmail });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setFormData({ email: value });
    if (errors.email) {
      setErrors({});
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAlert(null);

    const parsed = forgotPasswordSchema.safeParse(formData);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        email: fieldErrors.email?.[0],
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
          title: "Check your inbox",
          message: "If we find an account for that email, a reset link will arrive shortly.",
        });
      } else {
        setAlert({
          tone: "info",
          title: "Email received",
          message: "We will connect this to Supabase soon. Until then the UI demonstrates how recovery will feel.",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send reset email. Please try again.";
      setAlert({
        tone: "error",
        title: "Request failed",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} noValidate>
      {alert ? <FormAlert tone={alert.tone} title={alert.title} message={alert.message} /> : null}

      <EmailField
        label="Email address"
        value={formData.email}
        onChange={handleChange}
        error={errors.email}
        description="Enter the email tied to your cookbook. We will send reset instructions if it exists."
      />

      <div className="flex flex-col gap-3">
        <FormSubmitButton isLoading={isSubmitting} loadingText="Sending email…">
          Email Reset Link
        </FormSubmitButton>

        <p className="text-sm text-ink-soft">
          Remembered your password?{" "}
          <a
            href="/auth/login"
            className="font-semibold uppercase tracking-[0.18em] text-ink hover:text-ink-muted transition"
          >
            Return to sign in
          </a>
        </p>
      </div>

      <p className="text-xs leading-relaxed text-ink-soft">
        For security, we always show the same confirmation message so no one can discover whether an email is
        registered.
      </p>
    </form>
  );
}
