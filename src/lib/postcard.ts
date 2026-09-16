import { supabase } from "@/integrations/supabase/client";

export type Sticker = {
  id: string;
  char: string;
  x: number; // 0-100 %
  y: number; // 0-100 %
  rot: number;
  scale: number;
};

export type TemplateId = "airmail" | "linen" | "noir" | "postmark";

export type Template = {
  id: TemplateId;
  name: string;
  code: string;
  blurb: string;
  /** decorative edge on the card */
  edge: "airmail" | "navy" | "none" | "dashed";
  cardClass: string;
  handClass: string;
  metaClass: string;
  stampClass: string;
};

export const TEMPLATES: Template[] = [
  {
    id: "airmail",
    name: "Par Avion",
    code: "AIR",
    blurb: "Red + navy airmail edging",
    edge: "airmail",
    cardClass: "bg-card text-ink",
    handClass: "text-ink",
    metaClass: "text-inkmuted",
    stampClass: "bg-cream text-accent",
  },
  {
    id: "linen",
    name: "Linen Note",
    code: "LIN",
    blurb: "Quiet paper, no markings",
    edge: "none",
    cardClass: "bg-card text-ink",
    handClass: "text-ink",
    metaClass: "text-inkmuted",
    stampClass: "bg-cream text-ink",
  },
  {
    id: "noir",
    name: "Night Mail",
    code: "NOIR",
    blurb: "Ink stock, chalk writing",
    edge: "navy",
    cardClass: "bg-ink text-cream",
    handClass: "text-cream",
    metaClass: "text-cream/60",
    stampClass: "bg-cream text-accent",
  },
  {
    id: "postmark",
    name: "Postmark",
    code: "MARK",
    blurb: "Dashed customs border",
    edge: "dashed",
    cardClass: "bg-card text-ink",
    handClass: "text-ink",
    metaClass: "text-inkmuted",
    stampClass: "bg-accent text-cream",
  },
];

export function templateById(id: string): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]!;
}

export const STICKERS = [
  "✉",
  "★",
  "✦",
  "☀",
  "🕊",
  "⚓",
  "🌊",
  "🌴",
  "☕",
  "🚂",
  "🗼",
  "❤",
];

export type PostcardRecord = {
  id: string;
  slug: string;
  template: string;
  photo_path: string | null;
  audio_path: string | null;
  drawing_path: string | null;
  message: string;
  sender: string;
  recipient: string;
  note: string;
  stickers: Sticker[];
  created_at: string;
};

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function makeSlug(len = 8) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export async function dataUrlToBlob(dataUrl: string) {
  const res = await fetch(dataUrl);
  return res.blob();
}

function extFor(blob: Blob, fallback: string) {
  const type = blob.type.split(";")[0] ?? "";
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
  };
  return map[type] ?? fallback;
}

async function uploadTo(slug: string, kind: string, blob: Blob, fallbackExt: string) {
  const path = `${slug}/${kind}.${extFor(blob, fallbackExt)}`;
  const { error } = await supabase.storage.from("postcards").upload(path, blob, {
    contentType: blob.type || undefined,
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return path;
}

export type DraftPayload = {
  template: TemplateId;
  message: string;
  sender: string;
  recipient: string;
  note: string;
  stickers: Sticker[];
  photo: Blob | null;
  drawingDataUrl: string | null;
  audio: Blob | null;
};

export async function publishPostcard(draft: DraftPayload) {
  const slug = makeSlug();

  const photo_path = draft.photo ? await uploadTo(slug, "photo", draft.photo, "jpg") : null;
  const drawing_path = draft.drawingDataUrl
    ? await uploadTo(slug, "ink", await dataUrlToBlob(draft.drawingDataUrl), "png")
    : null;
  const audio_path = draft.audio ? await uploadTo(slug, "voice", draft.audio, "webm") : null;

  const { error } = await supabase.from("postcards").insert({
    slug,
    template: draft.template,
    message: draft.message,
    sender: draft.sender,
    recipient: draft.recipient,
    note: draft.note,
    stickers: draft.stickers as never,
    photo_path,
    drawing_path,
    audio_path,
  });
  if (error) throw new Error(error.message);

  return slug;
}

const YEAR = 60 * 60 * 24 * 365;

export async function signedUrl(path: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("postcards")
    .createSignedUrl(path, YEAR);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export type LoadedPostcard = PostcardRecord & {
  photoUrl: string | null;
  drawingUrl: string | null;
  audioUrl: string | null;
};

export async function loadPostcard(slug: string): Promise<LoadedPostcard | null> {
  const { data, error } = await supabase
    .from("postcards")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const record = data as unknown as PostcardRecord;
  const [photoUrl, drawingUrl, audioUrl] = await Promise.all([
    signedUrl(record.photo_path),
    signedUrl(record.drawing_path),
    signedUrl(record.audio_path),
  ]);

  return {
    ...record,
    stickers: Array.isArray(record.stickers) ? record.stickers : [],
    photoUrl,
    drawingUrl,
    audioUrl,
  };
}

export function formatPostmark(iso: string) {
  const d = new Date(iso);
  return d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
    .toUpperCase();
}
