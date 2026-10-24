import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { AppNav } from "@/components/app/app-nav";
import { UserMenu } from "@/components/app/user-menu";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-white/6 bg-night-900/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            <Logo href="/dashboard" className="[&>span]:hidden sm:[&>span]:inline" />
            <AppNav />
          </div>
          <UserMenu name={profile?.display_name ?? ""} email={user.email ?? ""} />
        </div>
      </header>
      {children}
    </div>
  );
}
