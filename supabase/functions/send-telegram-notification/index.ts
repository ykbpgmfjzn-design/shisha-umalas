import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderNotification {
  type?: 'order' | 'reservation' | 'feedback';
  orderId?: string;
  roomNumber?: string;
  userEmail?: string;
  hookahCount?: number;
  totalAmount?: number;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  // Reservation fields
  reservationDate?: string;
  reservationTime?: string;
  partySize?: number;
  phone?: string;
  location?: string;
  notes?: string;
  // Feedback fields
  feedbackName?: string;
  feedbackRating?: number;
  feedbackMessage?: string;
  feedbackPhotoUrl?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!telegramToken) {
      console.error('TELEGRAM_BOT_TOKEN not configured');
      throw new Error('Telegram bot not configured');
    }

    const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
    if (!chatId) {
      console.error('TELEGRAM_CHAT_ID not configured');
      throw new Error('Telegram chat ID not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const data: OrderNotification = await req.json();

    let message: string;
    let inlineKeyboard: any = null;

    if (data.type === 'feedback') {
      // Feedback notification
      console.log('Sending Telegram notification for feedback');
      
      const stars = '⭐'.repeat(data.feedbackRating || 0);
      
      message = `📝 *New Review!*

${stars} (${data.feedbackRating}/5)

👤 *Name:* ${data.feedbackName || 'Anonymous'}
${data.feedbackMessage ? `💬 *Message:* ${data.feedbackMessage}` : ''}
${data.feedbackPhotoUrl ? `📷 *Photo attached*` : ''}

⏰ *Time:* ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })}

🔗 [Open Admin Panel](https://shisha-umalas.lovable.app/admin)`;
    } else if (data.type === 'reservation') {
      // Reservation notification in English
      console.log('Sending Telegram notification for reservation');
      
      message = `📅 *New Reservation!*

📆 *Date:* ${data.reservationDate}
🕐 *Time:* ${data.reservationTime}
👥 *Guests:* ${data.partySize}
🚬 *Hookahs:* ${data.hookahCount}

📞 *Phone:* ${data.phone}
${data.userEmail ? `📧 *Email:* ${data.userEmail}` : ''}
${data.location ? `📍 *Location:* ${data.location}` : ''}
${data.notes ? `📝 *Notes:* ${data.notes}` : ''}

⏰ *Created:* ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })}`;
    } else {
      // Order notification in English
      console.log('Sending Telegram notification for order:', data.orderId);

      const itemsList = data.items?.map(item => 
        `  • ${item.name} x${item.quantity} - ${item.price.toLocaleString()} IDR`
      ).join('\n') || '';

      message = `🔔 *New Order!*

📋 *Order ID:* \`${data.orderId?.slice(0, 8)}\`
${data.roomNumber ? `🏨 *Room Number:* ${data.roomNumber}` : ''}
${data.userEmail ? `📧 *Email:* ${data.userEmail}` : ''}

🚬 *Hookahs:* ${data.hookahCount}

📝 *Items:*
${itemsList}

💰 *Amount:* ${data.totalAmount?.toLocaleString()} IDR

⚠️ *Status:* Awaiting Payment

⏰ *Time:* ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })}`;

      // Add inline keyboard with action buttons for orders
      if (data.orderId) {
        inlineKeyboard = {
          inline_keyboard: [
            [
              { text: "✅ Confirm Paid", callback_data: `confirm_paid:${data.orderId}` },
              { text: "🚀 Start Preparing", callback_data: `start_preparing:${data.orderId}` }
            ],
            [
              { text: "📦 Delivered", callback_data: `delivered:${data.orderId}` },
              { text: "❌ Cancel Order", callback_data: `cancel_order:${data.orderId}` }
            ]
          ]
        };
      }
    }

    // Send to Telegram with inline keyboard if available
    const telegramBody: any = {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    };

    if (inlineKeyboard) {
      telegramBody.reply_markup = inlineKeyboard;
    }

    const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(telegramBody),
    });

    const result = await telegramResponse.json();

    if (!telegramResponse.ok) {
      console.error('Telegram API error:', result);
      throw new Error(`Telegram API error: ${result.description}`);
    }

    console.log('Telegram notification sent successfully, message_id:', result.result?.message_id);

    // Save telegram message_id and chat_id to the purchase record for later updates
    if (data.type !== 'reservation' && data.orderId && result.result?.message_id) {
      const { error: updateError } = await supabase
        .from('purchases')
        .update({
          telegram_message_id: result.result.message_id,
          telegram_chat_id: parseInt(chatId),
        })
        .eq('id', data.orderId);

      if (updateError) {
        console.error('Failed to save telegram message ID:', updateError);
      } else {
        console.log('Saved telegram message ID to purchase record');
      }
    }

    return new Response(JSON.stringify({ success: true, messageId: result.result?.message_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending Telegram notification:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
