"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { safeNextPath } from "@/lib/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";

const email = z.email("Upišite ispravnu e-mail adresu.");
const password = z.string().min(8, "Lozinka treba barem 8 znakova.").max(72, "Lozinka je predugačka.");

/** Maps Supabase Auth errors to friendly Croatian messages. */
function authMessage(error: { message: string; code?: string }): string {
  const code = error.code ?? "";
  if (code === "invalid_credentials" || /invalid login/i.test(error.message)) return "Pogrešan e-mail ili lozinka.";
  if (code === "email_not_confirmed") return "Potvrdite e-mail adresu putem poveznice koju smo poslali.";
  if (code === "user_already_exists" || /already registered/i.test(error.message)) return "Račun s tom adresom već postoji.";
  if (code === "weak_password") return "Lozinka je preslaba. Odaberite dužu ili složeniju.";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit") return "Previše pokušaja. Pričekajte malo pa pokušajte ponovno.";
  if (code === "same_password") return "Nova lozinka mora se razlikovati od stare.";
  return "Nešto je pošlo po zlu. Pokušajte ponovno.";
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-coral-500/15 px-3.5 py-2.5 text-sm font-semibold text-coral-400">
      {message}
    </p>
  );
}

function redirectUrl(path: string) {
  return `${window.location.origin}${path}`;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [error, setError] = useState<string | null>(params.get("error") === "link" ? "Poveznica je nevažeća ili je istekla." : null);
  const form = useForm({ resolver: zodResolver(z.object({ email, password: z.string().min(1, "Upišite lozinku.") })) });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const { error: signInError } = await getBrowserSupabase().auth.signInWithPassword(values);
    if (signInError) return setError(authMessage(signInError));
    router.replace(next);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <Field label="E-mail" htmlFor="email" error={form.formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} aria-invalid={!!form.formState.errors.email} />
      </Field>
      <Field label="Lozinka" htmlFor="password" error={form.formState.errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} aria-invalid={!!form.formState.errors.password} />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-semibold text-cyan-300 hover:underline">
          Zaboravili ste lozinku?
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
        Prijavi se
      </Button>
    </form>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(
      z.object({
        displayName: z.string().trim().min(2, "Upišite ime (barem 2 znaka).").max(60),
        email,
        password,
      }),
    ),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const { data, error: signUpError } = await getBrowserSupabase().auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { display_name: values.displayName },
        emailRedirectTo: redirectUrl("/auth/callback?next=/dashboard"),
      },
    });
    if (signUpError) return setError(authMessage(signUpError));
    if (data.session) {
      router.replace("/dashboard");
      router.refresh();
    } else {
      setSentTo(values.email);
    }
  });

  if (sentTo) {
    return (
      <div className="text-center">
        <Mail className="mx-auto size-12 text-cyan-300" />
        <p className="mt-4 text-lg font-semibold">Provjerite e-mail</p>
        <p className="mt-1 text-ink-muted">
          Poslali smo poveznicu za potvrdu na <strong className="text-ink">{sentTo}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <Field label="Ime ili nadimak" htmlFor="displayName" error={form.formState.errors.displayName?.message}>
        <Input id="displayName" autoComplete="nickname" {...form.register("displayName")} aria-invalid={!!form.formState.errors.displayName} />
      </Field>
      <Field label="E-mail" htmlFor="email" error={form.formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} aria-invalid={!!form.formState.errors.email} />
      </Field>
      <Field label="Lozinka" htmlFor="password" error={form.formState.errors.password?.message} hint="Barem 8 znakova.">
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} aria-invalid={!!form.formState.errors.password} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
        Otvori račun
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const form = useForm({ resolver: zodResolver(z.object({ email })) });

  const onSubmit = form.handleSubmit(async ({ email: address }) => {
    setError(null);
    const { error: resetError } = await getBrowserSupabase().auth.resetPasswordForEmail(address, {
      redirectTo: redirectUrl("/auth/callback?next=/reset-password"),
    });
    if (resetError) return setError(authMessage(resetError));
    setSent(true);
  });

  if (sent) {
    return (
      <div className="text-center">
        <CircleCheck className="mx-auto size-12 text-mint-400" />
        <p className="mt-4 text-lg font-semibold">Poveznica je poslana</p>
        <p className="mt-1 text-ink-muted">Ako postoji račun s tom adresom, stići će vam e-mail s uputama.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <Field label="E-mail" htmlFor="email" error={form.formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} aria-invalid={!!form.formState.errors.email} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
        Pošalji poveznicu
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(
      z.object({ password, confirm: z.string() }).refine((v) => v.password === v.confirm, {
        message: "Lozinke se ne podudaraju.",
        path: ["confirm"],
      }),
    ),
  });

  const onSubmit = form.handleSubmit(async ({ password: newPassword }) => {
    setError(null);
    const supabase = getBrowserSupabase();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return setError("Poveznica je istekla. Zatražite novu.");
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) return setError(authMessage(updateError));
    router.replace("/dashboard");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <Field label="Nova lozinka" htmlFor="password" error={form.formState.errors.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field label="Ponovite lozinku" htmlFor="confirm" error={form.formState.errors.confirm?.message}>
        <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
        Spremi lozinku
      </Button>
    </form>
  );
}
