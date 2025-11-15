/**
 * Placeholder toast host. Will be replaced with a shadcn/ui implementation
 * when toast interactions are wired in later steps.
 */
export function ToastHost() {
  return (
    <div
      id="toast-root"
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-[999] flex flex-col items-center justify-end gap-2 p-4"
    />
  );
}
