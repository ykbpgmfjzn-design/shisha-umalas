import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { id: number; first_name: string; username?: string };
    text: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name: string };
    message: { message_id: number; chat: { id: number }; text: string };
    data: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify Telegram secret token
    const telegramWebhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    if (telegramWebhookSecret) {
      const secretToken = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (secretToken !== telegramWebhookSecret) {
        console.error('Invalid Telegram webhook secret token');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!telegramToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const update: TelegramUpdate = await req.json();
    console.log('Received Telegram update:', JSON.stringify(update));

    // Handle /start command
    if (update.message?.text === '/start') {
      const chat = update.message.chat;
      const from = update.message.from;
      
      const { error: upsertError } = await supabase
        .from('telegram_subscribers')
        .upsert({
          chat_id: chat.id,
          username: from?.username || null,
          first_name: from?.first_name || null,
          is_active: true,
        }, { onConflict: 'chat_id' });

      if (upsertError) console.error('Failed to add subscriber:', upsertError);

      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chat.id,
          text: '✅ You are subscribed to Shisha Cool notifications!\n\nYou will receive notifications about new orders, reservations, and reviews.',
          parse_mode: 'Markdown',
        }),
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle /stop command
    if (update.message?.text === '/stop') {
      const chatId = update.message.chat.id;
      
      await supabase
        .from('telegram_subscribers')
        .update({ is_active: false })
        .eq('chat_id', chatId);

      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '❌ You are unsubscribed.\n\nSend /start to subscribe again.',
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
      const callbackData = callbackQuery.data;
      
      // Support both formats: "action:orderId" and "action_orderId"
      let action: string;
      let orderId: string;
      
      if (callbackData.includes(':')) {
        [action, orderId] = callbackData.split(':');
      } else {
        // Format: pay_uuid, unpay_uuid, prepare_uuid, deliver_uuid, cancel_uuid
        const underscoreIndex = callbackData.indexOf('_');
        action = callbackData.substring(0, underscoreIndex);
        orderId = callbackData.substring(underscoreIndex + 1);
      }
      
      console.log(`Processing action: ${action} for order: ${orderId}`);

      let responseText = '';
      let updateField = '';
      let updateValue = '';
      let statusEmoji = '';
      let statusLabel = '';

      // Handle feedback approval separately
      if (action === 'approve_feedback') {
        const feedbackId = orderId; // reusing the variable name
        const { error: approveError } = await supabase
          .from('feedback')
          .update({ is_approved: true })
          .eq('id', feedbackId);

        let approveResponseText = '✅ Review approved!';
        if (approveError) {
          console.error('Feedback approve error:', approveError);
          approveResponseText = `❌ Error: ${approveError.message}`;
        }

        await fetch(`https://api.telegram.org/bot${telegramToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: approveResponseText,
            show_alert: true,
          }),
        });

        // Update message to show it's approved
        if (!approveError) {
          const originalMsg = callbackQuery.message?.text || '';
          const updatedMsg = originalMsg + '\n\n✅ *APPROVED*';
          await fetch(`https://api.telegram.org/bot${telegramToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: callbackQuery.message.chat.id,
              message_id: callbackQuery.message.message_id,
              text: updatedMsg,
              parse_mode: 'Markdown',
            }),
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      switch (action) {
        // Payment actions (support both naming conventions)
        case 'mark_paid':
        case 'pay':
          updateField = 'payment_status';
          updateValue = 'paid';
          responseText = '💳 Marked as PAID!';
          statusEmoji = '💳';
          statusLabel = 'Payment: PAID';
          break;
        case 'mark_unpaid':
        case 'unpay':
          updateField = 'payment_status';
          updateValue = 'pending';
          responseText = '⏳ Marked as UNPAID!';
          statusEmoji = '⏳';
          statusLabel = 'Payment: UNPAID';
          break;
        // Delivery actions
        case 'start_preparing':
        case 'prepare':
          updateField = 'delivery_status';
          updateValue = 'preparing';
          responseText = '👨‍🍳 Started preparing!';
          statusEmoji = '👨‍🍳';
          statusLabel = 'Delivery: PREPARING';
          break;
        case 'mark_delivered':
        case 'deliver':
          updateField = 'delivery_status';
          updateValue = 'delivered';
          responseText = '✅ Marked as DELIVERED!';
          statusEmoji = '✅';
          statusLabel = 'Delivery: DELIVERED';
          break;
        case 'cancel_order':
        case 'cancel':
          updateField = 'delivery_status';
          updateValue = 'cancelled';
          responseText = '❌ Order CANCELLED!';
          statusEmoji = '❌';
          statusLabel = 'Order: CANCELLED';
          break;
        default:
          responseText = 'Unknown action';
      }

      // Update database
      if (updateField && orderId) {
        const updateData: Record<string, unknown> = { [updateField]: updateValue };
        
        if (updateField === 'payment_status' && updateValue === 'paid') {
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
          console.log(`Order ${orderId}: ${updateField} = ${updateValue}`);
          
          // Log activity for status change
          const activityType = updateField === 'payment_status' ? 'payment' : 'order';
          const activityAction = updateField === 'payment_status'
            ? `Payment status changed to ${updateValue} via Telegram`
            : `Delivery status changed to ${updateValue} via Telegram`;
          
          await supabase.rpc('log_activity', {
            _activity_type: activityType,
            _action: activityAction,
            _details: {
              order_id: orderId,
              field: updateField,
              new_value: updateValue,
              updated_by: callbackQuery.from.first_name,
              source: 'telegram'
            }
          });

          // Review email is sent automatically via database trigger (on_delivery_send_review_email)
      }

      // Answer callback query
      await fetch(`https://api.telegram.org/bot${telegramToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
          text: responseText,
          show_alert: true,
        }),
      });

      // Get current order status for buttons
      const { data: orderData } = await supabase
        .from('purchases')
        .select('payment_status, delivery_status')
        .eq('id', orderId)
        .single();

      const paymentStatus = orderData?.payment_status || 'pending';
      const deliveryStatus = orderData?.delivery_status || 'pending';

      // Generate inline keyboard based on current statuses
      const getInlineKeyboard = (pStatus: string, dStatus: string, oid: string) => {
        if (dStatus === 'cancelled') {
          return { inline_keyboard: [] };
        }

        const paymentRow = pStatus === 'paid' 
          ? [{ text: "⏳ Mark Unpaid", callback_data: `mark_unpaid:${oid}` }]
          : [{ text: "💳 Mark Paid", callback_data: `mark_paid:${oid}` }];

        let deliveryRow: Array<{ text: string; callback_data: string }> = [];
        
        if (dStatus === 'pending') {
          deliveryRow = [
            { text: "👨‍🍳 Start Preparing", callback_data: `start_preparing:${oid}` },
          ];
        } else if (dStatus === 'preparing') {
          deliveryRow = [
            { text: "✅ Mark Delivered", callback_data: `mark_delivered:${oid}` },
          ];
        }
        
        if (dStatus === 'delivered') {
          return {
            inline_keyboard: [paymentRow]
          };
        }

        const cancelRow = [{ text: "❌ Cancel Order", callback_data: `cancel_order:${oid}` }];

        return {
          inline_keyboard: [
            paymentRow,
            deliveryRow.length > 0 ? deliveryRow : [],
            cancelRow,
          ].filter(row => row.length > 0)
        };
      };

      const inlineKeyboard = getInlineKeyboard(paymentStatus, deliveryStatus, orderId);

      // Update original message
      const paymentEmoji = paymentStatus === 'paid' ? '💳' : '⏳';
      const paymentLabel = paymentStatus === 'paid' ? 'PAID' : 'UNPAID';
      
      let deliveryEmoji = '📋';
      let deliveryLabel = 'PENDING';
      if (deliveryStatus === 'preparing') { deliveryEmoji = '👨‍🍳'; deliveryLabel = 'PREPARING'; }
      if (deliveryStatus === 'delivered') { deliveryEmoji = '✅'; deliveryLabel = 'DELIVERED'; }
      if (deliveryStatus === 'cancelled') { deliveryEmoji = '❌'; deliveryLabel = 'CANCELLED'; }

      const originalMessage = callbackQuery.message?.text || '';
      // Update or append status section
      let updatedMessage = originalMessage;
      const statusSection = `\n\n${paymentEmoji} *Payment:* ${paymentLabel}\n${deliveryEmoji} *Delivery:* ${deliveryLabel}`;
      
      if (originalMessage && originalMessage.includes('*Payment:*')) {
        updatedMessage = originalMessage.replace(/\n\n[💳⏳].*\*Payment:\*.*\n[📋👨‍🍳✅❌].*\*Delivery:\*.*/s, statusSection);
      } else if (originalMessage && originalMessage.includes('⚠️ *Status:*')) {
        updatedMessage = originalMessage.replace(/⚠️ \*Status:\*.*$/m, statusSection.trim());
      } else {
        updatedMessage = originalMessage + statusSection;
      }

      await fetch(`https://api.telegram.org/bot${telegramToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: callbackQuery.message.chat.id,
          message_id: callbackQuery.message.message_id,
          text: updatedMessage,
          parse_mode: 'Markdown',
          reply_markup: inlineKeyboard,
        }),
      });

      // BROADCAST to all other subscribers
      if (updateField && orderId) {
        const { data: allSubscribers } = await supabase
          .from('telegram_subscribers')
          .select('chat_id')
          .eq('is_active', true);

        if (allSubscribers && allSubscribers.length > 0) {
          const broadcastMessage = `${statusEmoji} *Status Update*

📋 Order: \`${orderId.slice(0, 8)}\`
📊 ${statusLabel}
👤 Updated by: ${callbackQuery.from.first_name}
⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })}

Current Status:
${paymentEmoji} Payment: ${paymentLabel}
${deliveryEmoji} Delivery: ${deliveryLabel}`;

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
                    reply_markup: inlineKeyboard,
                  }),
                });
              } catch (err) {
                console.error(`Failed to broadcast to ${subscriber.chat_id}:`, err);
              }
            });

          await Promise.all(broadcastPromises);
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
