import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  trackingNumber: z.string().regex(/^PC-\d{4}-\d{4}-\d{4}$/),
  recipientEmail: z.string().email(),
});

type MailRow = {
  tracking_number: string | null;
  recipient_email: string | null;
  sender_id: string | null;
  recipient_user_id: string | null;
};

type MailQuery = {
  select: (columns: string) => MailQuery;
  eq: (column: string, value: unknown) => MailQuery;
  maybeSingle: () => Promise<{ data: MailRow | null; error: { message: string } | null }>;
};

export const invitePostcardRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(inviteSchema)
  .handler(async ({ data, context }) => {
    const query = context.supabase.from("postcards") as unknown as MailQuery;
    const { data: card, error } = await query
      .select("tracking_number, recipient_email, sender_id, recipient_user_id")
      .eq("tracking_number", data.trackingNumber)
      .eq("sender_id", context.userId)
      .maybeSingle();

    if (error || !card) throw new Error("Postcard not found");
    if (card.recipient_email?.toLowerCase() !== data.recipientEmail.toLowerCase()) {
      throw new Error("Recipient does not match this postcard");
    }
    if (card.recipient_user_id) return { invited: false, existingUser: true };

    const request = getRequest();
    const origin = new URL(request.url).origin;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.recipientEmail,
      {
        redirectTo: `${origin}/track/${data.trackingNumber}`,
        data: { incoming_postcard: data.trackingNumber },
      },
    );

    if (inviteError) {
      if (/already|registered|exists/i.test(inviteError.message)) {
        return { invited: false, existingUser: true };
      }
      throw new Error(
        `Postcard was mailed, but the invitation could not be sent: ${inviteError.message}`,
      );
    }
    return { invited: true, existingUser: false };
  });
