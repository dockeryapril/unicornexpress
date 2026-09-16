/**
 * Product-level mail concepts. This module is deliberately UI and database agnostic so the
 * simulation can be replaced without rebuilding tracking screens or postcard composition.
 */
export const POSTCARD_STATUSES = [
  "DRAFT",
  "READY_TO_MAIL",
  "MAILED",
  "ACCEPTED",
  "ORIGIN_PROCESSING",
  "IN_TRANSIT",
  "DESTINATION_PROCESSING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "OPENED",
] as const;

export type PostcardStatus = (typeof POSTCARD_STATUSES)[number];
export type PostageClass = "STANDARD_DIGITAL_POST" | "EXPRESS_DIGITAL_POST" | "SPECIAL_DELIVERY";
export type PostcardRole = "sender" | "receiver" | "visitor";

export type TrackingEvent = {
  id: string;
  status: PostcardStatus;
  occurredAt: string;
  locationLabel?: string;
  detail?: string;
  delayCode?: "WEATHER" | "HOLIDAY" | "TRANSIT";
};

export type MailRouteStop = {
  kind: "ORIGIN" | "ORIGIN_PROCESSING" | "TRANSIT" | "DESTINATION_PROCESSING" | "DESTINATION";
  label: string;
  latitude?: number;
  longitude?: number;
};

export type MailMetadata = {
  trackingNumber: string;
  status: PostcardStatus;
  postageClass: PostageClass;
  mailedAt: string;
  estimatedDeliveryAt: string;
  deliveredAt?: string;
  openedAt?: string;
  originLabel: string;
  destinationLabel: string;
};

export function makeTrackingNumber(random: () => number = Math.random) {
  const group = () => String(Math.floor(random() * 10_000)).padStart(4, "0");
  return `PC-${group()}-${group()}-${group()}`;
}

export function canRetrievePostcardContents(role: PostcardRole, status: PostcardStatus) {
  if (role === "sender") return status === "DRAFT" || status === "READY_TO_MAIL";
  if (role === "receiver") return status === "DELIVERED" || status === "OPENED";
  return false;
}

export function canTrackPostcard(role: PostcardRole) {
  return role === "sender" || role === "receiver";
}

export function isMailed(status: PostcardStatus) {
  return POSTCARD_STATUSES.indexOf(status) >= POSTCARD_STATUSES.indexOf("MAILED");
}

export function isDelivered(status: PostcardStatus) {
  return status === "DELIVERED" || status === "OPENED";
}
