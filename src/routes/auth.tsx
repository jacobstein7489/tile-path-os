import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button, Field, TextInput } from "@/components/kit";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Cobblestone Tile OS" },
      {
        name: "description",
        content:
          "Sign in to Cobblestone Tile OS to run tile projects from submission through installation.",
      },
      { property: "og:title", content: "Sign in — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Secure sign-in for the Cobblestone tile operations platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) void navigate({ to: "/dashboard" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        void navigate({ to: "/dashboard" });
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
              <path d="M12 2l5 5-5 5-5-5 5-5zM5 12l5 5-5 5-5-5 5-5zM19 12l5 5-5 5-5-5 5-5z" />
            </svg>
          </div>
          <div className="text-[15px] leading-tight font-bold tracking-tight">
            Cobblestone
            <br />
            Tile OS
          </div>
        </div>

        <div className="surface p-6">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Welcome back</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Sign in with your invited Cobblestone employee account.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            <Field label="Work email">
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@cobblestonetile.com"
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Password">
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                minLength={8}
                required
              />
            </Field>
            <Button
              type="submit"
              variant="primary"
              loading={busy}
              className="w-full"
              disabled={busy}
            >
              Sign in
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11.5px] text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button onClick={google} className="w-full" disabled={busy}>
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.29-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
              />
            </svg>
            Continue with Google
          </Button>

          <p className="mt-5 text-center text-[12px] text-muted-foreground">
            Need access? Contact your Cobblestone administrator.
          </p>
        </div>
      </div>
    </main>
  );
}
