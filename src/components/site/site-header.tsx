import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/server/auth";
import { publicEnv } from "@/lib/env";

export async function SiteHeader() {
  const user = publicEnv().configured ? await getCurrentUser().catch(() => null) : null;
  return (
    <header className="relative z-20">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Glavna navigacija" className="hidden items-center gap-1 md:flex">
          <Link href="/#kako" className="rounded-lg px-3 py-2 font-semibold text-ink-muted hover:bg-white/6 hover:text-ink">
            Kako radi
          </Link>
          <Link href="/#tipovi" className="rounded-lg px-3 py-2 font-semibold text-ink-muted hover:bg-white/6 hover:text-ink">
            Tipovi pitanja
          </Link>
          <Link href="/join" className="rounded-lg px-3 py-2 font-semibold text-ink-muted hover:bg-white/6 hover:text-ink">
            Pridruži se
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild size="sm">
              <Link href="/dashboard">Moji kvizovi</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Prijava</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Napravi kviz</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
