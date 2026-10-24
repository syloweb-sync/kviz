import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Nova lozinka" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Postavite novu lozinku" subtitle="Odaberite lozinku koju dosad niste koristili.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
