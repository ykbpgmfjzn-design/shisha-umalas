import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateStatusRequest {
  orderId: string;
  statusType: 'payment' | 'delivery'; // Which status changed
  newStatus: string;
  source?: string; // e.g. 'doku_webhook', 'web_admin'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!telegramToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const data: UpdateStatusRequest = await req.json();
    
    console.log('Broadcasting status update for order:', data.orderId, 'type:', data.statusType, 'status:', data.newStatus);

    const sourceLabel = data.source || 'web_admin';
    
    // Log activity for status change
    const activityType = data.statusType === 'payment' ? 'payment' : 'order';
    const activityAction = data.statusType === 'payment'
      ? `Payment status changed to ${data.newStatus} via ${sourceLabel}`
      : `Delivery status changed to ${data.newStatus} via ${sourceLabel}`;

    await supabase.rpc('log_activity', {
      _activity_type: activityType,
      _action: activityAction,
      _details: {
        order_id: data.orderId,
        field: data.statusType === 'payment' ? 'payment_status' : 'delivery_status',
        new_value: data.newStatus,
        source: sourceLabel
      }
    });

    // Fetch the order details
    const { data: order, error: orderError } = await supabase
      .from('purchases')
      .select('*, profiles:user_id(full_name, email, room_number)')
      .eq('id', data.orderId)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all active subscribers
    const { data: subscribers, error: subError } = await supabase
      .from('telegram_subscribers')
      .select('chat_id')
      .eq('is_active', true);

    if (subError) {
      console.error('Error fetching subscribers:', subError);
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch subscribers' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!subscribers || subscribers.length === 0) {
      console.log('No active subscribers found');
      return new Response(JSON.stringify({ success: true, broadcast: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build status message
    const paymentStatus = order.payment_status?.toLowerCase() === 'paid' ? 'paid' : 'unpaid';
    const deliveryStatus = order.delivery_status || 'pending';
    
    const paymentEmoji = paymentStatus === 'paid' ? '💳' : '⏳';
    const paymentLabel = paymentStatus === 'paid' ? 'PAID' : 'UNPAID';
    
    let deliveryEmoji = '📋';
    let deliveryLabel = 'PENDING';
    if (deliveryStatus === 'preparing') { deliveryEmoji = '👨‍🍳'; deliveryLabel = 'PREPARING'; }
    if (deliveryStatus === 'delivered') { deliveryEmoji = '✅'; deliveryLabel = 'DELIVERED'; }
    if (deliveryStatus === 'cancelled') { deliveryEmoji = '❌'; deliveryLabel = 'CANCELLED'; }

    // Determine what changed
    const changeEmoji = data.statusType === 'payment' ? paymentEmoji : deliveryEmoji;
    const changeText = data.statusType === 'payment' 
      ? `Payment → ${paymentLabel}`
      : `Delivery → ${deliveryLabel}`;

    // Build inline keyboard based on current status
    const buildInlineKeyboard = () => {
      const keyboard: any[][] = [];
      
      if (deliveryStatus !== 'cancelled') {
        // Payment buttons
        if (paymentStatus !== 'paid') {
          keyboard.push([{ text: "💳 Mark Paid", callback_data: `mark_paid:${data.orderId}` }]);
        } else {
          keyboard.push([{ text: "⏳ Mark Unpaid", callback_data: `mark_unpaid:${data.orderId}` }]);
        }
        
        // Delivery buttons
        if (deliveryStatus === 'pending') {
          keyboard.push([{ text: "👨‍🍳 Start Preparing", callback_data: `start_preparing:${data.orderId}` }]);
        }
        if (deliveryStatus !== 'delivered') {
          const row = [];
          if (deliveryStatus === 'preparing') {
            row.push({ text: "✅ Mark Delivered", callback_data: `mark_delivered:${data.orderId}` });
          }
          row.push({ text: "❌ Cancel Order", callback_data: `cancel_order:${data.orderId}` });
          if (row.length > 0) keyboard.push(row);
        }
      }
      
      return keyboard;
    };

    const inlineKeyboard = buildInlineKeyboard();

    // === 1. Try to EDIT the original order message ===
    if (order.telegram_chat_id && order.telegram_message_id) {
      try {
        // Reconstruct the original message with updated status
        const itemsFromNotes = order.notes || '';
        const profile = order.profiles;
        const customerName = profile?.full_name || profile?.email || 'Guest';
        const roomInfo = profile?.room_number ? `🏨 *Room Number:* ${profile.room_number}` : '';
        const phone = profile?.phone || '';
        const phoneInfo = phone ? `📱 *WhatsApp:* [${phone}](https://wa.me/${phone.replace(/[^0-9]/g, '')})` : '';

        const editedMessage = `🔔 *New Order!*

📋 *Order ID:* \`${data.orderId.slice(0, 8)}\`
${roomInfo ? roomInfo + '\n' : ''}${customerName !== 'Guest' ? `📧 *Email:* ${profile?.email || ''}\n` : ''}${phoneInfo ? phoneInfo + '\n' : ''}
🚬 *Hookahs:* ${order.hookah_count}

📝 *Items:*
${itemsFromNotes}

💰 *Amount:* ${order.amount?.toLocaleString() || '0'} IDR

⏰ *Time:* ${new Date(order.created_at).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })}

${paymentEmoji} *Payment:* ${paymentLabel}
${deliveryEmoji} *Delivery:* ${deliveryLabel}`;

        const editResponse = await fetch(`https://api.telegram.org/bot${telegramToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: order.telegram_chat_id,
            message_id: order.telegram_message_id,
            text: editedMessage,
            parse_mode: 'Markdown',
            reply_markup: inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined,
          }),
        });

        if (editResponse.ok) {
          console.log('Successfully edited original Telegram message');
        } else {
          const editError = await editResponse.json();
          console.error('Failed to edit original message:', editError);
        }
      } catch (editErr) {
        console.error('Error editing original message:', editErr);
      }
    }

    // === 2. Broadcast status update to ALL subscribers ===
    const profile = order.profiles;
    const customerName = profile?.full_name || profile?.email || 'Guest';
    const roomInfo = profile?.room_number ? `🏠 Room: ${profile.room_number}\n` : '';
    const sourceText = sourceLabel === 'doku_webhook' ? 'DOKU payment' : 'web app';
    
    const message = `📢 *STATUS UPDATE*\n\n` +
      `🆔 Order: \`${data.orderId.slice(0, 8)}\`\n` +
      `👤 ${customerName}\n` +
      `${roomInfo}` +
      `🌿 Hookahs: ${order.hookah_count}\n\n` +
      `${changeEmoji} *${changeText}*\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `${paymentEmoji} Payment: *${paymentLabel}*\n` +
      `${deliveryEmoji} Delivery: *${deliveryLabel}*\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `📱 _Updated via ${sourceText}_`;

    // Broadcast to all subscribers
    console.log(`Broadcasting to ${subscribers.length} subscribers`);
    
    const broadcastResults = await Promise.allSettled(
      subscribers.map(async (sub) => {
        // Skip the chat where we already edited the original message
        if (sub.chat_id === order.telegram_chat_id) {
          return sub.chat_id; // Already handled via edit
        }

        const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: sub.chat_id,
            text: message,
            parse_mode: 'Markdown',
            reply_markup: inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined,
          }),
        });
        
        if (!response.ok) {
          const error = await response.json();
          console.error(`Failed to send to ${sub.chat_id}:`, error);
          throw new Error(`Failed to send to ${sub.chat_id}`);
        }
        
        return sub.chat_id;
      })
    );

    const successCount = broadcastResults.filter(r => r.status === 'fulfilled').length;
    const failedCount = broadcastResults.filter(r => r.status === 'rejected').length;
    
    console.log(`Broadcast complete: ${successCount} success, ${failedCount} failed`);

    return new Response(JSON.stringify({ 
      success: true, 
      broadcast: successCount,
      failed: failedCount 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error broadcasting status update:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
