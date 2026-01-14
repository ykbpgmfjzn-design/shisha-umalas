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

    // Handle callback queries (button presses)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const [action, orderId] = callbackQuery.data.split(':');
      
      console.log(`Processing action: ${action} for order: ${orderId}`);

      let newStatus: string | null = null;
      let responseText = '';
      let updatedMessage = '';

      switch (action) {
        case 'confirm_paid':
          newStatus = 'paid';
          responseText = '✅ Payment confirmed!';
          updatedMessage = '💳 *Payment Confirmed*';
          break;
        case 'start_preparing':
          newStatus = 'preparing';
          responseText = '🚀 Order is being prepared!';
          updatedMessage = '👨‍🍳 *Preparing Order*';
          break;
        case 'delivered':
          newStatus = 'delivered';
          responseText = '📦 Order delivered successfully!';
          updatedMessage = '✅ *Order Delivered*';
          break;
        case 'cancel_order':
          newStatus = 'cancelled';
          responseText = '❌ Order cancelled.';
          updatedMessage = '❌ *Order Cancelled*';
          break;
        default:
          responseText = 'Unknown action';
      }

      // Update order status in database
      if (newStatus && orderId) {
        const updateData: any = { payment_status: newStatus };
        
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

      // Update the message to show the new status
      const originalMessage = callbackQuery.message.text;
      const statusLine = originalMessage.includes('*Status:*') 
        ? originalMessage.replace(/\*Status:\*.*$/m, `*Status:* ${updatedMessage.replace(/\*/g, '')}`)
        : `${originalMessage}\n\n${updatedMessage}`;

      // Remove inline keyboard after action is taken
      await fetch(`https://api.telegram.org/bot${telegramToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: callbackQuery.message.chat.id,
          message_id: callbackQuery.message.message_id,
          text: statusLine,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: newStatus === 'delivered' || newStatus === 'cancelled' 
              ? [] // Remove all buttons for final states
              : newStatus === 'paid' 
                ? [[
                    { text: "🚀 Start Preparing", callback_data: `start_preparing:${orderId}` }
                  ], [
                    { text: "📦 Delivered", callback_data: `delivered:${orderId}` },
                    { text: "❌ Cancel", callback_data: `cancel_order:${orderId}` }
                  ]]
                : newStatus === 'preparing'
                  ? [[
                      { text: "📦 Delivered", callback_data: `delivered:${orderId}` },
                      { text: "❌ Cancel", callback_data: `cancel_order:${orderId}` }
                    ]]
                  : []
          }
        }),
      });
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
