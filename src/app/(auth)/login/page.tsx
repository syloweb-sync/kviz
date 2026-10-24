import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Prijava" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Dobro došli natrag"
      subtitle="Prijavite se za izradu i pokretanje kvizova."
      footer={
        <>
          Nemate račun?{" "}
          <Link href="/signup" className="font-bold text-cyan-300 hover:underline">
            Registrirajte se
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
