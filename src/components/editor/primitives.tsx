"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Numeric input that lets people type freely ("-", "3,") and commits valid numbers. */
export function NumberInput({
  value,
  onChange,
  allowNull,
  className,
  ...props
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  allowNull?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [synced, setSynced] = useState(value);
  // Resync the draft text when the value changes from outside (e.g. the slider).
  if (synced !== value) {
    setSynced(value);
    const parsed = Number(text.replace(",", "."));
    if (value === null ? text.trim() !== "" : parsed !== value) setText(value === null ? "" : String(value));
  }
  return (
    <Input
      inputMode="decimal"
      value={text}
      className={cn("tabular-nums", className)}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const normalized = next.replace(",", ".").trim();
        if (normalized === "") {
          if (allowNull) onChange(null);
          return;
        }
        const parsed = Number(normalized);
        if (Number.isFinite(parsed)) onChange(parsed);
      }}
      {...props}
    />
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="font-display text-lg font-bold">{children}</h3>
      {hint && <p className="text-sm text-ink-subtle">{hint}</p>}
    </div>
  );
}

export function LabeledNumber({
  label,
  value,
  onChange,
  allowNull,
  placeholder,
  hint,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  allowNull?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink-muted">
        {label}
      </label>
      <NumberInput id={id} value={value} onChange={onChange} allowNull={allowNull} placeholder={placeholder} />
      {hint && <p className="text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

/** Applies a mutation to a deep copy — keeps editor updates immutable and simple. */
export function produce<T>(value: T, recipe: (draft: T) => void): T {
  const draft = structuredClone(value);
  recipe(draft);
  return draft;
}
