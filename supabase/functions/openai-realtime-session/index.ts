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
ULTRA LIGHT (300k each):
- Whiteline Vanilla - creamy vanilla
- Whiteline Oolong Tea - elegant floral tea
- Herbaline Watermelon - juicy watermelon

LIGHT (350k each):
- Whiteline Mint - cooling mint
- Al Fakher Two Apple - classic double apple

MEDIUM (400k each):
- Blackline African Queen - exotic tropical
- Blackline Spicey Lime - zesty lime with spice
- Blackline Booster - energizing blend

BOLD STRONG (450k each):
- Tangiers Cooling - arctic intensity
- Tangiers Schnozzberry - mysterious berry
- Darkside Polar Cream - luxurious cream with chill

SIGNATURE MIXES (premium, +50k):
- Vanilla Breeze, Watermelon Wave, Minty Grapes, Minty Gum, Tipsy Lime, Evening Moscow, Berry Kiss, Wild Heart
`;

  const basePrompt = `You are a fast, efficient voice assistant for a shisha lounge ordering system. Your goal is to help customers order hookah in under 30 seconds.

${menuInfo}

CRITICAL RULES:
1. Be EXTREMELY concise - use short sentences
2. NEVER make small talk or ask "how are you"
3. Follow this exact flow:
   - Step 1: Ask what flavor they want (suggest 2-3 options if unsure)
   - Step 2: Ask strength preference: Ultra Light, Light, Medium, or Bold Strong
   - Step 3: Ask how many hookahs (1-5)
   - Step 4: Confirm the order and say "Order complete!"
4. If user doesn't know what flavor, quickly list 2-3 popular options
5. Keep responses under 15 words
6. Use prices from menu when confirming

EXAMPLE DIALOGUE:
Assistant: "What flavor? Popular: Two Apple, Mint, or Watermelon"
User: "Mint"
Assistant: "Mint. What strength - Light, Medium, or Bold?"
User: "Medium"
Assistant: "How many hookahs?"
User: "Two"
Assistant: "2 Medium Mint hookahs, 800k total. Order complete!"`;

  if (language === 'ru') {
    return basePrompt + `\n\nIMPORTANT: Respond in Russian. If user speaks Russian, continue in Russian.`;
  } else if (language === 'id') {
    return basePrompt + `\n\nIMPORTANT: Respond in Indonesian. If user speaks Indonesian, continue in Indonesian.`;
  }
  
  return basePrompt + `\n\nIMPORTANT: Start in English but automatically switch to match the user's language.`;
}
