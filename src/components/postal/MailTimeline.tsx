import { statusLabel, transitTimeline } from "@/lib/secure-mail-read";
import type { PostcardStatus } from "@/domain/mail";

export function MailTimeline({ status }: { status: PostcardStatus }) {
  return (
    <ol className="space-y-0">
      {transitTimeline(status).map((step, index, all) => (
        <li key={step.status} className="grid grid-cols-[24px_1fr] gap-3">
          <div className="flex flex-col items-center">
            <span
              className={`grid size-5 place-items-center rounded-full border text-[9px] ${
                step.complete
                  ? "border-navy bg-navy text-cream"
                  : step.current
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-line bg-card text-inkmuted"
              }`}
            >
              {step.complete ? "✓" : step.current ? "●" : "○"}
            </span>
            {index < all.length - 1 && (
              <span className={`h-8 w-px ${step.complete ? "bg-navy" : "bg-line"}`} />
            )}
          </div>
          <p
            className={`pt-0.5 text-[12px] font-semibold ${
              step.current ? "text-accent" : step.complete ? "text-foreground" : "text-inkmuted"
            }`}
          >
            {statusLabel(step.status)}
          </p>
        </li>
      ))}
    </ol>
  );
}
