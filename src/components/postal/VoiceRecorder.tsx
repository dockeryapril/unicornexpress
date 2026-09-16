import { useEffect, useRef, useState } from "react";

const BARS = [2, 5, 3, 6, 4, 7, 3, 5, 2, 4, 6, 3, 5, 2, 4, 6];
const MAX_SECONDS = 30;

type Props = {
  audioUrl: string | null;
  seconds: number;
  onRecorded: (blob: Blob, seconds: number) => void;
  onClear: () => void;
};

export function VoiceRecorder({ audioUrl, seconds, onRecorded, onClear }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function stop() {
    recorderRef.current?.state === "recording" && recorderRef.current.stop();
  }

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      let count = 0;

      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false);
        setElapsed(0);
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 1024) onRecorded(blob, count);
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      timerRef.current = setInterval(() => {
        count += 1;
        setElapsed(count);
        if (count >= MAX_SECONDS) stop();
      }, 1000);
    } catch {
      setError("Microphone access was blocked. Allow it in your browser to record.");
    }
  }

  const label = recording
    ? `0:${String(elapsed).padStart(2, "0")}`
    : audioUrl
      ? `0:${String(seconds).padStart(2, "0")}`
      : "0:00";

  return (
    <div className="space-y-2">
      <div className="tool-chip flex h-14 items-center gap-3 rounded-[14px] px-3.5">
        <button
          type="button"
          onClick={recording ? stop : start}
          aria-label={recording ? "Stop recording" : "Record a voice note"}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"
        >
          {recording ? (
            <span className="size-2.5 rounded-[2px] bg-accent-foreground" />
          ) : (
            <span className="rec-dot size-2.5 rounded-full bg-accent-foreground" />
          )}
        </button>

        <div className="flex h-7 flex-1 items-center gap-[3px]">
          {BARS.map((h, i) => (
            <span
              key={i}
              className={`w-[3px] rounded-full ${i % 5 === 3 ? "bg-accent" : "bg-ink/70"} ${
                recording ? "wavebar" : ""
              }`}
              style={{ height: `${h * 4}px`, animationDelay: `${i * 70}ms` }}
            />
          ))}
        </div>

        <span className="shrink-0 font-mono text-[11px] font-bold text-accent">{label}</span>
      </div>

      {audioUrl && !recording && (
        <div className="flex items-center gap-2">
          <audio controls src={audioUrl} className="h-9 w-full" />
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 font-mono text-[10px] tracking-[0.14em] text-inkmuted underline"
          >
            REMOVE
          </button>
        </div>
      )}

      <p className="font-mono text-[9px] tracking-[0.14em] text-inkmuted">
        {error ?? `UP TO ${MAX_SECONDS}s OF YOUR VOICE`}
      </p>
    </div>
  );
}
