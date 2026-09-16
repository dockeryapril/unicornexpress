import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  children: (session: Session) => ReactNode;
  heading?: string;
};

export function AuthGate({ children, heading = "Your postcards need a return address" }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const redirectTo = typeof window === "undefined" ? undefined : window.location.href;
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: redirectTo ? { emailRedirectTo: redirectTo } : {},
    });
    if (authError) {
      setError(authError.message);
      return;
    }
    setSent(true);
  }

  if (loading) {
    return (
      <div className="papergrain grid min-h-screen place-items-center bg-background">
        <p className="font-mono text-[10px] tracking-[0.18em] text-inkmuted">CHECKING THE MAIL…</p>
      </div>
    );
  }

  if (session) return children(session);

  return (
    <div className="papergrain mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-background">
      <div className="airmail h-1.5" />
      <main className="grid flex-1 place-items-center px-5 py-12">
        <section className="postcard-surface w-full rounded-[18px] p-6 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-accent text-[30px] text-accent-foreground">
            ✉
          </div>
          <h1 className="mt-5 font-display text-[23px] leading-tight tracking-tight">{heading}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-inkmuted">
            Sign in by email so mailed postcards can leave your possession and arrive privately.
          </p>

          {sent ? (
            <div className="mt-6 rounded-[14px] bg-secondary p-4 text-left">
              <p className="text-[13px] font-semibold">Check your email</p>
              <p className="mt-1 text-[12px] text-inkmuted">
                We sent a private sign-in link to {email}. Open it on this device to continue.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-3 font-mono text-[9px] tracking-[0.14em] text-accent underline"
              >
                USE A DIFFERENT EMAIL
              </button>
            </div>
          ) : (
            <form onSubmit={sendMagicLink} className="mt-6 space-y-3 text-left">
              <label className="block">
                <span className="font-mono text-[9px] tracking-[0.16em] text-inkmuted">
                  EMAIL ADDRESS
                </span>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-[12px] border border-line bg-background px-3 py-3 text-[14px] outline-none focus:border-accent"
                />
              </label>
              {error && <p className="text-[12px] text-destructive">{error}</p>}
              <button
                type="submit"
                className="w-full rounded-[12px] bg-ink py-3.5 text-[13px] font-semibold text-cream"
              >
                Send private sign-in link
              </button>
            </form>
          )}
        </section>
      </main>
      <div className="airmail h-1.5" />
    </div>
  );
}
