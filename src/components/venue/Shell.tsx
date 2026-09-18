import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles, useSession } from "@/hooks/useAuth";

export function GlassBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute -top-24 -left-24 size-[420px] rounded-full bg-brand/15 blur-3xl" />
      <div className="pointer-events-none absolute top-10 right-0 size-[380px] rounded-full bg-ember/15 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/3 size-[320px] rounded-full bg-sand/60 blur-3xl" />
      <div className="grain pointer-events-none absolute inset-0" />
    </>
  );
}

export function SiteHeader() {
  const { user } = useSession();
  const { data: roles } = useRoles(user?.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOwner = roles?.includes("owner");

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="relative z-30 mx-auto max-w-7xl px-6 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-white/55 px-5 py-3 ring-1 ring-black/5 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-brand font-display text-lg font-semibold text-paper">
            V
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">VenueEasy</span>
          <span className="ml-2 hidden text-xs font-medium text-ink/45 sm:inline">
            Grand rooms, ready when you are
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link to="/halls" className="rounded-lg px-3 py-1.5 text-ink/70 hover:bg-black/5">
            Find a hall
          </Link>
          {user ? (
            <Link to="/bookings" className="rounded-lg px-3 py-1.5 text-ink/70 hover:bg-black/5">
              My bookings
            </Link>
          ) : null}
          {user && isOwner ? (
            <Link to="/owner" className="rounded-lg px-3 py-1.5 text-ink/70 hover:bg-black/5">
              Owner dashboard
            </Link>
          ) : null}
          {user ? (
            <button
              onClick={signOut}
              className="ml-1 rounded-lg bg-ink px-3 py-1.5 text-paper hover:bg-ink/90"
            >
              Sign out
            </button>
          ) : (
            <Link to="/auth" className="ml-1 rounded-lg bg-ink px-3 py-1.5 text-paper hover:bg-ink/90">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream font-sans text-ink antialiased">
      <div className="relative overflow-hidden">
        <GlassBackdrop />
        <SiteHeader />
        {children}
        <footer className="relative z-20 mx-auto max-w-7xl px-6 pb-10 pt-4">
          <div className="border-t border-ink/10 pt-6 text-xs text-ink/45">
            © {new Date().getFullYear()} VenueEasy · Reserve with confidence
          </div>
        </footer>
      </div>
    </div>
  );
}
