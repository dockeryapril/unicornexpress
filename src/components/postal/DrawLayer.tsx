import { useEffect, useRef } from "react";

const W = 1200;
const H = 800;

export type DrawLayerHandle = {
  clear: () => void;
  export: () => string | null;
};

type Props = {
  color: string;
  size: number;
  enabled: boolean;
  onChange: (dataUrl: string | null) => void;
  registerHandle: (handle: DrawLayerHandle) => void;
};

export function DrawLayer({ color, size, enabled, onChange, registerHandle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    registerHandle({
      clear: () => {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, W, H);
        dirty.current = false;
        onChange(null);
      },
      export: () => (dirty.current ? canvas.toDataURL("image/png") : null),
    });
  }, [registerHandle, onChange]);

  function point(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function begin(e: React.PointerEvent) {
    if (!enabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = point(e);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e: React.PointerEvent) {
    if (!enabled || !drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    dirty.current = true;
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && dirty.current) onChange(canvas.toDataURL("image/png"));
  }

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className={`absolute inset-0 size-full touch-none ${
        enabled ? "cursor-crosshair" : "pointer-events-none"
      }`}
    />
  );
}
