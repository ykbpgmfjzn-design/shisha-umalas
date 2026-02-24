import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  reservation_id: string;
  new_status: string;
  user_email: string;
  user_name?: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  hookah_count: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();
    
    const { 
      reservation_id,
      new_status, 
      user_email, 
      user_name,
      reservation_date,
      reservation_time,
      party_size,
      hookah_count
    } = payload;

    if (!user_email || !new_status || !reservation_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format status for display
    const statusText = new_status === "confirmed" 
      ? "✅ Подтверждено" 
      : new_status === "cancelled" 
      ? "❌ Отменено" 
      : "⏳ Ожидает подтверждения";

    const statusEmoji = new_status === "confirmed" ? "🎉" : new_status === "cancelled" ? "😔" : "⏳";

    // Create email content
    const subject = new_status === "confirmed" 
      ? "Ваше бронирование подтверждено! 🎉"
      : new_status === "cancelled"
      ? "Ваше бронирование отменено"
      : "Обновление статуса бронирования";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #1a1a1a; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #2a2a2a; border-radius: 16px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #d4a574, #8b5a2b); padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; color: #000; }
          .content { padding: 30px; }
          .status-badge { display: inline-block; padding: 10px 20px; border-radius: 25px; font-weight: bold; margin: 20px 0; }
          .status-confirmed { background: rgba(34, 197, 94, 0.2); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); }
          .status-cancelled { background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
          .status-pending { background: rgba(249, 115, 22, 0.2); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.3); }
          .details { background: #333; padding: 20px; border-radius: 12px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #444; }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { color: #888; }
          .detail-value { font-weight: bold; color: #d4a574; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${statusEmoji} Shisha Cool</h1>
          </div>
          <div class="content">
            <p>Привет${user_name ? `, ${user_name}` : ""}!</p>
            
            <p>Статус вашего бронирования изменён:</p>
            
            <div class="status-badge status-${new_status}">
              ${statusText}
            </div>
            
            <div class="details">
              <div class="detail-row">
                <span class="detail-label">📅 Дата</span>
                <span class="detail-value">${reservation_date}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Время</span>
                <span class="detail-value">${reservation_time}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👥 Гостей</span>
                <span class="detail-value">${party_size}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">💨 Кальянов</span>
                <span class="detail-value">${hookah_count}</span>
              </div>
            </div>
            
            ${new_status === "confirmed" 
              ? "<p>Ждём вас! Если у вас есть вопросы, свяжитесь с нами.</p>" 
              : new_status === "cancelled"
              ? "<p>Если вы хотите сделать новое бронирование, посетите наше приложение.</p>"
              : "<p>Мы скоро подтвердим ваше бронирование.</p>"
            }
          </div>
          <div class="footer">
            <p>Shisha Cool Hookah Lounge</p>
            <p>Это автоматическое уведомление. Пожалуйста, не отвечайте на это письмо.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Shisha Cool <noreply@shisha.cool>",
        to: [user_email],
        subject,
        html: htmlContent,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend error:", result);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: result }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Reservation email sent to", user_email, "status:", new_status);
    return new Response(
      JSON.stringify({ success: true, id: result.id, email: user_email, status: new_status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Notification error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
