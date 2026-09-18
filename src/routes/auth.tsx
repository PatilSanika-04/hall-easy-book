import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/hooks/useAuth";
import { PageShell } from "@/components/venue/Shell";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or register — VenueEasy" },
      {
        name: "description",
        content:
          "Create a VenueEasy account to book halls, track your bookings, or list your own venue.",
      },
      { property: "og:title", content: "Sign in or register — VenueEasy" },
      {
        property: "og:description",
        content: "Book halls or list your venue on VenueEasy.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"customer" | "owner">("customer");
  const [busy, setBusy] = useState(false);
  const { user } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: "/halls", replace: true });
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, phone, role },
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/halls" });
  }

  const field =
    "mt-1 w-full rounded-lg bg-cream/70 px-3 py-2.5 text-sm font-medium ring-1 ring-black/5 outline-none focus:ring-brand/40";
  const label = "text-[11px] font-semibold uppercase tracking-wider text-ink/45";

  return (
    <PageShell>
      <section className="relative z-20 mx-auto max-w-md px-6 pb-20 pt-14">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ember">
          {mode === "signin" ? "Welcome back" : "Join VenueEasy"}
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-none tracking-tight">
          {mode === "signin" ? "Sign in to book." : "Create your account."}
        </h1>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-4 rounded-[18px] bg-white/60 p-5 ring-1 ring-black/5 backdrop-blur-xl"
        >
          {mode === "signup" ? (
            <>
              <div>
                <label className={label}>Full name</label>
                <input
                  className={field}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={label}>Phone</label>
                <input
                  className={field}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>I am a</label>
                <div className="mt-2 flex gap-2">
                  {(["customer", "owner"] as const).map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setRole(r)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-black/5 ${
                        role === r ? "bg-brand text-paper" : "bg-cream text-ink/70"
                      }`}
                    >
                      {r === "customer" ? "Booking a hall" : "Hall owner"}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}
          <div>
            <label className={label}>Email</label>
            <input
              type="email"
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={label}>Password</label>
            <input
              type="password"
              className={field}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <button
            disabled={busy}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-paper ring-1 ring-brand-deep/30 transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <button
            type="button"
            onClick={handleGoogle}
            className="w-full rounded-lg bg-cream py-2.5 text-sm font-medium text-ink/80 ring-1 ring-black/5 hover:bg-cream/70"
          >
            Continue with Google
          </button>
          <p className="text-center text-xs text-ink/50">
            {mode === "signin" ? "New to VenueEasy?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-semibold text-brand hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </form>

        <p className="mt-4 text-center text-xs text-ink/45">
          Browsing only? <Link to="/halls" className="text-brand hover:underline">See the halls</Link>
        </p>
      </section>
    </PageShell>
  );
}
