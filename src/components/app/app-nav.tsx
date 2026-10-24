"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Kvizovi" },
  { href: "/dashboard/games", label: "Odigrane igre" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigacija aplikacije" className="flex items-center gap-1">
      {LINKS.map((link) => {
        const active = link.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-bold transition-colors sm:text-base",
              active ? "bg-white/10 text-ink" : "text-ink-subtle hover:bg-white/6 hover:text-ink",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
