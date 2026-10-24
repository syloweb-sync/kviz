import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { FloatingShapes } from "@/components/brand/shapes";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <FloatingShapes className="opacity-40" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="surface rounded-2xl p-6 sm:p-8">
          <h1 className="font-display text-3xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-2 text-ink-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-ink-muted">{footer}</div>}
        <p className="mt-4 text-center text-sm">
          <Link href="/join" className="font-semibold text-ink-subtle hover:text-ink">
            Samo igraš? Uđi s PIN-om →
          </Link>
        </p>
      </div>
    </div>
  );
}
