import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { FloatingShapes } from "@/components/brand/shapes";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative grid min-h-dvh place-items-center px-6 text-center">
      <FloatingShapes className="opacity-40" />
      <div className="relative">
        <Logo />
        <p className="mt-10 font-display text-[7rem] font-extrabold leading-none text-violet-400">404</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">Ovo pitanje nema odgovora</h1>
        <p className="mt-2 text-ink-muted">Stranica ne postoji ili joj nemate pristup.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/">Na početnu</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/join">Pridruži se igri</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
