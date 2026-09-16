import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StepRail } from "@/components/postal/StepRail";
import { PostcardBack, PostcardFront } from "@/components/postal/PostcardFace";
import { DrawLayer, type DrawLayerHandle } from "@/components/postal/DrawLayer";
import { VoiceRecorder } from "@/components/postal/VoiceRecorder";
import { Postcard3DViewer } from "@/components/postal/Postcard3DViewer";
import { AuthGate } from "@/components/auth/AuthGate";
import { mailPostcard } from "@/lib/secure-mail";
import { STICKERS, TEMPLATES, templateById, type Sticker, type TemplateId } from "@/lib/postcard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Paravoy — Make a Digital Postcard in Three Steps" },
      {
        name: "description",
        content:
          "Create, stamp, and mail an interactive digital postcard that travels before it arrives.",
      },
      { property: "og:title", content: "Paravoy — Make a Digital Postcard" },
      {
        property: "og:description",
        content: "Photo, handwriting, stickers, stamps and a voice note—delivered like real mail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthenticatedStudio,
});

type Tool = "write" | "draw" | "stickers" | "voice";

function AuthenticatedStudio() {
  return <AuthGate>{(session) => <Studio userId={session.user.id} />}</AuthGate>;
}

function Studio({ userId }: { userId: string }) {
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
  const [recipientEmail, setRecipientEmail] = useState("");
  const [note, setNote] = useState("");
  const [originLabel, setOriginLabel] = useState("");
  const [originPostalCode, setOriginPostalCode] = useState("");
  const [destinationLabel, setDestinationLabel] = useState("");
  const [destinationPostalCode, setDestinationPostalCode] = useState("");
  const [stampId, setStampId] = useState("classic-airmail");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioSeconds, setAudioSeconds] = useState(0);

  const [sending, setSending] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null);
  const [estimatedDelivery, setEstimatedDelivery] = useState<string | null>(null);
  const [recipientNotice, setRecipientNotice] = useState<
    "EMAIL_INVITED" | "IN_APP" | "INVITE_FAILED" | null
  >(null);
  const [confirming, setConfirming] = useState(false);
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

  async function handleMail() {
    setSending(true);
    setError(null);
    try {
      const result = await mailPostcard(
        userId,
        {
          template,
          message,
          sender,
          recipient,
          note,
          stickers,
          photo,
          drawingDataUrl: drawing,
          audio,
        },
        {
          recipientEmail,
          originLabel,
          originPostalCode,
          destinationLabel,
          destinationPostalCode,
          stampId,
        },
      );
      setTrackingNumber(result.tracking_number);
      setEstimatedDelivery(result.estimated_delivery_at);
      setRecipientNotice(result.recipientNotice);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong mailing your postcard.");
      setConfirming(false);
    } finally {
      setSending(false);
    }
  }

  function requestMailConfirmation() {
    if (
      !recipient ||
      !recipientEmail ||
      !sender ||
      !originLabel ||
      !originPostalCode ||
      !destinationLabel ||
      !destinationPostalCode ||
      !stampId
    ) {
      setError(
        "Add the sender, recipient, email, both locations, ZIP codes, and a stamp before mailing.",
      );
      return;
    }
    setError(null);
    setConfirming(true);
  }

  async function copyTrackingNumber() {
    try {
      if (!trackingNumber) return;
      await navigator.clipboard.writeText(trackingNumber);
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
      <StepRail step={step} onJump={(i) => !trackingNumber && setStep(i)} />

      <main className="flex-1 px-4 pt-3 pb-40">
        {/* ---------------- Card canvas ---------------- */}
        <div className="card-in relative">
          <span className="absolute -top-1.5 left-6 z-10 size-7 -rotate-6 rounded-full bg-accent/85 shadow-sm" />
          <span className="absolute -top-1.5 right-6 z-10 size-7 rotate-6 rounded-full bg-navy/85 shadow-sm" />
          {trackingNumber ? (
            <div className="postcard-surface grid aspect-3/2 place-items-center overflow-hidden rounded-[14px] bg-secondary text-center">
              <div>
                <p className="text-[36px]">✉</p>
                <p className="mt-2 font-display text-[17px] tracking-tight">
                  NO LONGER IN YOUR HANDS
                </p>
                <p className="mt-1 text-[11px] text-inkmuted">
                  Your postcard is traveling to {recipient}.
                </p>
              </div>
            </div>
          ) : (
            <Postcard3DViewer
              front={postcardFront}
              back={postcardBack}
              face={face}
              interactionLocked={editingSurface}
              onFaceChange={setFace}
            />
          )}
        </div>

        <button
          type="button"
          onClick={() => !trackingNumber && setFace(face === "front" ? "back" : "front")}
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
            {!trackingNumber ? (
              <>
                <div className="tool-chip space-y-3 rounded-[14px] p-3.5">
                  <p className="font-mono text-[9px] tracking-[0.18em] text-inkmuted">
                    ADDRESS THE POSTCARD
                  </p>
                  <label className="block">
                    <span className="font-mono text-[8px] tracking-[0.14em] text-inkmuted">
                      RECIPIENT EMAIL
                    </span>
                    <input
                      required
                      type="email"
                      value={recipientEmail}
                      onChange={(event) => setRecipientEmail(event.target.value)}
                      placeholder="sarah@example.com"
                      className="mt-1 w-full rounded-[10px] border border-line bg-background px-3 py-2.5 text-[13px] outline-none focus:border-accent"
                    />
                  </label>
                  <div className="grid grid-cols-[1fr_92px] gap-2">
                    <label>
                      <span className="font-mono text-[8px] tracking-[0.14em] text-inkmuted">
                        FROM CITY, STATE
                      </span>
                      <input
                        value={originLabel}
                        onChange={(event) => setOriginLabel(event.target.value)}
                        placeholder="Dallas, TX"
                        className="mt-1 w-full rounded-[10px] border border-line bg-background px-3 py-2.5 text-[13px] outline-none focus:border-accent"
                      />
                    </label>
                    <label>
                      <span className="font-mono text-[8px] tracking-[0.14em] text-inkmuted">
                        ZIP
                      </span>
                      <input
                        inputMode="numeric"
                        value={originPostalCode}
                        onChange={(event) => setOriginPostalCode(event.target.value)}
                        placeholder="75201"
                        className="mt-1 w-full rounded-[10px] border border-line bg-background px-3 py-2.5 text-[13px] outline-none focus:border-accent"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-[1fr_92px] gap-2">
                    <label>
                      <span className="font-mono text-[8px] tracking-[0.14em] text-inkmuted">
                        TO CITY, STATE
                      </span>
                      <input
                        value={destinationLabel}
                        onChange={(event) => setDestinationLabel(event.target.value)}
                        placeholder="Phoenix, AZ"
                        className="mt-1 w-full rounded-[10px] border border-line bg-background px-3 py-2.5 text-[13px] outline-none focus:border-accent"
                      />
                    </label>
                    <label>
                      <span className="font-mono text-[8px] tracking-[0.14em] text-inkmuted">
                        ZIP
                      </span>
                      <input
                        inputMode="numeric"
                        value={destinationPostalCode}
                        onChange={(event) => setDestinationPostalCode(event.target.value)}
                        placeholder="85001"
                        className="mt-1 w-full rounded-[10px] border border-line bg-background px-3 py-2.5 text-[13px] outline-none focus:border-accent"
                      />
                    </label>
                  </div>
                </div>
                <div className="tool-chip rounded-[14px] p-3.5">
                  <p className="font-mono text-[9px] tracking-[0.18em] text-inkmuted">
                    SELECT A STAMP
                  </p>
                  <button
                    type="button"
                    onClick={() => setStampId("classic-airmail")}
                    className={`mt-3 flex w-full items-center gap-3 rounded-[12px] border p-3 text-left ${stampId === "classic-airmail" ? "border-accent bg-accent/5" : "border-line"}`}
                  >
                    <span className="grid h-[58px] w-[48px] place-items-center rounded bg-cream font-display text-[22px] text-accent shadow-sm">
                      5
                    </span>
                    <span>
                      <span className="block text-[13px] font-semibold">Classic Airmail</span>
                      <span className="text-[10px] text-inkmuted">Free starter stamp</span>
                    </span>
                  </button>
                </div>
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
                  onClick={requestMailConfirmation}
                  disabled={sending}
                  className="w-full rounded-[14px] bg-accent py-4 font-display text-[14px] tracking-tight text-accent-foreground disabled:opacity-60"
                >
                  MAIL POSTCARD
                </button>
              </>
            ) : (
              <>
                <div className="tool-chip rounded-[14px] p-3.5">
                  <p className="font-mono text-[9px] tracking-[0.18em] text-inkmuted">
                    POSTCARD MAILED
                  </p>
                  <p className="mt-1 font-mono text-[14px] font-bold">{trackingNumber}</p>
                  {estimatedDelivery && (
                    <p className="mt-2 text-[11px] text-inkmuted">
                      Expected {new Date(estimatedDelivery).toLocaleDateString()}
                    </p>
                  )}
                  {recipientNotice === "EMAIL_INVITED" && (
                    <p className="mt-2 text-[11px] text-inkmuted">
                      A private claim invitation was emailed to {recipientEmail}.
                    </p>
                  )}
                  {recipientNotice === "IN_APP" && (
                    <p className="mt-2 text-[11px] text-inkmuted">
                      It is waiting in the recipient’s Paravoy mailbox.
                    </p>
                  )}
                  {recipientNotice === "INVITE_FAILED" && (
                    <p className="mt-2 rounded-[9px] bg-destructive/10 p-2 text-[11px] text-destructive">
                      The postcard was mailed, but the email invitation could not be sent. Keep the
                      tracking number so you can share it with the recipient.
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={copyTrackingNumber}
                      className="flex-1 rounded-[10px] bg-ink py-2.5 text-[12px] font-semibold text-cream"
                    >
                      {copied ? "Copied" : "Copy tracking #"}
                    </button>
                    <Link
                      to="/track/$trackingNumber"
                      params={{ trackingNumber }}
                      className="flex-1 rounded-[10px] bg-accent py-2.5 text-center text-[12px] font-semibold text-accent-foreground"
                    >
                      Track postcard
                    </Link>
                  </div>
                </div>
                <p className="text-center font-mono text-[9px] tracking-[0.14em] text-inkmuted">
                  CONTENTS STAY SEALED UNTIL DELIVERY
                </p>
              </>
            )}
          </section>
        )}
      </main>

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 px-5 backdrop-blur-sm">
          <div className="postcard-surface w-full max-w-[390px] rounded-[18px] p-5">
            <p className="font-display text-[21px] tracking-tight">READY TO MAIL IT?</p>
            <p className="mt-2 text-[13px] leading-relaxed text-inkmuted">
              Just like real mail, once this postcard is mailed, you won’t be able to open it again.
              It becomes the receiver’s postcard.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={sending}
                onClick={() => setConfirming(false)}
                className="rounded-[12px] border border-line py-3 text-[12px] font-semibold"
              >
                Keep editing
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={handleMail}
                className="rounded-[12px] bg-accent py-3 text-[12px] font-semibold text-accent-foreground disabled:opacity-60"
              >
                {sending ? "MAILING…" : "Mail it"}
              </button>
            </div>
          </div>
        </div>
      )}

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
            {trackingNumber ? (
              <DockButton
                glyph="▣"
                label="MAILBOX"
                accent
                onClick={() => {
                  window.location.href = "/mailbox";
                }}
              />
            ) : step < 2 ? (
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
              <DockButton glyph="✉" label="MAIL" accent onClick={requestMailConfirmation} />
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
