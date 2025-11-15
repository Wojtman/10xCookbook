import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type ButtonProps = ComponentProps<typeof Button>;

interface FormSubmitButtonProps extends ButtonProps {
  isLoading?: boolean;
  loadingText?: string;
  loadingIcon?: ReactNode;
}

export function FormSubmitButton({
  isLoading = false,
  loadingText = "Submitting…",
  loadingIcon,
  children,
  disabled,
  ...props
}: FormSubmitButtonProps) {
  const buttonDisabled = disabled ?? isLoading;
  const icon = loadingIcon ?? <Loader2 className="size-4 animate-spin" />;

  return (
    <Button type="submit" disabled={buttonDisabled} aria-disabled={buttonDisabled} {...props}>
      {isLoading ? (
        <>
          {icon}
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
