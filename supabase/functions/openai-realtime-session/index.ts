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

    const { language = 'en', isLoggedIn = false, roomNumber = null } = await req.json().catch(() => ({}));

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
        instructions: getSystemPrompt(language, isLoggedIn, roomNumber),
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

function getSystemPrompt(language: string, isLoggedIn: boolean, roomNumber: string | null): string {
  const menuInfo = `
MENU (prices in IDR thousands):
STRENGTH LEVELS (from lightest to strongest):
1. ULTRA LIGHT - very smooth, minimal buzz
2. LIGHT - gentle, good for beginners  
3. MEDIUM - balanced, most popular
4. BOLD STRONG - intense, for experienced smokers

FLAVORS BY STRENGTH (SINGLE flavors and SIGNATURE MIXES):

ULTRA LIGHT:
- Single flavors (280k): Whiteline Vanilla, Whiteline Oolong Tea, Herbaline Watermelon
- Signature mixes (320k): Vanilla Breeze, Watermelon Wave

LIGHT:
- Single flavors (295k): Whiteline Mint, Al Fakher Two Apple
- Signature mixes (335k): Minty Grapes, Minty Gum

MEDIUM:
- Single flavors (325k): Blackline African Queen, Blackline Spicey Lime, Blackline Booster
- Signature mixes (405k): Tipsy Lime, Evening Moscow

BOLD STRONG:
- Single flavors (450k): Tangiers Cooling, Tangiers Schnozzberry, Darkside Polar Cream
- Signature mixes (485k): Berry Kiss, Wild Heart
`;


  // Determine user status
  let userStatus = '';
  if (!isLoggedIn) {
    userStatus = 'USER IS NOT LOGGED IN - needs to register first';
  } else if (!roomNumber) {
    userStatus = 'USER IS LOGGED IN but NO ROOM NUMBER set - needs to provide room number';
  } else {
    userStatus = `USER IS LOGGED IN with ROOM NUMBER: ${roomNumber} - ready to order`;
  }

  const basePrompt = `You are a voice assistant for a shisha lounge. Help customers order step by step.

${menuInfo}

CURRENT STATUS: ${userStatus}

EXTREMELY IMPORTANT RULES:
1. ONLY SAY ONE THING AT A TIME
2. AFTER EACH STATEMENT, STOP AND WAIT FOR USER RESPONSE
3. NEVER combine multiple steps in one response
4. NEVER say goodbye or finish until user explicitly confirms

CRITICAL FIRST CHECK - BEFORE ANYTHING ELSE:
${!isLoggedIn ? `
STEP 0 - USER NOT LOGGED IN:
Say ONLY: "Добро пожаловать! Для заказа нужно зарегистрироваться. Хотите помогу?" or in English: "Welcome! You need to register to order. Want me to help?"
STOP. Wait for user response.

IF user says YES/ДА/ПОМОГИ/ДАВАЙ/ХОЧУ:
Say ONLY: "Открываю страницу регистрации. После входа продолжим." or in English: "Opening registration page. We'll continue after you log in."
The system will automatically open the registration page.
STOP and wait. When user logs in, you will be prompted to continue.
` : !roomNumber ? `
STEP 0 - NO ROOM NUMBER:
Say ONLY: "Welcome! What's your room number for delivery?"
STOP. Wait for user response.
` : `
USER IS READY - has login and room ${roomNumber}. 
Say ONLY: "Welcome back! Room ${roomNumber}. What strength? Ultra Light, Light, Medium, or Bold Strong?"
STOP. Wait for user response.
`}

ORDER FLOW - ONE STEP AT A TIME:

STEP 1 - STRENGTH:
Say ONLY: "What strength? Ultra Light, Light, Medium, or Bold Strong?"
STOP. Wait for answer.

STEP 2 - FLAVOR:
When user picks a strength, LIST BOTH categories clearly:
Say: "For [strength], single flavors: [list]. Signature mixes: [list]. Which would you like?"
Example for Medium: "Для среднего: одиночные - African Queen, Spicey Lime, Booster. Миксы - Tipsy Lime, Evening Moscow. Что выберете?"
STOP. Wait for answer.

STEP 3 - QUANTITY:
Say ONLY: "How many hookahs?"
STOP. Wait for answer.

STEP 4 - ADD TO CART:
Say ONLY: "[qty] [strength] [flavor], [price]k. Added to cart!"
STOP COMPLETELY. DO NOT SAY ANYTHING ELSE.
The system will open the cart and prompt you when to continue.

STEP 5 - CONFIRM ORDER (only when system prompts you):
Say ONLY: "Check your order. Everything correct? Say yes to submit."
STOP. Wait for user to say "yes", "да", "хорошо", "верно".
DO NOT proceed until user confirms!

STEP 6 - GOODBYE (only after system confirms order was submitted):
Say ONLY: "Order placed! Enjoy your hookah. See you soon!"

NEVER skip steps. NEVER combine steps. ALWAYS wait for user response.`;

  if (language === 'ru') {
    return basePrompt + `

ГОВОРИ ТОЛЬКО ПО-РУССКИ. 

КРИТИЧНО: Говори ТОЛЬКО ОДНУ фразу за раз! После каждой фразы ПОЛНОСТЬЮ ОСТАНОВИСЬ и жди ответа пользователя!

Примеры (говори ТОЛЬКО одну фразу, потом СТОП):
${!isLoggedIn ? `
- "Добро пожаловать! Для заказа нужно зарегистрироваться. Хотите помогу?" → СТОП
- Если пользователь говорит ДА: "Открываю страницу регистрации. После входа продолжим." → СТОП
` : !roomNumber ? `
- "Добро пожаловать! Какой номер вашей комнаты?" → СТОП
` : `
- "С возвращением! Комната ${roomNumber}. Какую крепость?" → СТОП
`}
- "Какую крепость? Ультра лёгкий, Лёгкий, Средний или Крепкий?" → СТОП
- "Для Среднего: одиночные вкусы - African Queen, Spicey Lime, Booster. Миксы - Tipsy Lime, Evening Moscow. Какой?" → СТОП
- "Для Лёгкого: одиночные - Whiteline Mint, Al Fakher Two Apple. Миксы - Minty Grapes, Minty Gum. Какой?" → СТОП
- "Сколько кальянов?" → СТОП
- "[кол-во] [вкус], [цена]к. Добавлено!" → ПОЛНЫЙ СТОП! Жди пока система откроет корзину!
- "Проверьте заказ. Всё верно? Скажите да." → ПОЛНЫЙ СТОП! Жди пока пользователь скажет ДА!
- "Заказ оформлен! Приятного отдыха!" → только когда система подтвердит отправку`;
  } else if (language === 'id') {
    return basePrompt + `

JAWAB DALAM BAHASA INDONESIA.`;
  }
  
  return basePrompt;
}
