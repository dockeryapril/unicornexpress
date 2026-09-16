import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PostcardBack, PostcardFront } from "@/components/postal/PostcardFace";
import { formatPostmark, loadPostcard, templateById } from "@/lib/postcard";
import { useState } from "react";
import { Postcard3DViewer } from "@/components/postal/Postcard3DViewer";

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const card = await loadPostcard(params.slug);
    if (!card) throw notFound();
    return card;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Postcard not found — Paravoy" }, { name: "robots", content: "noindex" }],
      };
    }
    const from = loaderData.sender || "someone";
    const title = `A postcard from ${from} — Paravoy`;
    const description = loaderData.message
      ? loaderData.message.slice(0, 150)
      : "A handwritten digital postcard with a photo and a voice note.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  notFoundComponent: MissingPostcard,
  component: SharedPostcard,
});

function MissingPostcard() {
  return (
    <div className="papergrain grid min-h-screen place-items-center bg-background px-6 text-center">
      <div>
        <p className="font-display text-[22px] tracking-tight">Lost in the post</p>
        <p className="mt-2 text-[13px] text-inkmuted">
          This postcard link doesn't exist or has been removed.
        </p>
        <Link
          to="/"
          className="mt-5 inline-block rounded-[12px] bg-accent px-5 py-3 text-[13px] font-semibold text-accent-foreground"
        >
          Make your own
        </Link>
      </div>
    </div>
  );
}

function SharedPostcard() {
  const card = Route.useLoaderData();
  const tpl = templateById(card.template);
  const [copied, setCopied] = useState(false);
  const [face, setFace] = useState<"front" | "back">("front");

  async function copy() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="papergrain relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-background">
      <div className="airmail no-print h-1.5 w-full" />

      <header className="no-print flex items-center justify-between px-4 pt-3 pb-2">
        <span className="font-display text-[15px] tracking-tight">PARAVOY</span>
        <span className="font-mono text-[10px] text-inkmuted">
          POSTMARKED {formatPostmark(card.created_at)}
        </span>
      </header>

      <main className="flex-1 space-y-3 px-4 pb-8">
        <div className="card-in relative">
          <span className="no-print absolute -top-1.5 left-6 z-10 size-7 -rotate-6 rounded-full bg-accent/85" />
          <span className="no-print absolute -top-1.5 right-6 z-10 size-7 rotate-6 rounded-full bg-navy/85" />
          <Postcard3DViewer
            tapToFlip
            face={face}
            onFaceChange={setFace}
            front={
              <PostcardFront
                fill
                template={tpl}
                photoUrl={card.photoUrl}
                drawingUrl={card.drawingUrl}
                stickers={card.stickers}
              />
            }
            back={
              <PostcardBack
                fill
                template={tpl}
                message={card.message}
                sender={card.sender}
                recipient={card.recipient}
                note={card.note}
                createdAt={card.created_at}
              />
            }
          />
        </div>

        <button
          type="button"
          onClick={() => setFace(face === "front" ? "back" : "front")}
          className="no-print w-full font-mono text-[9px] tracking-[0.18em] text-inkmuted"
        >
          DRAG OR TAP TO TURN · SHOWING {face === "front" ? "PICTURE SIDE" : "WRITING SIDE"}
        </button>

        {card.audioUrl && (
          <div className="tool-chip rounded-[14px] p-3.5">
            <p className="font-mono text-[9px] tracking-[0.18em] text-inkmuted">
              VOICE NOTE FROM {(card.sender || "SENDER").toUpperCase()}
            </p>
            <audio controls src={card.audioUrl} className="mt-2 w-full" />
          </div>
        )}

        <div className="no-print grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={copy}
            className="tool-chip rounded-[12px] py-3 text-[12px] font-semibold"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-[12px] bg-ink py-3 text-[12px] font-semibold text-cream"
          >
            Print
          </button>
          <Link
            to="/"
            className="rounded-[12px] bg-accent py-3 text-center text-[12px] font-semibold text-accent-foreground"
          >
            Reply
          </Link>
        </div>
      </main>

      <div className="airmail no-print h-1.5 w-full" />
    </div>
  );
}
