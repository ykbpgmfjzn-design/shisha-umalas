import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateStatusRequest {
  orderId: string;
  newStatus: string;
  telegramMessageId: number;
  telegramChatId: number;
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

    const data: UpdateStatusRequest = await req.json();
    console.log('Updating Telegram message for order:', data.orderId, 'to status:', data.newStatus);

    if (!data.telegramMessageId || !data.telegramChatId) {
      console.log('No Telegram message ID or chat ID provided, skipping update');
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let statusEmoji = '';
    let statusText = '';
    let inlineKeyboard: any = { inline_keyboard: [] };

    switch (data.newStatus) {
      case 'PAID':
      case 'paid':
        statusEmoji = '💳';
        statusText = 'Payment Confirmed';
        inlineKeyboard = {
          inline_keyboard: [
            [{ text: "🚀 Start Preparing", callback_data: `start_preparing:${data.orderId}` }],
            [
              { text: "📦 Delivered", callback_data: `delivered:${data.orderId}` },
              { text: "❌ Cancel", callback_data: `cancel_order:${data.orderId}` }
            ]
          ]
        };
        break;
      case 'preparing':
        statusEmoji = '👨‍🍳';
        statusText = 'Preparing Order';
        inlineKeyboard = {
          inline_keyboard: [
            [
              { text: "📦 Delivered", callback_data: `delivered:${data.orderId}` },
              { text: "❌ Cancel", callback_data: `cancel_order:${data.orderId}` }
            ]
          ]
        };
        break;
      case 'delivered':
        statusEmoji = '✅';
        statusText = 'Order Delivered';
        inlineKeyboard = { inline_keyboard: [] };
        break;
      case 'cancelled':
        statusEmoji = '❌';
        statusText = 'Order Cancelled';
        inlineKeyboard = { inline_keyboard: [] };
        break;
      default:
        statusEmoji = '⏳';
        statusText = `Status: ${data.newStatus}`;
    }

    // Edit the message to update status
    const editResponse = await fetch(`https://api.telegram.org/bot${telegramToken}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: data.telegramChatId,
        message_id: data.telegramMessageId,
        reply_markup: inlineKeyboard,
      }),
    });

    const editResult = await editResponse.json();
    
    if (!editResponse.ok) {
      console.error('Failed to edit Telegram message:', editResult);
      // Don't throw - the order update was successful, just the Telegram update failed
    } else {
      console.log('Telegram message updated successfully');
    }

    // Also send a new status update message
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID') || data.telegramChatId;
    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `${statusEmoji} *Order Update*\n\n📋 Order: \`${data.orderId.slice(0, 8)}\`\n📊 Status: ${statusText}\n⏰ Updated via website`,
        parse_mode: 'Markdown',
        reply_to_message_id: data.telegramMessageId,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating Telegram status:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
