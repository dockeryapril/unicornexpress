import { supabase } from "@/integrations/supabase/client";
import { POSTCARD_STATUSES, type PostcardStatus } from "@/domain/mail";
import { signedUrl, type Sticker } from "@/lib/postcard";

export type TrackingCard = {
  id: string;
  tracking_number: string;
  sender_id: string;
  sender: string;
  recipient: string;
  recipient_email: string;
  status: PostcardStatus;
  postage_class: string;
  origin_label: string;
  destination_label: string;
  mailed_at: string;
  estimated_delivery_at: string;
  opened_at: string | null;
};

export type DeliveredContents = {
  postcard_id: string;
  template: string;
  message: string;
  sender_label: string;
  recipient_label: string;
  note: string;
  stickers: Sticker[];
  photo_path: string | null;
  drawing_path: string | null;
  audio_path: string | null;
  photoUrl: string | null;
  drawingUrl: string | null;
  audioUrl: string | null;
};

type QueryError = { message: string };
type QueryResult<T> = { data: T | null; error: QueryError | null };
type Query<T> = PromiseLike<QueryResult<T[]>> & {
  select: (columns?: string) => Query<T>;
  eq: (column: string, value: unknown) => Query<T>;
  order: (column: string, options?: { ascending?: boolean }) => Query<T>;
  maybeSingle: () => Promise<QueryResult<T>>;
};
type UntypedDatabase = { from: <T>(table: string) => Query<T> };
type RpcDatabase = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<QueryResult<unknown>>;
};

const database = supabase as unknown as UntypedDatabase;

const STATUS_LABELS: Record<PostcardStatus, string> = {
  DRAFT: "Draft",
  READY_TO_MAIL: "Ready to mail",
  MAILED: "Postcard mailed",
  ACCEPTED: "Accepted",
  ORIGIN_PROCESSING: "Origin processing",
  IN_TRANSIT: "In transit",
  DESTINATION_PROCESSING: "Destination processing",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  OPENED: "Opened",
};

export function statusLabel(status: PostcardStatus) {
  return STATUS_LABELS[status];
}

export function effectiveStatus(card: TrackingCard, now = new Date()): PostcardStatus {
  if (card.opened_at) return "OPENED";
  const mailed = new Date(card.mailed_at).getTime();
  const delivery = new Date(card.estimated_delivery_at).getTime();
  const current = now.getTime();
  if (current >= delivery) return "DELIVERED";
  const progress = Math.max(0, Math.min(1, (current - mailed) / Math.max(1, delivery - mailed)));
  if (progress >= 0.84) return "OUT_FOR_DELIVERY";
  if (progress >= 0.68) return "DESTINATION_PROCESSING";
  if (progress >= 0.34) return "IN_TRANSIT";
  if (current >= mailed + 3 * 60 * 60 * 1000) return "ORIGIN_PROCESSING";
  if (current >= mailed + 30 * 60 * 1000) return "ACCEPTED";
  return "MAILED";
}

export function transitTimeline(current: PostcardStatus) {
  const timeline: PostcardStatus[] = POSTCARD_STATUSES.filter(
    (status): status is PostcardStatus =>
      status !== "DRAFT" && status !== "READY_TO_MAIL" && status !== "OPENED",
  );
  const currentIndex = current === "OPENED" ? timeline.length - 1 : timeline.indexOf(current);
  return timeline.map((status, index) => ({
    status,
    complete: index < currentIndex || current === "OPENED",
    current: index === currentIndex && current !== "OPENED",
  }));
}

export async function loadTrackingCard(trackingNumber: string) {
  const { data, error } = await database
    .from<TrackingCard>("postcards")
    .select("*")
    .eq("tracking_number", trackingNumber)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function loadMailbox(userId: string, email: string) {
  const [sentResult, incomingResult] = await Promise.all([
    database
      .from<TrackingCard>("postcards")
      .select("*")
      .eq("sender_id", userId)
      .order("mailed_at", { ascending: false }),
    database
      .from<TrackingCard>("postcards")
      .select("*")
      .eq("recipient_email", email.toLowerCase())
      .order("mailed_at", { ascending: false }),
  ]);
  if (sentResult.error) throw new Error(sentResult.error.message);
  if (incomingResult.error) throw new Error(incomingResult.error.message);
  return { sent: sentResult.data ?? [], incoming: incomingResult.data ?? [] };
}

export async function openAndLoadPostcard(trackingNumber: string, postcardId: string) {
  const { error: openError } = await (supabase as unknown as RpcDatabase).rpc("open_postcard", {
    target_tracking_number: trackingNumber,
  });
  if (openError) throw new Error(openError.message);

  const { data, error } = await database
    .from<Omit<DeliveredContents, "photoUrl" | "drawingUrl" | "audioUrl">>("postcard_contents")
    .select("*")
    .eq("postcard_id", postcardId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [photoUrl, drawingUrl, audioUrl] = await Promise.all([
    signedUrl(data.photo_path),
    signedUrl(data.drawing_path),
    signedUrl(data.audio_path),
  ]);
  return { ...data, photoUrl, drawingUrl, audioUrl };
}
