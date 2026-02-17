import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_REVIEW_URL = "https://g.page/r/CWUVTUf3-kd2EBM/review";
const FEEDBACK_IMAGE = "https://shisha-umalas.lovable.app/images/feedback-cat.jpeg";
const SITE_URL = "https://www.shisha.cool";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { email, customerName } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const name = customerName || "Valued Guest";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">
        
        <!-- Cat Image -->
        <tr><td style="padding:0;">
          <img src="${FEEDBACK_IMAGE}" alt="We'd love your feedback" style="width:100%;display:block;border-radius:16px 16px 0 0;" />
        </td></tr>

        <!-- Content -->
        <tr><td style="padding:32px 28px 16px;">
          <h1 style="margin:0 0 8px;font-size:22px;color:#d4af37;font-weight:700;letter-spacing:0.5px;">
            Thank You, ${name}! 💛
          </h1>
          <p style="margin:0 0 20px;font-size:15px;color:#b0b0b0;line-height:1.7;">
            We truly appreciate you choosing <strong style="color:#e0e0e0;">Shisha Cool</strong> as your way to relax.<br><br>
            If you enjoyed your experience with us, we'd love to hear your thoughts.
            Your feedback means a lot and helps us keep improving our service.<br><br>
            Thank you for being part of our vibe. 🌿
          </p>
        </td></tr>

        <!-- CTA Button -->
        <tr><td align="center" style="padding:8px 28px 32px;">
          <a href="${GOOGLE_REVIEW_URL}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#d4af37,#c5a028);color:#0a0a0a;font-size:16px;font-weight:700;padding:14px 36px;border-radius:30px;text-decoration:none;letter-spacing:0.5px;">
            ⭐ Leave a Review
          </a>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 28px;">
          <div style="height:1px;background:linear-gradient(90deg,transparent,#d4af37,transparent);"></div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 28px 24px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#666;line-height:1.6;">
            Shisha Cool Bali — Premium Hookah Delivery & Lounge<br>
            <a href="${SITE_URL}" style="color:#d4af37;text-decoration:none;">www.shisha.cool</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Shisha Cool <noreply@shisha.cool>",
        to: [email],
        subject: "Thank you for choosing Shisha Cool ✨ We'd love your feedback!",
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: "Failed to send email", details: result }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Review email sent to", email);
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-review-email error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
