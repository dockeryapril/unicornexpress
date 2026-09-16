import { useRef } from "react";
import { AirmailEdge } from "./AirmailEdge";
import { formatPostmark, type Sticker, type Template } from "@/lib/postcard";

type FrontProps = {
  template: Template;
  photoUrl: string | null;
  drawingUrl: string | null;
  stickers: Sticker[];
  onMoveSticker?: ((id: string, x: number, y: number) => void) | undefined;
  onRemoveSticker?: ((id: string) => void) | undefined;
  onSelectSticker?: ((id: string) => void) | undefined;
  selectedStickerId?: string | null;
  children?: React.ReactNode | undefined;
  fill?: boolean;
};

export function PostcardFront({
  template,
  photoUrl,
  drawingUrl,
  stickers,
  onMoveSticker,
  onRemoveSticker,
  onSelectSticker,
  selectedStickerId,
  children,
  fill = false,
}: FrontProps) {
  const areaRef = useRef<HTMLDivElement>(null);

  function startDrag(e: React.PointerEvent, id: string) {
    if (!onMoveSticker) return;
    e.preventDefault();
    e.stopPropagation();
    const area = areaRef.current;
    if (!area) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const rect = area.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 100;
      const y = ((ev.clientY - rect.top) / rect.height) * 100;
      onMoveSticker(id, Math.min(96, Math.max(4, x)), Math.min(94, Math.max(6, y)));
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  }

  return (
    <div
      className={`postcard-surface overflow-hidden rounded-[14px] ${template.cardClass} ${
        fill ? "flex size-full flex-col" : ""
      }`}
    >
      <AirmailEdge edge={template.edge} />
      <div
        ref={areaRef}
        className={`relative w-full touch-none overflow-hidden ${fill ? "min-h-0 flex-1" : "aspect-3/2"}`}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Postcard photograph"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="papergrain absolute inset-0 grid place-items-center bg-secondary">
            <span className="font-mono text-[10px] tracking-[0.2em] text-inkmuted">
              NO PHOTO YET
            </span>
          </div>
        )}

        {drawingUrl && (
          <img
            src={drawingUrl}
            alt="Handwritten ink"
            className="pointer-events-none absolute inset-0 size-full object-contain"
          />
        )}

        {stickers.map((s) => (
          <button
            key={s.id}
            type="button"
            onPointerDown={(e) => startDrag(e, s.id)}
            onClick={(e) => {
              e.stopPropagation();
              onSelectSticker?.(s.id);
            }}
            onDoubleClick={() => onRemoveSticker?.(s.id)}
            className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center text-[30px] leading-none select-none ${
              onMoveSticker ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
            }`}
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              transform: `translate(-50%,-50%) rotate(${s.rot}deg) scale(${s.scale})`,
            }}
            aria-label={`Sticker ${s.char}`}
          >
            {selectedStickerId === s.id && (
              <span className="pointer-events-none absolute -inset-2 rounded-md border border-dashed border-cream drop-shadow" />
            )}
            {s.char}
          </button>
        ))}

        {children}
      </div>
      <AirmailEdge edge={template.edge} />
    </div>
  );
}

type BackProps = {
  template: Template;
  message: string;
  sender: string;
  recipient: string;
  note: string;
  createdAt?: string;
  stamped?: boolean;
  fill?: boolean;
};

export function PostcardBack({
  template,
  message,
  sender,
  recipient,
  note,
  createdAt,
  stamped = true,
  fill = false,
}: BackProps) {
  return (
    <div
      className={`postcard-surface overflow-hidden rounded-[14px] ${template.cardClass} ${
        fill ? "flex size-full flex-col" : ""
      }`}
    >
      <AirmailEdge edge={template.edge} />
      <div className={`p-4 ${fill ? "min-h-0 flex-1" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={`font-hand text-[30px] leading-[0.98] break-words ${template.handClass}`}>
              {message || "Your handwriting lands here…"}
            </p>
            <p className={`mt-2 font-mono text-[9px] tracking-[0.2em] ${template.metaClass}`}>
              — {(sender || "UNSIGNED").toUpperCase()}
              {createdAt ? `, ${formatPostmark(createdAt)}` : ""}
            </p>
          </div>

          <div className="shrink-0 text-center">
            <div
              className={`relative grid h-[74px] w-[62px] place-items-center rounded-[4px] ${template.stampClass} ${
                stamped ? "stamp-in" : ""
              }`}
              style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.18)" }}
            >
              <div className="absolute inset-[5px] rounded-[2px] border border-dashed border-current opacity-50" />
              <span className="font-display text-[26px] leading-none">5</span>
            </div>
            <span className={`font-mono text-[7px] tracking-[0.15em] ${template.metaClass}`}>
              AIR MAIL
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <div className="border-b border-current/20 pb-0.5">
              <span className={`font-mono text-[8px] tracking-[0.18em] ${template.metaClass}`}>
                TO
              </span>
              <p className={`font-hand text-[20px] leading-tight ${template.handClass}`}>
                {recipient || "—"}
              </p>
            </div>
            <div className="border-b border-current/20 pb-0.5">
              <p className={`font-hand text-[18px] leading-tight ${template.handClass}`}>
                {note || " "}
              </p>
            </div>
          </div>
        </div>
      </div>
      <AirmailEdge edge={template.edge} />
    </div>
  );
}
