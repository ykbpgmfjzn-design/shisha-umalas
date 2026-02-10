import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LANGUAGES = ["ru", "id", "uk", "fr", "hi", "zh"];
const LANGUAGE_NAMES: Record<string, string> = {
  ru: "Russian",
  id: "Indonesian",
  uk: "Ukrainian",
  fr: "French",
  hi: "Hindi",
  zh: "Chinese (Simplified)",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { itemId, name, description } = await req.json();

    if (!itemId || !name) {
      return new Response(JSON.stringify({ error: "itemId and name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Translate the following shisha/hookah menu item into these languages: ${LANGUAGES.map(l => LANGUAGE_NAMES[l]).join(", ")}.

Item name (English): "${name}"
${description ? `Description (English): "${description}"` : ""}

Return ONLY a JSON object with this exact structure (no markdown, no code blocks):
{
  "name_translations": {
    ${LANGUAGES.map(l => `"${l}": "translated name"`).join(",\n    ")}
  }${description ? `,
  "description_translations": {
    ${LANGUAGES.map(l => `"${l}": "translated description"`).join(",\n    ")}
  }` : ""}
}

Rules:
- Keep brand names (Whiteline, Darkside, Tangiers, etc.) unchanged
- Translate flavor/ingredient words naturally
- Keep translations concise and natural for a menu
- For product names that are brand names, keep them as-is across all languages`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are a professional translator for a shisha lounge menu. Return only valid JSON, no markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "Translation service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response (handle potential markdown wrapping)
    let translations;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      translations = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Failed to parse translations" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const updateData: Record<string, unknown> = {
      name_translations: translations.name_translations || {},
    };
    if (description && translations.description_translations) {
      updateData.description = description;
      updateData.description_translations = translations.description_translations;
    }

    const { error: dbError } = await supabase
      .from("menu_items")
      .update(updateData)
      .eq("id", itemId);

    if (dbError) {
      console.error("DB update error:", dbError);
      return new Response(JSON.stringify({ error: "Failed to save translations" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, translations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("translate-menu-item error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
