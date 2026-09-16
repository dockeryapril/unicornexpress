import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { MailTimeline } from "@/components/postal/MailTimeline";
import { Postcard3DViewer } from "@/components/postal/Postcard3DViewer";
import { PostcardBack, PostcardFront } from "@/components/postal/PostcardFace";
import {
  effectiveStatus,
  loadTrackingCard,
  openAndLoadPostcard,
  statusLabel,
  type DeliveredContents,
  type TrackingCard,
} from "@/lib/secure-mail-read";
import { templateById } from "@/lib/postcard";

export const Route = createFileRoute("/track/$trackingNumber")({
  component: TrackingRoute,
  head: () => ({
    meta: [{ title: "Track a postcard — Paravoy" }, { name: "robots", content: "noindex" }],
  }),
});

function TrackingRoute() {
  const { trackingNumber } = Route.useParams();
  return (
    <AuthGate heading="This tracking number is private">
      {(session) => (
        <TrackingPage trackingNumber={trackingNumber} email={session.user.email ?? ""} />
      )}
    </AuthGate>
  );
}

function TrackingPage({ trackingNumber, email }: { trackingNumber: string; email: string }) {
  const [card, setCard] = useState<TrackingCard | null>(null);
  const [contents, setContents] = useState<DeliveredContents | null>(null);
  const [face, setFace] = useState<"front" | "back">("front");
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    void loadTrackingCard(trackingNumber)
      .then((loaded) => {
        if (!loaded) setError("That tracking number was not found in your mail.");
        else setCard(loaded);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Tracking failed"),
      );
  }, [trackingNumber]);

  if (error)
    return (
      <TrackingShell>
        <p className="rounded-xl bg-destructive/10 p-4 text-[13px] text-destructive">{error}</p>
      </TrackingShell>
    );
  if (!card)
    return (
      <TrackingShell>
        <p className="py-16 text-center font-mono text-[9px] text-inkmuted">LOCATING POSTCARD…</p>
      </TrackingShell>
    );

  const status = effectiveStatus(card);
  const isReceiver = card.recipient_email.toLowerCase() === email.toLowerCase();
  const delivered = status === "DELIVERED" || status === "OPENED";

  async function open() {
    if (!isReceiver || !delivered) return;
    setOpening(true);
    setError(null);
    try {
      setContents(await openAndLoadPostcard(trackingNumber, card!.id));
      setCard({ ...card!, opened_at: new Date().toISOString(), status: "OPENED" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The postcard could not be opened");
    } finally {
      setOpening(false);
    }
  }

  if (contents) {
    const template = templateById(contents.template);
    return (
      <TrackingShell>
        <p className="mb-3 text-center font-mono text-[9px] tracking-[0.16em] text-accent">
          POSTCARD OPENED
        </p>
        <Postcard3DViewer
          tapToFlip
          face={face}
          onFaceChange={setFace}
          front={
            <PostcardFront
              fill
              template={template}
              photoUrl={contents.photoUrl}
              drawingUrl={contents.drawingUrl}
              stickers={contents.stickers}
            />
          }
          back={
            <PostcardBack
              fill
              template={template}
              message={contents.message}
              sender={contents.sender_label}
              recipient={contents.recipient_label}
              note={contents.note}
            />
          }
        />
        <button
          type="button"
          onClick={() => setFace(face === "front" ? "back" : "front")}
          className="mt-3 w-full font-mono text-[9px] tracking-[0.15em] text-inkmuted"
        >
          DRAG OR TAP TO TURN
        </button>
        {contents.audioUrl && (
          <audio controls preload="none" src={contents.audioUrl} className="mt-5 w-full" />
        )}
      </TrackingShell>
    );
  }

  return (
    <TrackingShell>
      <section className="postcard-surface rounded-[16px] p-4">
        <p className="font-mono text-[8px] tracking-[0.16em] text-inkmuted">TRACKING NUMBER</p>
        <p className="mt-1 font-mono text-[14px] font-bold">{card.tracking_number}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
          <Detail label="FROM" value={card.origin_label} />
          <Detail label="TO" value={card.destination_label} />
          <Detail label="MAILED" value={new Date(card.mailed_at).toLocaleDateString()} />
          <Detail
            label="EST. DELIVERY"
            value={new Date(card.estimated_delivery_at).toLocaleDateString()}
          />
        </div>
      </section>
      <section className="postcard-surface mt-3 rounded-[16px] p-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-display text-[15px] tracking-tight">MAIL JOURNEY</p>
          <span className="rounded-full bg-accent px-2.5 py-1 font-mono text-[8px] text-accent-foreground">
            {statusLabel(status).toUpperCase()}
          </span>
        </div>
        <MailTimeline status={status} />
        <p className="mt-3 border-t border-line pt-3 text-[10px] leading-relaxed text-inkmuted">
          This is Paravoy’s simulated digital-mail journey, not USPS tracking.
        </p>
      </section>
      {isReceiver && !delivered && (
        <div className="mt-3 rounded-[16px] bg-navy p-5 text-center text-cream">
          <p className="text-[28px]">✉</p>
          <p className="mt-2 font-display text-[17px]">YOU’VE GOT MAIL COMING</p>
          <p className="mt-1 text-[11px] text-cream/70">Its contents stay sealed until delivery.</p>
        </div>
      )}
      {isReceiver && delivered && (
        <button
          type="button"
          disabled={opening}
          onClick={open}
          className="mt-3 w-full rounded-[16px] bg-accent py-4 font-display text-[14px] text-accent-foreground disabled:opacity-60"
        >
          {opening ? "OPENING…" : "OPEN DELIVERED POSTCARD"}
        </button>
      )}
      {!isReceiver && (
        <p className="mt-3 rounded-[14px] bg-secondary p-4 text-center text-[11px] text-inkmuted">
          You mailed it. You can track the journey, but the postcard now belongs to the receiver.
        </p>
      )}
    </TrackingShell>
  );
}

function TrackingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="papergrain mx-auto min-h-screen w-full max-w-[430px] bg-background">
      <div className="airmail h-1.5" />
      <header className="flex items-center justify-between px-4 py-4">
        <Link to="/mailbox" className="font-display text-[16px] tracking-tight">
          PARAVOY
        </Link>
        <Link to="/mailbox" className="font-mono text-[9px] tracking-[0.14em] text-inkmuted">
          MAILBOX
        </Link>
      </header>
      <main className="px-4 pb-10">{children}</main>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[8px] tracking-[0.14em] text-inkmuted">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}
