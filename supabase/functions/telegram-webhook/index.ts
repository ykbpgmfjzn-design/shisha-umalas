import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
    };
    message: {
      message_id: number;
      chat: {
        id: number;
      };
      text: string;
    };
    data: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!telegramToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const update: TelegramUpdate = await req.json();
    console.log('Received Telegram update:', JSON.stringify(update));

    // Handle /start command - subscribe user to notifications
    if (update.message?.text === '/start') {
      const chat = update.message.chat;
      const from = update.message.from;
      
      console.log(`User ${from?.first_name} (${chat.id}) started the bot`);
      
      // Add or update subscriber
      const { error: upsertError } = await supabase
        .from('telegram_subscribers')
        .upsert({
          chat_id: chat.id,
          username: from?.username || null,
          first_name: from?.first_name || null,
          is_active: true,
        }, {
          onConflict: 'chat_id',
        });

      if (upsertError) {
        console.error('Failed to add subscriber:', upsertError);
      } else {
        console.log(`Subscriber ${chat.id} added/updated successfully`);
      }

      // Send welcome message
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chat.id,
          text: '✅ Вы подписаны на уведомления Shisha Cool!\n\nВы будете получать уведомления о новых заказах, бронированиях и отзывах.\n\n🔔 You are now subscribed to Shisha Cool notifications!',
          parse_mode: 'Markdown',
        }),
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle /stop command - unsubscribe user
    if (update.message?.text === '/stop') {
      const chatId = update.message.chat.id;
      
      const { error: updateError } = await supabase
        .from('telegram_subscribers')
        .update({ is_active: false })
        .eq('chat_id', chatId);

      if (updateError) {
        console.error('Failed to unsubscribe:', updateError);
      }

      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '❌ Вы отписаны от уведомлений.\n\nОтправьте /start чтобы подписаться снова.',
          parse_mode: 'Markdown',
        }),
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle callback queries (button presses)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const [action, orderId] = callbackQuery.data.split(':');
      
      console.log(`Processing action: ${action} for order: ${orderId}`);

      let newStatus: string | null = null;
      let responseText = '';
      let updatedMessage = '';

      let statusEmoji = '';
      
      switch (action) {
        case 'confirm_paid':
          newStatus = 'paid';
          responseText = '✅ Payment confirmed!';
          updatedMessage = '💳 *PAID*';
          statusEmoji = '💳';
          break;
        case 'start_preparing':
          newStatus = 'preparing';
          responseText = '🚀 Order is being prepared!';
          updatedMessage = '👨‍🍳 *PREPARING*';
          statusEmoji = '👨‍🍳';
          break;
        case 'delivered':
          newStatus = 'delivered';
          responseText = '📦 Order delivered successfully!';
          updatedMessage = '✅ *DELIVERED*';
          statusEmoji = '✅';
          break;
        case 'cancel_order':
          newStatus = 'cancelled';
          responseText = '❌ Order cancelled.';
          updatedMessage = '❌ *CANCELLED*';
          statusEmoji = '❌';
          break;
        default:
          responseText = 'Unknown action';
      }

      // Update order status in database
      if (newStatus && orderId) {
        const updateData: Record<string, unknown> = { payment_status: newStatus };
        
        if (newStatus === 'paid') {
          updateData.paid_at = new Date().toISOString();
        }

        const { error: updateError } = await supabase
          .from('purchases')
          .update(updateData)
          .eq('id', orderId);

        if (updateError) {
          console.error('Database update error:', updateError);
          responseText = `❌ Error: ${updateError.message}`;
        } else {
          console.log(`Order ${orderId} updated to status: ${newStatus}`);
        }
      }

      // Answer the callback query (removes loading state on button)
      await fetch(`https://api.telegram.org/bot${telegramToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
          text: responseText,
          show_alert: true,
        }),
      });

      // Get inline keyboard based on new status
      const getInlineKeyboard = (status: string, oid: string) => {
        if (status === 'delivered' || status === 'cancelled') {
          return { inline_keyboard: [] };
        }
        if (status === 'paid') {
          return {
            inline_keyboard: [
              [{ text: "🚀 Start Preparing", callback_data: `start_preparing:${oid}` }],
              [
                { text: "📦 Delivered", callback_data: `delivered:${oid}` },
                { text: "❌ Cancel", callback_data: `cancel_order:${oid}` }
              ]
            ]
          };
        }
        if (status === 'preparing') {
          return {
            inline_keyboard: [
              [
                { text: "📦 Delivered", callback_data: `delivered:${oid}` },
                { text: "❌ Cancel", callback_data: `cancel_order:${oid}` }
              ]
            ]
          };
        }
        // Default: pending/unpaid
        return {
          inline_keyboard: [
            [
              { text: "✅ Confirm Paid", callback_data: `confirm_paid:${oid}` },
              { text: "🚀 Start Preparing", callback_data: `start_preparing:${oid}` }
            ],
            [
              { text: "📦 Delivered", callback_data: `delivered:${oid}` },
              { text: "❌ Cancel Order", callback_data: `cancel_order:${oid}` }
            ]
          ]
        };
      };

      // Update the original message for the user who clicked
      const originalMessage = callbackQuery.message.text;
      const statusLine = originalMessage.includes('*Status:*') 
        ? originalMessage.replace(/\*Status:\*.*$/m, `*Status:* ${updatedMessage.replace(/\*/g, '')}`)
        : `${originalMessage}\n\n${updatedMessage}`;

      await fetch(`https://api.telegram.org/bot${telegramToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: callbackQuery.message.chat.id,
          message_id: callbackQuery.message.message_id,
          text: statusLine,
          parse_mode: 'Markdown',
          reply_markup: getInlineKeyboard(newStatus || '', orderId),
        }),
      });

      // BROADCAST: Send status update to ALL other subscribers
      if (newStatus && orderId) {
        const { data: allSubscribers } = await supabase
          .from('telegram_subscribers')
          .select('chat_id')
          .eq('is_active', true);

        if (allSubscribers && allSubscribers.length > 0) {
          const broadcastMessage = `${statusEmoji} *Order Status Update*

📋 Order: \`${orderId.slice(0, 8)}\`
📊 New Status: ${updatedMessage}
👤 Updated by: ${callbackQuery.from.first_name}
⏰ Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })}`;

          // Send to all subscribers except the one who clicked
          const broadcastPromises = allSubscribers
            .filter(sub => sub.chat_id !== callbackQuery.message.chat.id)
            .map(async (subscriber) => {
              try {
                await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: subscriber.chat_id,
                    text: broadcastMessage,
                    parse_mode: 'Markdown',
                    reply_markup: getInlineKeyboard(newStatus || '', orderId),
                  }),
                });
              } catch (err) {
                console.error(`Failed to broadcast to ${subscriber.chat_id}:`, err);
              }
            });

          await Promise.all(broadcastPromises);
          console.log(`Broadcasted status update to ${allSubscribers.length - 1} other subscribers`);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Telegram webhook error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
