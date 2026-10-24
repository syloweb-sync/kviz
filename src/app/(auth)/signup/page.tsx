import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Registracija" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Otvori račun"
      subtitle="Račun treba samo domaćinu. Igrači ulaze bez registracije."
      footer={
        <>
          Već imate račun?{" "}
          <Link href="/login" className="font-bold text-cyan-300 hover:underline">
            Prijavite se
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
