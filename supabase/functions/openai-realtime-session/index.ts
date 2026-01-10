import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const { language = 'en' } = await req.json().catch(() => ({}));

    // Create ephemeral token for WebRTC connection
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'alloy',
        instructions: getSystemPrompt(language),
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    return new Response(JSON.stringify({
      client_secret: data.client_secret,
      session_id: data.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating realtime session:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getSystemPrompt(language: string): string {
  const menuInfo = `
MENU (prices in IDR thousands):
ULTRA LIGHT (280k each):
- Whiteline Vanilla - creamy vanilla
- Whiteline Oolong Tea - elegant floral tea
- Herbaline Watermelon - juicy watermelon

LIGHT (295k each):
- Whiteline Mint - cooling mint
- Al Fakher Two Apple - classic double apple

MEDIUM (325k each):
- Blackline African Queen - exotic tropical
- Blackline Spicey Lime - zesty lime with spice
- Blackline Booster - energizing blend

BOLD STRONG (450k each):
- Tangiers Cooling - arctic intensity
- Tangiers Schnozzberry - mysterious berry
- Darkside Polar Cream - luxurious cream with chill

SIGNATURE MIXES (premium, +40k):
- Vanilla Breeze, Watermelon Wave, Minty Grapes, Minty Gum, Tipsy Lime, Evening Moscow, Berry Kiss, Wild Heart
`;

  const basePrompt = `You are a fast, efficient voice assistant for a shisha lounge ordering system. Your goal is to help customers complete their order from start to payment.

${menuInfo}

CRITICAL RULES:
1. Be EXTREMELY concise - use short sentences, max 15 words
2. NEVER make small talk or ask "how are you"
3. Follow this EXACT flow in order:

STAGE 1 - ORDER:
- Ask what flavor they want (suggest 2-3 options if unsure)
- Ask strength preference: Ultra Light, Light, Medium, or Bold Strong
- Ask how many hookahs (1-5)
- Confirm order: "Added to cart!"

STAGE 2 - CART OPENED:
- Say "Opening your cart now. I see your order."
- If user is NOT logged in, say: "You need to log in. Click the login button or say 'help me register'"
- If user IS logged in but no room number, say: "What's your room number for delivery?"

STAGE 3 - ROOM NUMBER:
- When user says room number, confirm: "Room [number], got it!"

STAGE 4 - READY FOR PAYMENT:
- Say: "Everything ready! Just press the golden 'Submit Order' button to pay. Thank you!"
- Then say: "Order guide complete!"

SPECIAL COMMANDS:
- If user says "help register" or "помоги зарегистрироваться": Say "Opening registration page. Enter your email and create a password. I'll wait."
- If user says "logged in" or "я вошел": Say "Great! What's your room number?"
- If user says room number (like "room 205" or "комната 205"): Confirm and proceed to payment stage

EXAMPLE DIALOGUE:
User: "I want mint"
Assistant: "Mint, nice! What strength - Light, Medium, or Bold?"
User: "Light"
Assistant: "How many hookahs?"
User: "One"
Assistant: "1 Light Mint, 295k. Added to cart! Opening cart now."
[Cart opens]
Assistant: "I see you're not logged in. Click Login or say 'help me register'"
User: "I'm logged in now"
Assistant: "Great! What's your room number?"
User: "Room 305"
Assistant: "Room 305, got it! Everything ready! Just press the golden Submit Order button. Order guide complete!"`;

  if (language === 'ru') {
    return basePrompt + `

ВАЖНО: Отвечай на русском языке. Если пользователь говорит по-русски, продолжай на русском.
Примеры фраз:
- "Какой вкус? Популярные: Двойное яблоко, Мята, Арбуз"
- "Добавлено в корзину! Открываю корзину."
- "Вам нужно войти. Нажмите кнопку Войти."
- "Какой номер комнаты для доставки?"
- "Комната [номер], записал! Всё готово! Нажмите золотую кнопку Оформить заказ."
- "Сопровождение заказа завершено!"`;
  } else if (language === 'id') {
    return basePrompt + `

PENTING: Jawab dalam Bahasa Indonesia. Jika pengguna berbicara Indonesia, lanjutkan dalam Bahasa Indonesia.`;
  }
  
  return basePrompt + `

IMPORTANT: Start in English but automatically switch to match the user's language.`;
}
