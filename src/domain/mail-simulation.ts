import type { MailRouteStop, PostageClass, PostcardStatus } from "./mail";

export type SimulatedMailInput = {
  mailedAt: Date;
  approximateDistanceMiles?: number;
  postageClass?: PostageClass;
  originLabel: string;
  destinationLabel: string;
  originProcessingLabel?: string;
  destinationProcessingLabel?: string;
};

const TRANSIT_STATUSES: Exclude<PostcardStatus, "DRAFT" | "READY_TO_MAIL" | "OPENED">[] = [
  "MAILED",
  "ACCEPTED",
  "ORIGIN_PROCESSING",
  "IN_TRANSIT",
  "DESTINATION_PROCESSING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

function addBusinessDays(start: Date, days: number) {
  const date = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return date;
}

export function estimateDeliveryDate({
  mailedAt,
  approximateDistanceMiles = 600,
  postageClass = "STANDARD_DIGITAL_POST",
}: SimulatedMailInput) {
  const distanceDays = approximateDistanceMiles < 250 ? 1 : approximateDistanceMiles < 900 ? 2 : 3;
  const classAdjustment =
    postageClass === "EXPRESS_DIGITAL_POST" ? -1 : postageClass === "SPECIAL_DELIVERY" ? 1 : 0;
  const businessDays = Math.max(1, Math.min(5, distanceDays + classAdjustment));
  return addBusinessDays(mailedAt, businessDays);
}

export function buildSimulatedRoute(input: SimulatedMailInput): MailRouteStop[] {
  return [
    { kind: "ORIGIN", label: input.originLabel },
    {
      kind: "ORIGIN_PROCESSING",
      label: input.originProcessingLabel ?? `${input.originLabel} processing region`,
    },
    { kind: "TRANSIT", label: "Digital mail transit" },
    {
      kind: "DESTINATION_PROCESSING",
      label: input.destinationProcessingLabel ?? `${input.destinationLabel} processing region`,
    },
    { kind: "DESTINATION", label: input.destinationLabel },
  ];
}

export function statusForProgress(progress: number) {
  const clamped = Math.max(0, Math.min(1, progress));
  const index = Math.min(
    TRANSIT_STATUSES.length - 1,
    Math.floor(clamped * TRANSIT_STATUSES.length),
  );
  return TRANSIT_STATUSES[index]!;
}

export function simulateMail(input: SimulatedMailInput, now = new Date()) {
  const estimatedDeliveryAt = estimateDeliveryDate(input);
  const total = Math.max(1, estimatedDeliveryAt.getTime() - input.mailedAt.getTime());
  const elapsed = now.getTime() - input.mailedAt.getTime();
  const progress = Math.max(0, Math.min(1, elapsed / total));

  return {
    estimatedDeliveryAt,
    route: buildSimulatedRoute(input),
    progress,
    status: statusForProgress(progress),
  };
}
