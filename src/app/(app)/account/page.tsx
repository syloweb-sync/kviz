import type { Metadata } from "next";
import { AccountForm } from "@/components/app/account-form";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Postavke računa" };

export default async function AccountPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user!.id).maybeSingle();
  return (
    <main className="mx-auto max-w-xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
      <h1 className="font-display text-4xl font-extrabold">Postavke računa</h1>
      <AccountForm userId={user!.id} email={user!.email ?? ""} displayName={profile?.display_name ?? ""} />
    </main>
  );
}
