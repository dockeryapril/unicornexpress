const STEPS = ["Create", "Customize", "Send"] as const;

export function StepRail({ step, onJump }: { step: number; onJump?: (i: number) => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-display text-[15px] tracking-tight">PARAVOY</span>
          <span className="rounded-full border border-line px-1.5 py-0.5 font-mono text-[9px] text-inkmuted">
            EST. 1974
          </span>
        </div>
        <span className="font-mono text-[10px] font-bold text-accent">
          STEP 0{step + 1} / 03
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-4 pb-2.5">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            {i > 0 && <span className="h-px w-4 bg-line sm:w-8" />}
            <button
              type="button"
              disabled={!onJump || i > step}
              onClick={() => onJump?.(i)}
              className="flex items-center gap-1.5"
            >
              <span
                className={`grid size-5 place-items-center rounded-full font-mono text-[9px] font-bold ${
                  i === step
                    ? "bg-accent text-accent-foreground"
                    : i < step
                      ? "bg-ink text-cream"
                      : "border border-line text-inkmuted"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-[11px] ${
                  i === step
                    ? "font-semibold text-accent"
                    : i < step
                      ? "font-semibold text-foreground"
                      : "text-inkmuted"
                }`}
              >
                {label}
              </span>
            </button>
          </div>
        ))}
      </div>
    </header>
  );
}
