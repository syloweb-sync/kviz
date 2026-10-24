import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-24 border-t border-white/8">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-ink-subtle">
            Kvizovi uživo za društvene večeri, obiteljska okupljanja, razrede i timove.
          </p>
        </div>
        <FooterColumn
          title="Igraj"
          links={[
            { href: "/join", label: "Pridruži se igri" },
            { href: "/#kako", label: "Kako radi" },
            { href: "/#tipovi", label: "Tipovi pitanja" },
          ]}
        />
        <FooterColumn
          title="Napravi"
          links={[
            { href: "/signup", label: "Otvori račun" },
            { href: "/login", label: "Prijava" },
            { href: "/dashboard", label: "Moji kvizovi" },
          ]}
        />
        <FooterColumn
          title="Pomoć"
          links={[
            { href: "/forgot-password", label: "Zaboravljena lozinka" },
            { href: "/#pitanja", label: "Česta pitanja" },
          ]}
        />
      </div>
      <div className="border-t border-white/6 py-6 text-center text-xs text-ink-faint">
        © {new Date().getFullYear()} Pitalica. Napravljeno za dobru zabavu.
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h2 className="font-display text-sm font-bold uppercase tracking-widest text-ink-faint">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-ink-muted hover:text-ink">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
