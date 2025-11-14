import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { FormAlert, type FormAlertTone } from '@/components/auth/FormAlert';
import { FormSubmitButton } from '@/components/auth/FormSubmitButton';
import { PasswordField } from '@/components/auth/PasswordField';
import { cn } from '@/lib/utils';
import { updatePasswordSchema, type UpdatePasswordData } from '@/lib/validation/auth.validator';

interface UpdatePasswordFormProps {
  onSubmit?: (values: UpdatePasswordData) => Promise<void> | void;
  className?: string;
}

type FieldErrors = Partial<Record<keyof UpdatePasswordData, string>>;

interface AlertState {
  tone: FormAlertTone;
  message: string;
  title?: string;
}

export function UpdatePasswordForm({ onSubmit, className }: UpdatePasswordFormProps) {
  const [formData, setFormData] = useState<UpdatePasswordData>({
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordDescription = useMemo(
    () => 'Create a new password with at least 8 characters. Mix letters, numbers, and symbols for strength.',
    []
  );

  const handleFieldChange =
    (field: keyof UpdatePasswordData) => (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setFormData(prev => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: undefined }));
      }
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAlert(null);

    const parsed = updatePasswordSchema.safeParse({
      ...formData,
      confirmPassword: formData.confirmPassword?.trim() ? formData.confirmPassword : undefined,
    });

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
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
          tone: 'success',
          title: 'Password updated',
          message: 'Your password has been changed. We will redirect you to your cookbook shortly.',
        });
      } else {
        setAlert({
          tone: 'info',
          title: 'Password UI Ready',
          message:
            'This screen validates your new password and will connect to Supabase in the next update.',
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update password. Please try again.';
      setAlert({
        tone: 'error',
        title: 'Update failed',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={cn('flex flex-col gap-6', className)} onSubmit={handleSubmit} noValidate>
      {alert ? <FormAlert tone={alert.tone} title={alert.title} message={alert.message} /> : null}

      <FormAlert
        tone="warning"
        title="Security note"
        message="If you reached this page from your email, the reset link has already been verified. Set a new password below."
      />

      <PasswordField
        value={formData.password}
        onChange={handleFieldChange('password')}
        error={errors.password}
        description={passwordDescription}
        autoComplete="new-password"
      />

      <PasswordField
        id="confirm-new-password"
        label="Confirm new password (optional)"
        value={formData.confirmPassword ?? ''}
        onChange={handleFieldChange('confirmPassword')}
        error={errors.confirmPassword}
        showVisibilityToggle={false}
        autoComplete="new-password"
      />

      <div className="space-y-2 text-xs leading-relaxed text-ink-soft">
        <p>Tips for a resilient password:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Avoid passwords you use elsewhere</li>
          <li>Include at least three of: uppercase, lowercase, numbers, symbols</li>
          <li>Consider a memorable phrase rather than a single word</li>
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <FormSubmitButton isLoading={isSubmitting} loadingText="Saving password…">
          Save New Password
        </FormSubmitButton>

        <p className="text-sm text-ink-soft">
          Remembered your login midway?{' '}
          <a
            href="/auth/login"
            className="font-semibold uppercase tracking-[0.18em] text-ink hover:text-ink-muted transition"
          >
            Return to sign in
          </a>
        </p>
      </div>
    </form>
  );
}

