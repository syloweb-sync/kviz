import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Zaboravljena lozinka" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Zaboravljena lozinka"
      subtitle="Poslat ćemo vam poveznicu za postavljanje nove lozinke."
      footer={
        <Link href="/login" className="font-bold text-cyan-300 hover:underline">
          ← Natrag na prijavu
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
