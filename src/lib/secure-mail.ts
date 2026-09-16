import { supabase } from "@/integrations/supabase/client";
import { dataUrlToBlob, makeSlug, type DraftPayload } from "@/lib/postcard";
import { invitePostcardRecipient } from "@/lib/mail-invite.functions";

type MailAddressing = {
  recipientEmail: string;
  originLabel: string;
  originPostalCode: string;
  destinationLabel: string;
  destinationPostalCode: string;
  stampId: string;
};

type MailResult = {
  postcard_id: string;
  tracking_number: string;
  mailed_at: string;
  estimated_delivery_at: string;
};

export type MailPostcardResult = MailResult & {
  recipientNotice: "EMAIL_INVITED" | "IN_APP" | "INVITE_FAILED";
};

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function extensionFor(blob: Blob, fallback: string) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
  };
  return extensions[blob.type.split(";")[0] ?? ""] ?? fallback;
}

async function uploadOwnedAsset(
  userId: string,
  slug: string,
  kind: string,
  blob: Blob,
  fallbackExtension: string,
) {
  const path = `${userId}/${slug}/${kind}.${extensionFor(blob, fallbackExtension)}`;
  const { error } = await supabase.storage.from("postcards").upload(path, blob, {
    contentType: blob.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function mailPostcard(
  userId: string,
  draft: DraftPayload,
  addressing: MailAddressing,
) {
  const slug = makeSlug(12);
  const photoPath = draft.photo
    ? await uploadOwnedAsset(userId, slug, "photo", draft.photo, "jpg")
    : null;
  const drawingPath = draft.drawingDataUrl
    ? await uploadOwnedAsset(userId, slug, "ink", await dataUrlToBlob(draft.drawingDataUrl), "png")
    : null;
  const audioPath = draft.audio
    ? await uploadOwnedAsset(userId, slug, "voice", draft.audio, "webm")
    : null;

  const payload = {
    slug,
    template: draft.template,
    message: draft.message,
    sender_label: draft.sender,
    recipient_label: draft.recipient,
    recipient_email: addressing.recipientEmail.trim().toLowerCase(),
    note: draft.note,
    stickers: draft.stickers,
    stamp_id: addressing.stampId,
    stamp_placement: { x: 88, y: 12, rotation: -4, scale: 1 },
    photo_path: photoPath,
    drawing_path: drawingPath,
    audio_path: audioPath,
    origin_label: addressing.originLabel.trim(),
    origin_postal_code: addressing.originPostalCode.trim(),
    destination_label: addressing.destinationLabel.trim(),
    destination_postal_code: addressing.destinationPostalCode.trim(),
  };

  const { data, error } = await (supabase as unknown as RpcClient).rpc("mail_postcard", {
    payload,
  });
  if (error) throw new Error(error.message);
  const result = data as MailResult;

  let recipientNotice: MailPostcardResult["recipientNotice"] = "INVITE_FAILED";
  try {
    const invitation = await invitePostcardRecipient({
      data: {
        trackingNumber: result.tracking_number,
        recipientEmail: addressing.recipientEmail,
      },
    });
    recipientNotice = invitation.invited ? "EMAIL_INVITED" : "IN_APP";
  } catch (invitationError) {
    console.warn(invitationError);
  }

  return { ...result, recipientNotice };
}
