import type { ChangeEvent } from "react";

import { Button } from "@/components/ui/button";

import type { AIParseError, AIParseStatus } from "../types";

interface RawTextSectionProps {
  rawText: string;
  charCount: number;
  maxChars: number;
  parseStatus: AIParseStatus;
  parseError?: AIParseError;
  isParseDisabled?: boolean;
  onRawTextChange: (value: string) => void;
  onParse: () => void;
  onCancelParse: () => void;
}

export function RawTextSection({
  rawText,
  charCount,
  maxChars,
  parseStatus,
  parseError,
  isParseDisabled,
  onRawTextChange,
  onParse,
  onCancelParse,
}: RawTextSectionProps) {
  return (
    <section className="rounded-lg border border-[rgba(72,44,20,0.12)] bg-[rgba(255,254,248,0.82)] p-4 shadow-inner">
      <div className="space-y-2">
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink">
          Raw Recipe Text
          <RawTextArea value={rawText} maxLength={maxChars} onChange={onRawTextChange} charCount={charCount} />
        </label>
        <ParseActionsBar
          status={parseStatus}
          error={parseError}
          disabled={isParseDisabled || charCount === 0}
          onParse={onParse}
          onCancel={onCancelParse}
        />
      </div>
    </section>
  );
}

interface RawTextAreaProps {
  value: string;
  maxLength: number;
  charCount: number;
  onChange: (value: string) => void;
}

function RawTextArea({ value, maxLength, charCount, onChange }: RawTextAreaProps) {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        value={value}
        maxLength={maxLength}
        onChange={handleChange}
        rows={6}
        placeholder="Paste your recipe text here..."
        className="book-input min-h-[140px] resize-y rounded-md border border-[rgba(72,44,20,0.2)] bg-[rgba(255,252,244,0.9)] px-3 py-2.5 text-sm leading-relaxed text-ink shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(248,232,196,0.6)]"
      />
      <span className="self-end text-xs text-ink-soft">
        {charCount.toLocaleString()} / {maxLength.toLocaleString()} characters
      </span>
    </div>
  );
}

interface ParseActionsBarProps {
  status: AIParseStatus;
  error?: AIParseError;
  disabled?: boolean;
  onParse: () => void;
  onCancel: () => void;
}

function ParseActionsBar({ status, error, disabled, onParse, onCancel }: ParseActionsBarProps) {
  const isLoading = status === "loading";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Button size="sm" className="min-w-[140px]" disabled={disabled || isLoading} onClick={onParse}>
          {isLoading ? "Parsing…" : "Parse with AI"}
        </Button>
        {isLoading ? (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs text-[rgba(143,58,32,0.9)]" role="alert">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
