"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function AccountForm({ userId, email, displayName }: { userId: string; email: string; displayName: string }) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();

  return (
    <form
      className="surface mt-8 space-y-5 rounded-2xl p-6"
      onSubmit={async (event) => {
        event.preventDefault();
        if (trimmed.length < 2 || trimmed.length > 60) return;
        setSaving(true);
        const { error } = await getBrowserSupabase().from("profiles").update({ display_name: trimmed }).eq("id", userId);
        setSaving(false);
        if (error) toast.error("Spremanje nije uspjelo.");
        else {
          toast.success("Spremljeno.");
          router.refresh();
        }
      }}
    >
      <Field label="E-mail" htmlFor="account-email">
        <Input id="account-email" value={email} disabled />
      </Field>
      <Field
        label="Ime ili nadimak"
        htmlFor="account-name"
        error={trimmed.length > 0 && trimmed.length < 2 ? "Barem 2 znaka." : null}
        hint="Koristi se kao vaš nadimak u načinu vježbe."
      >
        <Input id="account-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button asChild variant="ghost">
          <Link href="/forgot-password">Promijeni lozinku</Link>
        </Button>
        <Button type="submit" loading={saving} disabled={trimmed.length < 2}>
          Spremi
        </Button>
      </div>
    </form>
  );
}
