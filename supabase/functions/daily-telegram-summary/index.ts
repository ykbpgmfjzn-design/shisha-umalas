import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get Jakarta timezone date
    const now = new Date();
    const jakartaOffset = 7 * 60; // UTC+7
    const jakartaNow = new Date(now.getTime() + jakartaOffset * 60 * 1000);
    
    // Calculate today and yesterday dates in Jakarta timezone
    const today = new Date(jakartaNow);
    today.setUTCHours(0, 0, 0, 0);
    const todayStart = new Date(today.getTime() - jakartaOffset * 60 * 1000).toISOString();
    
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const todayEnd = new Date(tomorrow.getTime() - jakartaOffset * 60 * 1000).toISOString();
    
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStart = new Date(yesterday.getTime() - jakartaOffset * 60 * 1000).toISOString();

    console.log(`Generating daily summary for ${today.toISOString().split('T')[0]}`);

    // Get today's orders
    const { data: todayOrders, error: todayError } = await supabase
      .from('purchases')
      .select('*')
      .gte('created_at', todayStart)
      .lt('created_at', todayEnd);

    if (todayError) {
      console.error('Error fetching today orders:', todayError);
      throw todayError;
    }

    // Get yesterday's orders for comparison
    const { data: yesterdayOrders, error: yesterdayError } = await supabase
      .from('purchases')
      .select('*')
      .gte('created_at', yesterdayStart)
      .lt('created_at', todayStart);

    if (yesterdayError) {
      console.error('Error fetching yesterday orders:', yesterdayError);
    }

    // Get today's reservations
    const todayDateStr = today.toISOString().split('T')[0];
    const { data: todayReservations } = await supabase
      .from('reservations')
      .select('*')
      .eq('reservation_date', todayDateStr);

    // Get today's feedback
    const { data: todayFeedback } = await supabase
      .from('feedback')
      .select('*')
      .gte('created_at', todayStart)
      .lt('created_at', todayEnd);

    // Calculate statistics
    const totalOrders = todayOrders?.length || 0;
    const totalRevenue = todayOrders?.reduce((sum, o) => sum + (Number(o.amount) || 0), 0) || 0;
    const totalHookahs = todayOrders?.reduce((sum, o) => sum + (o.hookah_count || 0), 0) || 0;
    
    const paidOrders = todayOrders?.filter(o => o.payment_status === 'paid').length || 0;
    const unpaidOrders = todayOrders?.filter(o => o.payment_status !== 'paid').length || 0;
    const deliveredOrders = todayOrders?.filter(o => o.delivery_status === 'delivered').length || 0;
    const pendingOrders = todayOrders?.filter(o => o.delivery_status === 'pending' || o.delivery_status === 'preparing').length || 0;
    const cancelledOrders = todayOrders?.filter(o => o.delivery_status === 'cancelled').length || 0;

    const unpaidRevenue = todayOrders
      ?.filter(o => o.payment_status !== 'paid' && o.delivery_status !== 'cancelled')
      .reduce((sum, o) => sum + (Number(o.amount) || 0), 0) || 0;

    // Yesterday comparison
    const yesterdayTotal = yesterdayOrders?.length || 0;
    const yesterdayRevenue = yesterdayOrders?.reduce((sum, o) => sum + (Number(o.amount) || 0), 0) || 0;

    const orderChange = totalOrders - yesterdayTotal;
    const revenueChange = totalRevenue - yesterdayRevenue;

    const orderTrend = orderChange > 0 ? `📈 +${orderChange}` : orderChange < 0 ? `📉 ${orderChange}` : '➡️ 0';
    const revenueTrend = revenueChange > 0 ? `📈 +${revenueChange.toLocaleString()}` : revenueChange < 0 ? `📉 ${revenueChange.toLocaleString()}` : '➡️ 0';

    const reservationsCount = todayReservations?.length || 0;
    const feedbackCount = todayFeedback?.length || 0;
    const avgRating = todayFeedback?.length 
      ? (todayFeedback.reduce((sum, f) => sum + f.rating, 0) / todayFeedback.length).toFixed(1)
      : 'N/A';

    // Format the message
    const dateStr = today.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'Asia/Jakarta'
    });

    const message = `📊 *Daily Summary*
📅 ${dateStr}

🔔 *ORDERS*
━━━━━━━━━━━━━━━
📦 Total Orders: *${totalOrders}* (${orderTrend} vs yesterday)
🚬 Total Hookahs: *${totalHookahs}*
💰 Revenue: *${totalRevenue.toLocaleString()} IDR* (${revenueTrend})

💳 *PAYMENT STATUS*
━━━━━━━━━━━━━━━
✅ Paid: ${paidOrders}
⏳ Unpaid: ${unpaidOrders}${unpaidRevenue > 0 ? ` (${unpaidRevenue.toLocaleString()} IDR pending)` : ''}

📦 *DELIVERY STATUS*
━━━━━━━━━━━━━━━
✅ Delivered: ${deliveredOrders}
🔄 In Progress: ${pendingOrders}
❌ Cancelled: ${cancelledOrders}

📅 *OTHER ACTIVITY*
━━━━━━━━━━━━━━━
🪑 Reservations: ${reservationsCount}
⭐ Reviews: ${feedbackCount}${feedbackCount > 0 ? ` (Avg: ${avgRating}⭐)` : ''}

━━━━━━━━━━━━━━━
🕐 Generated at ${jakartaNow.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB`;

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

    console.log(`Sending daily summary to ${subscribers.length} subscribers`);

    // Send to all subscribers
    const sendPromises = subscribers.map(async (subscriber) => {
      try {
        const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: subscriber.chat_id,
            text: message,
            parse_mode: 'Markdown',
          }),
        });

        const result = await response.json();
        
        if (!response.ok) {
          console.error(`Failed to send to ${subscriber.chat_id}:`, result);
          
          if (result.error_code === 403) {
            await supabase
              .from('telegram_subscribers')
              .update({ is_active: false })
              .eq('chat_id', subscriber.chat_id);
          }
          return null;
        }
        
        return { chatId: subscriber.chat_id };
      } catch (err) {
        console.error(`Error sending to ${subscriber.chat_id}:`, err);
        return null;
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r !== null).length;

    console.log(`Successfully sent to ${successCount}/${subscribers.length} subscribers`);

    return new Response(JSON.stringify({ 
      success: true, 
      sentTo: successCount,
      stats: {
        totalOrders,
        totalRevenue,
        paidOrders,
        unpaidOrders,
        deliveredOrders,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending daily summary:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
