import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StepRail } from "@/components/postal/StepRail";
import { PostcardBack, PostcardFront } from "@/components/postal/PostcardFace";
import { DrawLayer, type DrawLayerHandle } from "@/components/postal/DrawLayer";
import { VoiceRecorder } from "@/components/postal/VoiceRecorder";
import { Postcard3DViewer } from "@/components/postal/Postcard3DViewer";
import {
  STICKERS,
  TEMPLATES,
  publishPostcard,
  templateById,
  type Sticker,
  type TemplateId,
} from "@/lib/postcard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Paravoy — Make a Digital Postcard in Three Steps" },
      {
        name: "description",
        content:
          "Snap a photo, handwrite or draw your message, add stickers and a voice note, then send your postcard as a link or print it.",
      },
      { property: "og:title", content: "Paravoy — Make a Digital Postcard" },
      {
        property: "og:description",
        content:
          "Photo, handwriting, stickers and a voice note. Send it as a link or print it at home.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

type Tool = "write" | "draw" | "stickers" | "voice";

function Studio() {
  const [step, setStep] = useState(0);
  const [tool, setTool] = useState<Tool>("write");
  const [face, setFace] = useState<"front" | "back">("front");

  const [template, setTemplate] = useState<TemplateId>("airmail");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<string | null>(null);
  const [inkColor, setInkColor] = useState("#E24A32");
  const [inkSize, setInkSize] = useState(8);
  const [drawMode, setDrawMode] = useState<"pen" | "eraser">("pen");
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sender, setSender] = useState("");
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioSeconds, setAudioSeconds] = useState(0);

  const [sending, setSending] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const drawHandle = useRef<DrawLayerHandle | null>(null);
  const registerHandle = useCallback((h: DrawLayerHandle) => {
    drawHandle.current = h;
  }, []);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const tpl = templateById(template);

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
  }

  function addSticker(char: string) {
    const id = crypto.randomUUID();
    setStickers((prev) => [
      ...prev,
      {
        id,
        char,
        x: 30 + Math.random() * 40,
        y: 30 + Math.random() * 35,
        rot: Math.round(Math.random() * 24 - 12),
        scale: 1,
      },
    ]);
    setSelectedStickerId(id);
    setFace("front");
  }

  function moveSticker(id: string, x: number, y: number) {
    setStickers((prev) => prev.map((s) => (s.id === id ? { ...s, x, y } : s)));
  }

  function removeSticker(id: string) {
    setStickers((prev) => prev.filter((s) => s.id !== id));
    setSelectedStickerId((current) => (current === id ? null : current));
  }

  function transformSticker(id: string, changes: Pick<Sticker, "rot" | "scale">) {
    setStickers((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const created = await publishPostcard({
        template,
        message,
        sender,
        recipient,
        note,
        stickers,
        photo,
        drawingDataUrl: drawing,
        audio,
      });
      setSlug(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong sending your postcard.");
    } finally {
      setSending(false);
    }
  }

  const shareUrl =
    slug && typeof window !== "undefined" ? `${window.location.origin}/p/${slug}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const editingSurface = step === 1 && (tool === "draw" || tool === "stickers");
  const postcardFront = (
    <PostcardFront
      fill
      template={tpl}
      photoUrl={photoUrl}
      drawingUrl={step === 1 && tool === "draw" ? null : drawing}
      stickers={stickers}
      onMoveSticker={step === 1 && tool === "stickers" ? moveSticker : undefined}
      onRemoveSticker={step === 1 && tool === "stickers" ? removeSticker : undefined}
      onSelectSticker={step === 1 && tool === "stickers" ? setSelectedStickerId : undefined}
      selectedStickerId={step === 1 && tool === "stickers" ? selectedStickerId : null}
    >
      {step === 1 && tool === "draw" && (
        <DrawLayer
          color={inkColor}
          size={inkSize}
          mode={drawMode}
          initialDataUrl={drawing}
          enabled
          onChange={setDrawing}
          registerHandle={registerHandle}
        />
      )}
    </PostcardFront>
  );
  const postcardBack = (
    <PostcardBack
      fill
      template={tpl}
      message={message}
      sender={sender}
      recipient={recipient}
      note={note}
    />
  );

  return (
    <div className="papergrain relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-background">
      <div className="airmail h-1.5 w-full" />
      <StepRail step={step} onJump={(i) => !slug && setStep(i)} />

      <main className="flex-1 px-4 pt-3 pb-40">
        {/* ---------------- Card canvas ---------------- */}
        <div className="card-in relative">
          <span className="absolute -top-1.5 left-6 z-10 size-7 -rotate-6 rounded-full bg-accent/85 shadow-sm" />
          <span className="absolute -top-1.5 right-6 z-10 size-7 rotate-6 rounded-full bg-navy/85 shadow-sm" />
          <Postcard3DViewer
            front={postcardFront}
            back={postcardBack}
            face={face}
            interactionLocked={editingSurface}
            onFaceChange={setFace}
          />
        </div>

        <button
          type="button"
          onClick={() => setFace(face === "front" ? "back" : "front")}
          className="mt-2 w-full font-mono text-[9px] tracking-[0.18em] text-inkmuted"
        >
          TAP TO FLIP · SHOWING {face === "front" ? "PICTURE SIDE" : "WRITING SIDE"}
        </button>

        {/* ---------------- Step 1: create ---------------- */}
        {step === 0 && (
          <section className="rise mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="tool-chip rounded-[14px] px-3 py-4 text-left"
              >
                <span className="text-[19px]">📷</span>
                <p className="mt-1 text-[13px] font-semibold">Snap a photo</p>
                <p className="font-mono text-[9px] tracking-[0.14em] text-inkmuted">CAMERA</p>
              </button>
              <button
                type="button"
                onClick={() => uploadRef.current?.click()}
                className="tool-chip rounded-[14px] px-3 py-4 text-left"
              >
                <span className="text-[19px]">🖼️</span>
                <p className="mt-1 text-[13px] font-semibold">Upload one</p>
                <p className="font-mono text-[9px] tracking-[0.14em] text-inkmuted">LIBRARY</p>
              </button>
            </div>

            <div>
              <p className="mb-2 font-mono text-[9px] tracking-[0.18em] text-inkmuted">
                CHOOSE A TEMPLATE
              </p>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    className={`rounded-[14px] px-3 py-3 text-left ${
                      template === t.id ? "bg-ink text-cream" : "tool-chip text-foreground"
                    }`}
                  >
                    <p className="font-display text-[12px] tracking-tight">{t.name}</p>
                    <p
                      className={`mt-0.5 text-[11px] ${
                        template === t.id ? "text-cream/70" : "text-inkmuted"
                      }`}
                    >
                      {t.blurb}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---------------- Step 2: customize ---------------- */}
        {step === 1 && (
          <section className="rise mt-4 space-y-3">
            <div className="flex items-center gap-2">
              {(
                [
                  ["write", "Aa", "Handwrite"],
                  ["draw", "✎", "Draw"],
                  ["stickers", "✦", "Stickers"],
                  ["voice", "🎙", "Voice"],
                ] as const
              ).map(([id, glyph, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setTool(id);
                    setFace(id === "write" ? "back" : "front");
                  }}
                  className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold ${
                    tool === id ? "bg-ink text-cream" : "tool-chip text-foreground"
                  }`}
                  aria-label={label}
                >
                  <span className="font-hand text-[18px] leading-none">{glyph}</span>
                </button>
              ))}
            </div>

            {tool === "write" && (
              <div className="tool-chip space-y-3 rounded-[14px] p-3.5">
                <label className="block">
                  <span className="font-mono text-[9px] tracking-[0.18em] text-inkmuted">
                    YOUR MESSAGE
                  </span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    maxLength={160}
                    placeholder="Loved the light up in Lisbon — save me a seat."
                    className="mt-1 w-full resize-none rounded-[10px] border border-line bg-background p-2 font-hand text-[24px] leading-tight outline-none focus:border-accent"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="font-mono text-[9px] tracking-[0.18em] text-inkmuted">TO</span>
                    <input
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="June"
                      className="mt-1 w-full rounded-[10px] border border-line bg-background px-2 py-2 font-hand text-[18px] outline-none focus:border-accent"
                    />
                  </label>
                  <label className="block">
                    <span className="font-mono text-[9px] tracking-[0.18em] text-inkmuted">
                      FROM
                    </span>
                    <input
                      value={sender}
                      onChange={(e) => setSender(e.target.value)}
                      placeholder="R. Marlowe"
                      className="mt-1 w-full rounded-[10px] border border-line bg-background px-2 py-2 font-hand text-[18px] outline-none focus:border-accent"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="font-mono text-[9px] tracking-[0.18em] text-inkmuted">P.S.</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Stay warm."
                    className="mt-1 w-full rounded-[10px] border border-line bg-background px-2 py-2 font-hand text-[18px] outline-none focus:border-accent"
                  />
                </label>
              </div>
            )}

            {tool === "draw" && (
              <div className="tool-chip space-y-3 rounded-[14px] p-3.5">
                <p className="font-mono text-[9px] tracking-[0.18em] text-inkmuted">
                  DRAW STRAIGHT ONTO THE PICTURE SIDE
                </p>
                <div className="flex items-center gap-2">
                  {["#E24A32", "#243B5C", "#221B14", "#F6EEDC"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setInkColor(c)}
                      aria-label={`Ink ${c}`}
                      className={`size-8 rounded-full ${
                        inkColor === c ? "ring-2 ring-accent ring-offset-2" : ""
                      }`}
                      style={{ backgroundColor: c, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)" }}
                    />
                  ))}
                  <input
                    type="range"
                    min={3}
                    max={22}
                    value={inkSize}
                    onChange={(e) => setInkSize(Number(e.target.value))}
                    className="ml-auto w-24 accent-accent"
                    aria-label="Pen thickness"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setDrawMode(drawMode === "pen" ? "eraser" : "pen")}
                  className={`rounded-full px-3 py-2 font-mono text-[9px] tracking-[0.12em] ${
                    drawMode === "eraser" ? "bg-ink text-cream" : "border border-line"
                  }`}
                >
                  {drawMode === "eraser" ? "ERASER ON" : "ERASER"}
                </button>
                <button
                  type="button"
                  onClick={() => drawHandle.current?.undo()}
                  className="rounded-full border border-line px-3 py-2 font-mono text-[9px] tracking-[0.12em]"
                >
                  UNDO
                </button>
                <button
                  type="button"
                  onClick={() => drawHandle.current?.redo()}
                  className="rounded-full border border-line px-3 py-2 font-mono text-[9px] tracking-[0.12em]"
                >
                  REDO
                </button>
                <button
                  type="button"
                  onClick={() => drawHandle.current?.clear()}
                  className="rounded-full px-2 py-2 font-mono text-[9px] tracking-[0.12em] text-accent underline"
                >
                  CLEAR
                </button>
              </div>
            )}

            {tool === "stickers" && (
              <div className="tool-chip space-y-3 rounded-[14px] p-3.5">
                <p className="font-mono text-[9px] tracking-[0.18em] text-inkmuted">
                  TAP TO ADD · DRAG TO PLACE · DOUBLE-TAP TO REMOVE
                </p>
                <div className="grid grid-cols-6 gap-2">
                  {STICKERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addSticker(s)}
                      className="grid aspect-square place-items-center rounded-[10px] border border-line bg-background text-[20px]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {selectedStickerId &&
                  (() => {
                    const selected = stickers.find((sticker) => sticker.id === selectedStickerId);
                    if (!selected) return null;
                    return (
                      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 border-t border-line pt-3">
                        <label>
                          <span className="font-mono text-[8px] tracking-[0.12em] text-inkmuted">
                            SIZE
                          </span>
                          <input
                            type="range"
                            min={0.55}
                            max={2.2}
                            step={0.05}
                            value={selected.scale}
                            onChange={(event) =>
                              transformSticker(selected.id, {
                                rot: selected.rot,
                                scale: Number(event.target.value),
                              })
                            }
                            className="block w-full accent-accent"
                          />
                        </label>
                        <label>
                          <span className="font-mono text-[8px] tracking-[0.12em] text-inkmuted">
                            ROTATE
                          </span>
                          <input
                            type="range"
                            min={-180}
                            max={180}
                            value={selected.rot}
                            onChange={(event) =>
                              transformSticker(selected.id, {
                                rot: Number(event.target.value),
                                scale: selected.scale,
                              })
                            }
                            className="block w-full accent-accent"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeSticker(selected.id)}
                          className="rounded-full border border-line px-3 py-2 font-mono text-[9px] text-accent"
                        >
                          DELETE
                        </button>
                      </div>
                    );
                  })()}
              </div>
            )}

            {tool === "voice" && (
              <VoiceRecorder
                audioUrl={audioUrl}
                seconds={audioSeconds}
                onRecorded={(blob, secs) => {
                  if (audioUrl) URL.revokeObjectURL(audioUrl);
                  setAudio(blob);
                  setAudioUrl(URL.createObjectURL(blob));
                  setAudioSeconds(secs);
                }}
                onClear={() => {
                  if (audioUrl) URL.revokeObjectURL(audioUrl);
                  setAudio(null);
                  setAudioUrl(null);
                  setAudioSeconds(0);
                }}
              />
            )}
          </section>
        )}

        {/* ---------------- Step 3: send ---------------- */}
        {step === 2 && (
          <section className="rise mt-4 space-y-3">
            {!slug ? (
              <>
                <div className="tool-chip rounded-[14px] p-3.5">
                  <p className="font-mono text-[9px] tracking-[0.18em] text-inkmuted">
                    READY TO POST
                  </p>
                  <ul className="mt-2 space-y-1 text-[12px]">
                    <li>Photo · {photo ? "attached" : "none"}</li>
                    <li>Ink drawing · {drawing ? "added" : "none"}</li>
                    <li>Stickers · {stickers.length}</li>
                    <li>
                      Voice note · {audio ? `0:${String(audioSeconds).padStart(2, "0")}` : "none"}
                    </li>
                  </ul>
                </div>
                {error && (
                  <p className="rounded-[10px] bg-destructive/10 p-2.5 text-[12px] text-destructive">
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending}
                  className="w-full rounded-[14px] bg-accent py-4 font-display text-[14px] tracking-tight text-accent-foreground disabled:opacity-60"
                >
                  {sending ? "STAMPING…" : "STAMP & GET LINK"}
                </button>
              </>
            ) : (
              <>
                <div className="tool-chip rounded-[14px] p-3.5">
                  <p className="font-mono text-[9px] tracking-[0.18em] text-inkmuted">SHARE LINK</p>
                  <p className="mt-1 break-all font-mono text-[12px]">{shareUrl}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={copyLink}
                      className="flex-1 rounded-[10px] bg-ink py-2.5 text-[12px] font-semibold text-cream"
                    >
                      {copied ? "Copied" : "Copy link"}
                    </button>
                    <Link
                      to="/p/$slug"
                      params={{ slug }}
                      className="flex-1 rounded-[10px] bg-accent py-2.5 text-center text-[12px] font-semibold text-accent-foreground"
                    >
                      Open postcard
                    </Link>
                  </div>
                </div>
                <p className="text-center font-mono text-[9px] tracking-[0.14em] text-inkmuted">
                  A PRINTABLE VERSION LIVES ON THE POSTCARD PAGE
                </p>
              </>
            )}
          </section>
        )}
      </main>

      {/* ---------------- Tool dock ---------------- */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] px-3 pb-3">
        <div className="pop rounded-[20px] bg-ink text-cream shadow-lg">
          <div className="flex items-center justify-around px-2 py-2.5">
            <DockButton glyph="📷" label="SNAP" onClick={() => cameraRef.current?.click()} />
            <DockButton glyph="🖼️" label="UPLOAD" onClick={() => uploadRef.current?.click()} />
            <DockButton
              glyph="⇄"
              label="FLIP"
              onClick={() => setFace(face === "front" ? "back" : "front")}
            />
            {step < 2 ? (
              <DockButton
                glyph="→"
                label={step === 0 ? "CUSTOMIZE" : "SEND"}
                accent
                onClick={() => {
                  setStep(step + 1);
                  setFace(step === 0 ? "back" : "front");
                  if (step === 0) setTool("write");
                }}
              />
            ) : (
              <DockButton glyph="＋" label="NEW" accent onClick={() => window.location.reload()} />
            )}
          </div>
        </div>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => pickPhoto(e.target.files?.[0])}
      />
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pickPhoto(e.target.files?.[0])}
      />
    </div>
  );
}

function DockButton({
  glyph,
  label,
  onClick,
  accent,
}: {
  glyph: string;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 ${
        accent ? "bg-accent text-accent-foreground" : ""
      }`}
    >
      <span className="text-[19px] leading-none">{glyph}</span>
      <span className={`font-mono text-[8px] tracking-wide ${accent ? "" : "text-cream/70"}`}>
        {label}
      </span>
    </button>
  );
}
