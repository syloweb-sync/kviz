"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const initial = (name || email).charAt(0).toUpperCase();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="grid size-10 place-items-center rounded-full bg-sun-400 font-display text-lg font-extrabold text-night-950 ring-2 ring-white/10 hover:ring-white/30"
        aria-label="Izbornik računa"
      >
        {initial}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="surface z-50 min-w-56 rounded-xl p-1.5 data-[state=open]:animate-pop-in"
        >
          <div className="px-3 py-2">
            <p className="font-bold">{name || "Domaćin"}</p>
            <p className="truncate text-sm text-ink-subtle">{email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-white/8" />
          <DropdownMenu.Item asChild className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 font-semibold outline-none data-[highlighted]:bg-white/8">
            <Link href="/account">
              <Settings className="size-4" /> Postavke računa
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 font-semibold text-coral-400 outline-none data-[highlighted]:bg-white/8"
            onSelect={async () => {
              await getBrowserSupabase().auth.signOut();
              router.replace("/");
              router.refresh();
            }}
          >
            <LogOut className="size-4" /> Odjava
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
