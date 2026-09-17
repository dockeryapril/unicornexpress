import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  front: ReactNode;
  back: ReactNode;
  /** Disables card rotation while a composer tool needs the pointer. */
  interactionLocked?: boolean;
  /** Receiver/viewer mode can use a deliberate tap to turn the card over. */
  tapToFlip?: boolean;
  face?: "front" | "back";
  onFaceChange?: (face: "front" | "back") => void;
  className?: string;
};

const MAX_TILT = 14;
const DRAG_TO_DEGREES = 0.55;

function nearestFace(rotation: number) {
  return Math.round(rotation / 180) * 180;
}

export function Postcard3DViewer({
  front,
  back,
  interactionLocked = false,
  tapToFlip = false,
  face,
  onFaceChange,
  className = "",
}: Props) {
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const motion = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    startRotationX: 0,
    startRotationY: 0,
    lastX: 0,
    lastTime: 0,
    velocityY: 0,
    moved: false,
  });

  const reportFace = useCallback(
    (degrees: number) => {
      const normalized = ((nearestFace(degrees) % 360) + 360) % 360;
      onFaceChange?.(normalized === 180 ? "back" : "front");
    },
    [onFaceChange],
  );

  const flip = useCallback(() => {
    if (interactionLocked) return;
    setRotationX(0);
    setRotationY((current) => {
      const snapped = nearestFace(current);
      const next = snapped + 180;
      reportFace(next);
      return next;
    });
  }, [interactionLocked, reportFace]);

  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (interactionLocked || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    motion.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRotationX: rotationX,
      startRotationY: rotationY,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocityY: 0,
      moved: false,
    };
    setDragging(true);
  }

  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || event.pointerId !== motion.current.pointerId) return;
    const deltaX = event.clientX - motion.current.startX;
    const deltaY = event.clientY - motion.current.startY;
    const now = performance.now();
    const elapsed = Math.max(1, now - motion.current.lastTime);
    motion.current.velocityY = ((event.clientX - motion.current.lastX) / elapsed) * 14;
    motion.current.lastX = event.clientX;
    motion.current.lastTime = now;
    motion.current.moved ||= Math.abs(deltaX) + Math.abs(deltaY) > 6;

    setRotationY(motion.current.startRotationY + deltaX * DRAG_TO_DEGREES);
    setRotationX(
      Math.max(-MAX_TILT, Math.min(MAX_TILT, motion.current.startRotationX - deltaY * 0.16)),
    );
  }

  function releasePointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || event.pointerId !== motion.current.pointerId) return;
    setDragging(false);
    setRotationX(0);

    if (!motion.current.moved && tapToFlip) {
      flip();
      return;
    }

    setRotationY((current) => {
      const projected = current + motion.current.velocityY * 7;
      const next = nearestFace(projected);
      reportFace(next);
      return next;
    });
  }

  useEffect(() => {
    if (!interactionLocked) return;
    setDragging(false);
    setRotationX(0);
  }, [interactionLocked]);

  useEffect(() => {
    if (!face) return;
    setRotationX(0);
    setRotationY((current) => {
      const snapped = nearestFace(current);
      const normalized = ((snapped % 360) + 360) % 360;
      const alreadyShowingFace = face === "back" ? normalized === 180 : normalized === 0;
      return alreadyShowingFace ? snapped : snapped + 180;
    });
  }, [face]);

  return (
    <div
      className={`relative aspect-3/2 w-full ${className}`}
      style={{ perspective: "1100px", WebkitPerspective: "1100px" }}
    >
      <div
        role="group"
        aria-label="Interactive postcard. Drag to turn it over."
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
        onDoubleClick={flip}
        className={`relative size-full touch-none select-none ${
          interactionLocked ? "" : dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          transform: `rotateX(${rotationX}deg) rotateY(${rotationY}deg)`,
          WebkitTransform: `rotateX(${rotationX}deg) rotateY(${rotationY}deg)`,
          transformStyle: "preserve-3d",
          WebkitTransformStyle: "preserve-3d",
          willChange: "transform",
          transition: dragging ? "none" : "transform 620ms cubic-bezier(0.2, 0.9, 0.25, 1.12)",
          filter: dragging
            ? "drop-shadow(0 24px 20px rgba(34, 27, 20, 0.2))"
            : "drop-shadow(0 14px 14px rgba(34, 27, 20, 0.13))",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(0deg) translateZ(0.1px)",
            WebkitTransform: "rotateY(0deg) translateZ(0.1px)",
          }}
        >
          {front}
        </div>
        <div
          className="absolute inset-0"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg) translateZ(0.1px)",
            WebkitTransform: "rotateY(180deg) translateZ(0.1px)",
          }}
        >
          {back}
        </div>
      </div>
    </div>
  );
}
