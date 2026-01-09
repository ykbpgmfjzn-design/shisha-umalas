import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderNotification {
  type?: 'order' | 'reservation';
  orderId?: string;
  roomNumber?: string;
  userEmail?: string;
  hookahCount: number;
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

    // You need to set this after getting your chat ID
    // Send /start to your bot, then use https://api.telegram.org/bot<TOKEN>/getUpdates to get your chat_id
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
    if (!chatId) {
      console.error('TELEGRAM_CHAT_ID not configured');
      throw new Error('Telegram chat ID not configured');
    }

    const data: OrderNotification = await req.json();

    let message: string;

    if (data.type === 'reservation') {
      // Reservation notification
      console.log('Sending Telegram notification for reservation');
      
      message = `📅 *Новое бронирование!*

📆 *Дата:* ${data.reservationDate}
🕐 *Время:* ${data.reservationTime}
👥 *Гостей:* ${data.partySize}
🚬 *Кальянов:* ${data.hookahCount}

📞 *Телефон:* ${data.phone}
${data.userEmail ? `📧 *Email:* ${data.userEmail}` : ''}
${data.location ? `📍 *Локация:* ${data.location}` : ''}
${data.notes ? `📝 *Примечания:* ${data.notes}` : ''}

⏰ *Создано:* ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Jakarta' })}`;
    } else {
      // Order notification
      console.log('Sending Telegram notification for order:', data.orderId);

      const itemsList = data.items?.map(item => 
        `  • ${item.name} x${item.quantity} - ${item.price.toLocaleString()} IDR`
      ).join('\n') || '';

      message = `🔔 *Новый заказ!*

📋 *ID заказа:* \`${data.orderId?.slice(0, 8)}\`
${data.roomNumber ? `🏨 *Номер комнаты:* ${data.roomNumber}` : ''}
${data.userEmail ? `📧 *Email:* ${data.userEmail}` : ''}

🚬 *Кол-во кальянов:* ${data.hookahCount}

📝 *Позиции:*
${itemsList}

💰 *Сумма:* ${data.totalAmount?.toLocaleString()} IDR

⏰ *Время:* ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Jakarta' })}`;
    }

    // Send to Telegram
    const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const result = await telegramResponse.json();

    if (!telegramResponse.ok) {
      console.error('Telegram API error:', result);
      throw new Error(`Telegram API error: ${result.description}`);
    }

    console.log('Telegram notification sent successfully');

    return new Response(JSON.stringify({ success: true }), {
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
