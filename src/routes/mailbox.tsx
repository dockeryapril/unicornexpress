import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/auth/AuthGate";
import {
  effectiveStatus,
  loadMailbox,
  statusLabel,
  type TrackingCard,
} from "@/lib/secure-mail-read";

export const Route = createFileRoute("/mailbox")({
  component: MailboxRoute,
  head: () => ({
    meta: [{ title: "Your mailbox — Paravoy" }, { name: "robots", content: "noindex" }],
  }),
});

function MailboxRoute() {
  return (
    <AuthGate heading="Open your private mailbox">
      {(session) => <Mailbox session={session} />}
    </AuthGate>
  );
}

function Mailbox({ session }: { session: Session }) {
  const [mail, setMail] = useState<{ incoming: TrackingCard[]; sent: TrackingCard[] } | null>(null);
  const [tab, setTab] = useState<"incoming" | "sent">("incoming");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const email = session.user.email;
    if (!email) return;
    void loadMailbox(session.user.id, email)
      .then(setMail)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Mailbox failed to load"),
      );
  }, [session]);

  const cards = mail?.[tab] ?? [];
  return (
    <div className="papergrain mx-auto min-h-screen w-full max-w-[430px] bg-background">
      <div className="airmail h-1.5" />
      <header className="flex items-center justify-between px-4 py-4">
        <div>
          <p className="font-display text-[20px] tracking-tight">YOUR MAILBOX</p>
          <p className="font-mono text-[8px] tracking-[0.15em] text-inkmuted">NOT AN INBOX</p>
        </div>
        <Link
          to="/"
          className="rounded-full bg-accent px-3 py-2 text-[11px] font-semibold text-accent-foreground"
        >
          Make mail
        </Link>
      </header>
      <main className="px-4 pb-10">
        <div className="mb-4 grid grid-cols-2 rounded-full bg-secondary p-1">
          {(["incoming", "sent"] as const).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              className={`rounded-full py-2 font-mono text-[9px] tracking-[0.14em] ${
                tab === name ? "bg-ink text-cream" : "text-inkmuted"
              }`}
            >
              {name.toUpperCase()}
            </button>
          ))}
        </div>
        {error && (
          <p className="rounded-xl bg-destructive/10 p-3 text-[12px] text-destructive">{error}</p>
        )}
        {!mail && !error && (
          <p className="py-12 text-center font-mono text-[9px] text-inkmuted">SORTING THE MAIL…</p>
        )}
        {mail && cards.length === 0 && (
          <div className="postcard-surface rounded-[16px] p-8 text-center">
            <p className="text-[28px]">📭</p>
            <p className="mt-2 text-[13px] font-semibold">No {tab} postcards yet</p>
          </div>
        )}
        <div className="space-y-3">
          {cards.map((card) => {
            const status = effectiveStatus(card);
            const incoming = tab === "incoming";
            return (
              <Link
                key={card.id}
                to="/track/$trackingNumber"
                params={{ trackingNumber: card.tracking_number }}
                className="postcard-surface block rounded-[16px] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[8px] tracking-[0.14em] text-inkmuted">
                      {incoming ? "FROM" : "MAILED TO"}
                    </p>
                    <p className="mt-0.5 font-hand text-[24px] leading-none">
                      {incoming ? card.sender : card.recipient}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 font-mono text-[8px] ${status === "DELIVERED" || status === "OPENED" ? "bg-accent text-accent-foreground" : "bg-secondary text-inkmuted"}`}
                  >
                    {statusLabel(status).toUpperCase()}
                  </span>
                </div>
                <p className="mt-4 font-mono text-[9px] tracking-[0.08em] text-inkmuted">
                  {card.tracking_number}
                </p>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
