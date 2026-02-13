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
  feedbackId?: string;
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active subscribers
    const { data: subscribers, error: subscribersError } = await supabase
      .from('telegram_subscribers')
      .select('chat_id')
      .eq('is_active', true);

    if (subscribersError) {
      console.error('Failed to fetch subscribers:', subscribersError);
      throw new Error('Failed to fetch subscribers');
    }

    if (!subscribers || subscribers.length === 0) {
      console.log('No active subscribers found');
      return new Response(JSON.stringify({ success: true, message: 'No subscribers' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${subscribers.length} active subscribers`);

    const data: OrderNotification = await req.json();

    let message: string;
    let inlineKeyboard: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } | null = null;

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

🔗 [Open Review](https://shisha-umalas.lovable.app/feedback)`;

      // Add Approve button if feedback ID is available
      if (data.feedbackId) {
        inlineKeyboard = {
          inline_keyboard: [
            [{ text: "✅ Approve Review", callback_data: `approve_feedback:${data.feedbackId}` }]
          ]
        };
      }
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
${data.phone ? `📱 *WhatsApp:* [${data.phone}](https://wa.me/${data.phone.replace(/[^0-9]/g, '')})` : ''}

🚬 *Hookahs:* ${data.hookahCount}

📝 *Items:*
${itemsList}

💰 *Amount:* ${data.totalAmount?.toLocaleString()} IDR

⏰ *Time:* ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })}

⏳ *Payment:* UNPAID
📋 *Delivery:* PENDING`;

      // Add inline keyboard with separate payment and delivery buttons
      if (data.orderId) {
        inlineKeyboard = {
          inline_keyboard: [
            [{ text: "💳 Mark Paid", callback_data: `mark_paid:${data.orderId}` }],
            [{ text: "👨‍🍳 Start Preparing", callback_data: `start_preparing:${data.orderId}` }],
            [{ text: "❌ Cancel Order", callback_data: `cancel_order:${data.orderId}` }]
          ]
        };
      }
    }

    // Send to ALL active subscribers
    const sendPromises = subscribers.map(async (subscriber) => {
      const telegramBody: Record<string, unknown> = {
        chat_id: subscriber.chat_id,
        text: message,
        parse_mode: 'Markdown',
      };

      if (inlineKeyboard) {
        telegramBody.reply_markup = inlineKeyboard;
      }

      try {
        const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(telegramBody),
        });

        const result = await telegramResponse.json();

        if (!telegramResponse.ok) {
          console.error(`Failed to send to ${subscriber.chat_id}:`, result);
          
          // If user blocked the bot, mark them as inactive
          if (result.error_code === 403) {
            await supabase
              .from('telegram_subscribers')
              .update({ is_active: false })
              .eq('chat_id', subscriber.chat_id);
            console.log(`Marked subscriber ${subscriber.chat_id} as inactive (blocked bot)`);
          }
          return null;
        }

        console.log(`Sent to ${subscriber.chat_id}, message_id:`, result.result?.message_id);
        return { chatId: subscriber.chat_id, messageId: result.result?.message_id };
      } catch (err) {
        console.error(`Error sending to ${subscriber.chat_id}:`, err);
        return null;
      }
    });

    const results = await Promise.all(sendPromises);
    const successfulSends = results.filter(r => r !== null);

    console.log(`Successfully sent to ${successfulSends.length}/${subscribers.length} subscribers`);

    // Save first successful telegram message_id to the purchase record for later updates
    if (data.type !== 'reservation' && data.type !== 'feedback' && data.orderId && successfulSends.length > 0) {
      const firstSuccess = successfulSends[0];
      if (firstSuccess) {
        const { error: updateError } = await supabase
          .from('purchases')
          .update({
            telegram_message_id: firstSuccess.messageId,
            telegram_chat_id: firstSuccess.chatId,
          })
          .eq('id', data.orderId);

        if (updateError) {
          console.error('Failed to save telegram message ID:', updateError);
        } else {
          console.log('Saved telegram message ID to purchase record');
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      sentTo: successfulSends.length,
      totalSubscribers: subscribers.length 
    }), {
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
