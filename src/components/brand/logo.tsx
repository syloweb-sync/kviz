import Link from "next/link";
import { cn } from "@/lib/utils";

/** The Pitalica mark: a rounded speech bubble whose tail forms a question-mark dot. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-10", className)} aria-hidden="true">
      <defs>
        <linearGradient id="pitalica-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a98bff" />
          <stop offset="1" stopColor="#6f45f0" />
        </linearGradient>
      </defs>
      <path
        d="M10 6h28a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8H24l-9 7.5V36h-5a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8Z"
        fill="url(#pitalica-mark)"
      />
      <path
        d="M19.2 16.6a5.2 5.2 0 0 1 10 1.9c0 3.4-4.7 3.8-4.7 6.9"
        fill="none"
        stroke="#fff"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <circle cx="24.5" cy="30.4" r="2.3" fill="#ffcc3d" />
      <circle cx="40.5" cy="8.5" r="4.5" fill="#2fe0f5" stroke="#0d0a26" strokeWidth="2.5" />
    </svg>
  );
}

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="Pitalica — početna">
      <LogoMark className="transition-transform duration-300 ease-[var(--ease-snap)] group-hover:-rotate-6 group-hover:scale-105" />
      <span className="font-display text-2xl font-extrabold tracking-tight text-ink">
        pitalica<span className="text-sun-400">.</span>
      </span>
    </Link>
  );
}
