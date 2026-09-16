import { useCallback, useEffect, useRef } from "react";

const W = 1200;
const H = 800;

export type DrawLayerHandle = {
  clear: () => void;
  export: () => string | null;
  undo: () => void;
  redo: () => void;
};

type Props = {
  color: string;
  size: number;
  enabled: boolean;
  mode?: "pen" | "eraser";
  initialDataUrl?: string | null;
  onChange: (dataUrl: string | null) => void;
  registerHandle: (handle: DrawLayerHandle) => void;
};

export function DrawLayer({
  color,
  size,
  enabled,
  mode = "pen",
  initialDataUrl = null,
  onChange,
  registerHandle,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const initialDrawing = useRef(initialDataUrl);
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);

  const restore = useCallback(
    (dataUrl: string | null) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, W, H);
      if (!dataUrl) {
        dirty.current = false;
        onChange(null);
        return;
      }
      const image = new Image();
      image.onload = () => {
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(image, 0, 0, W, H);
        dirty.current = true;
        onChange(dataUrl);
      };
      image.src = dataUrl;
    },
    [onChange],
  );

  function snapshot() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    history.current = history.current.slice(0, historyIndex.current + 1);
    history.current.push(dataUrl);
    historyIndex.current = history.current.length - 1;
    onChange(dataUrl);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    registerHandle({
      clear: () => {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, W, H);
        dirty.current = false;
        history.current = [];
        historyIndex.current = -1;
        onChange(null);
      },
      export: () => (dirty.current ? canvas.toDataURL("image/png") : null),
      undo: () => {
        if (historyIndex.current < 0) return;
        historyIndex.current -= 1;
        restore(historyIndex.current >= 0 ? history.current[historyIndex.current]! : null);
      },
      redo: () => {
        if (historyIndex.current >= history.current.length - 1) return;
        historyIndex.current += 1;
        restore(history.current[historyIndex.current]!);
      },
    });

    if (initialDrawing.current) {
      const image = new Image();
      image.onload = () => {
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(image, 0, 0, W, H);
        dirty.current = true;
        history.current = [initialDrawing.current!];
        historyIndex.current = 0;
      };
      image.src = initialDrawing.current;
    }
  }, [registerHandle, onChange, restore]);

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
    ctx.globalCompositeOperation = mode === "eraser" ? "destination-out" : "source-over";
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
    if (canvas && dirty.current) snapshot();
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
        enabled ? (mode === "eraser" ? "cursor-cell" : "cursor-crosshair") : "pointer-events-none"
      }`}
    />
  );
}
