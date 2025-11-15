import { Button } from "@/components/ui/button";

interface RegistrationPromptModalProps {
  visible: boolean;
  onRegister: () => void;
  onDismiss: () => void;
  onRemindLater: () => void;
}

export function RegistrationPromptModal({
  visible,
  onRegister,
  onDismiss,
  onRemindLater,
}: RegistrationPromptModalProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(28,19,10,0.45)] px-4 py-8 backdrop-blur-sm">
      <div className="max-w-lg space-y-6 rounded-xl border border-[rgba(255,247,224,0.3)] bg-[rgba(255,252,244,0.96)] px-8 py-6 shadow-2xl">
        <header className="space-y-2 text-center">
          <h2 className="text-xl font-semibold text-ink">Save your progress</h2>
          <p className="text-sm text-ink-soft">
            Create a free account to keep your recipes synced across devices. You can migrate anonymous drafts later.
          </p>
        </header>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={onRegister}>Register now</Button>
          <Button variant="secondary" onClick={onRemindLater}>
            Remind me later
          </Button>
          <Button variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
