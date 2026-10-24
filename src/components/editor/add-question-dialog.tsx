"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { QuestionTypeIcon } from "@/components/quiz/question-type-icon";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { QUESTION_TYPE_META } from "@/lib/domain/question-defaults";
import { QUESTION_TYPES, type QuestionType } from "@/lib/domain/schema";

export function AddQuestionDialog({
  onAdd,
  disabled,
  triggerProps,
  label = "Dodaj pitanje",
}: {
  onAdd: (type: QuestionType) => void;
  disabled?: boolean;
  triggerProps?: ButtonProps;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled} {...triggerProps}>
          <Plus /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent title="Koju vrstu pitanja dodajemo?" description="Svaka vrsta ima vlastiti uređivač i način igre." className="max-w-3xl">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUESTION_TYPES.map((type) => (
            <li key={type}>
              <button
                type="button"
                onClick={() => {
                  onAdd(type);
                  setOpen(false);
                }}
                className="flex h-full w-full gap-3 rounded-xl bg-night-950/50 p-4 text-left ring-1 ring-white/8 transition-all hover:-translate-y-0.5 hover:bg-night-700 hover:ring-white/20"
              >
                <QuestionTypeIcon type={type} />
                <span>
                  <span className="block font-display font-bold">{QUESTION_TYPE_META[type].label}</span>
                  <span className="mt-0.5 block text-sm text-ink-subtle">{QUESTION_TYPE_META[type].description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
