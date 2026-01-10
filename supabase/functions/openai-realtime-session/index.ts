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
1. ULTRA LIGHT (280k) - very smooth, minimal buzz
2. LIGHT (295k) - gentle, good for beginners  
3. MEDIUM (325k) - balanced, most popular
4. BOLD STRONG (450k) - intense, for experienced smokers

FLAVORS BY STRENGTH:
ULTRA LIGHT: Whiteline Vanilla, Whiteline Oolong Tea, Herbaline Watermelon
LIGHT: Whiteline Mint, Al Fakher Two Apple
MEDIUM: Blackline African Queen, Blackline Spicey Lime, Blackline Booster
BOLD STRONG: Tangiers Cooling, Tangiers Schnozzberry, Darkside Polar Cream

SIGNATURE MIXES (+40k premium): Vanilla Breeze, Watermelon Wave, Minty Grapes, Minty Gum, Tipsy Lime, Evening Moscow, Berry Kiss, Wild Heart
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

  const basePrompt = `You are a fast voice assistant for a shisha lounge. Help customers order step by step.

${menuInfo}

CURRENT STATUS: ${userStatus}

CRITICAL FIRST CHECK - BEFORE ANYTHING ELSE:
${!isLoggedIn ? `
STEP 0 - USER NOT LOGGED IN:
IMMEDIATELY say: "Welcome! To order, you need to register first. Say 'help me register' or I'll open the registration page."
If they agree or say nothing useful, say "Opening registration." and navigate to /auth.
DO NOT proceed to ordering until they confirm they logged in!
` : !roomNumber ? `
STEP 0 - NO ROOM NUMBER:
IMMEDIATELY say: "Welcome! I see you're logged in. What's your room number for delivery?"
Wait for room number before proceeding to ordering.
Once they give room number, say "Got it, room [number]! Now let's order. What strength hookah?"
` : `
USER IS READY - has login and room ${roomNumber}. 
Say: "Welcome back! Room ${roomNumber}. What strength hookah? Ultra Light, Light, Medium, or Bold Strong?"
`}

CRITICAL: ASK ONE QUESTION AT A TIME. Wait for answer before next question.

ORDER FLOW (only after user is logged in and has room number):

STEP 1 - STRENGTH:
Say: "What strength? Ultra Light, Light, Medium, or Bold Strong?"
Wait for answer. DO NOT mention flavors yet!

STEP 2 - FLAVOR (after strength is chosen):
Based on their strength, offer ONLY the flavors for that strength.
Example: "For Light, we have Mint or Two Apple. Which one?"
Wait for answer.

STEP 3 - QUANTITY (after flavor is chosen):
Say: "How many hookahs?"
Wait for answer.

STEP 4 - CONFIRM & ADD TO CART:
Say: "[quantity] [strength] [flavor], [price]k. Added to cart!"
Wait 1-2 seconds for cart to open, then say: "Check your order. Is everything correct? Say yes to submit."

STEP 5 - WHEN USER CONFIRMS:
When user says "yes", "да", "confirm", "готов", "верно", "хорошо", "ок" - the system will automatically submit the order.
DO NOT say "Submitting" - just wait. The system handles submission.
After the order is successfully placed, you will be prompted to say goodbye.

SPECIAL COMMANDS:
- "help register" / "помоги зарегистрироваться" → Say "Opening registration." Navigate to /auth
- After user confirms login → Immediately ask for room number without waiting
- Room number received → Immediately proceed to asking about strength
- ALWAYS be proactive - don't wait for user to ask, guide them through the process

BE CONCISE: Max 15 words per response. Always be friendly and proactive!`;

  if (language === 'ru') {
    return basePrompt + `

ГОВОРИ ПО-РУССКИ. Примеры:
${!isLoggedIn ? `
- "Добро пожаловать! Для заказа нужно зарегистрироваться. Скажите 'помоги' или открою страницу."
` : !roomNumber ? `
- "Добро пожаловать! Какой номер вашей комнаты для доставки?"
- После получения номера сразу спрашивай: "Отлично! Какую крепость кальяна желаете?"
` : `
- "С возвращением! Комната ${roomNumber}. Какую крепость? Ультра лёгкий, Лёгкий, Средний или Крепкий?"
`}
- "Какую крепость? Ультра лёгкий, Лёгкий, Средний или Крепкий?"
- "Для Среднего есть African Queen, Spicey Lime или Booster. Какой?"
- "Сколько кальянов?"
- "[кол-во] [крепость] [вкус], [цена]к. Добавлено в корзину!"
- После открытия корзины: "Проверьте заказ. Всё верно? Скажите да для оформления."
- После успешного оформления: "Заказ оформлен! Приятного отдыха. До скорой встречи!"`;
  } else if (language === 'id') {
    return basePrompt + `

JAWAB DALAM BAHASA INDONESIA.`;
  }
  
  return basePrompt;
}
