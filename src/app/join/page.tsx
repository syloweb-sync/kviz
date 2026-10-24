import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { FloatingShapes } from "@/components/brand/shapes";
import { JoinFlow } from "@/components/player/join-flow";

export const metadata: Metadata = { title: "Pridruži se igri" };

export default function JoinPage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center px-4 pb-10 pt-8">
      <FloatingShapes className="opacity-50" />
      <Logo className="relative" />
      <main className="relative mt-10 w-full max-w-md flex-1">
        <Suspense>
          <JoinFlow />
        </Suspense>
      </main>
    </div>
  );
}
