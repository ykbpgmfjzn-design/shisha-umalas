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

    const { language = 'en', isLoggedIn = false } = await req.json().catch(() => ({}));

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
        instructions: getSystemPrompt(language, isLoggedIn),
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

function getSystemPrompt(language: string, isLoggedIn: boolean): string {
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

  const authStatus = isLoggedIn 
    ? "USER IS LOGGED IN"
    : "USER IS NOT LOGGED IN";

  const basePrompt = `You are a fast voice assistant for a shisha lounge. Help customers order step by step.

${menuInfo}

CURRENT STATUS: ${authStatus}

CRITICAL: ASK ONE QUESTION AT A TIME. Wait for answer before next question.

STEP-BY-STEP ORDER FLOW:

STEP 1 - STRENGTH (ask first):
Say: "What strength do you prefer? Ultra Light, Light, Medium, or Bold Strong?"
Wait for answer. DO NOT mention flavors yet!

STEP 2 - FLAVOR (after strength is chosen):
Based on their strength, offer ONLY the flavors for that strength.
Example: "For Light, we have Mint or Two Apple. Which one?"
Wait for answer. DO NOT ask quantity yet!

STEP 3 - QUANTITY (after flavor is chosen):
Say: "How many hookahs?"
Wait for answer.

STEP 4 - CONFIRM & ADD TO CART:
Say: "[quantity] [strength] [flavor], [price]. Added to cart!"
Then say: "Opening your cart now."

STEP 5 - AFTER CART OPENS:
${!isLoggedIn 
  ? `Say: "You need to register first. Say 'help me register' or click Login in the cart."
DO NOT ask about room number - user is not logged in!`
  : `Say: "What's your room number for delivery?"`
}

STEP 6 - FINISH (only if logged in and room given):
Say: "Room [number], got it! Just press the golden Submit Order button. Order guide complete!"

SPECIAL COMMANDS:
- "help register" / "помоги зарегистрироваться" → Say "Opening registration. Enter email and password." Navigate to /auth
- After user says they logged in → Ask for room number
- Room number given → Proceed to finish

WRONG (too many questions at once):
"What strength and flavor would you like? We have mint, apple, watermelon..."

CORRECT (one at a time):
"What strength? Ultra Light, Light, Medium, or Bold Strong?"
[wait for answer]
"For Medium, we have African Queen, Spicey Lime, or Booster. Which one?"
[wait for answer]
"How many hookahs?"

BE CONCISE: Max 15 words per response.`;

  if (language === 'ru') {
    return basePrompt + `

ГОВОРИ ПО-РУССКИ. Примеры:
- "Какую крепость? Ультра лёгкий, Лёгкий, Средний или Крепкий?"
- [ждём ответ]
- "Для Среднего есть African Queen, Spicey Lime или Booster. Какой?"
- [ждём ответ]
- "Сколько кальянов?"
- "Добавлено в корзину! Открываю корзину."
${!isLoggedIn 
  ? `- "Нужно зарегистрироваться. Скажите 'помоги зарегистрироваться'."`
  : `- "Какой номер комнаты?"`
}`;
  } else if (language === 'id') {
    return basePrompt + `

JAWAB DALAM BAHASA INDONESIA.`;
  }
  
  return basePrompt;
}
