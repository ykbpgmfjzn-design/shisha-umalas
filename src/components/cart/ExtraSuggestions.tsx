import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ItemType } from "@/hooks/useCart";

interface ExtraItem {
  id: string;
  name: string;
  name_translations: Record<string, string> | null;
  description: string;
  description_translations: Record<string, string> | null;
  price: number;
  price_display: string;
  is_signature: boolean;
}

const ExtraSuggestions = () => {
  const { items, addItem } = useCart();
  const { t, language } = useLanguage();
  const [extras, setExtras] = useState<ExtraItem[]>([]);

  const hasHookah = items.some((item) => item.itemType === "hookah");
  const cartIds = new Set(items.map((i) => i.id));

  useEffect(() => {
    if (!hasHookah) return;
    const fetchExtras = async () => {
      const { data } = await supabase
        .from("menu_items")
        .select("id, name, name_translations, description, description_translations, price, price_display, is_signature")
        .eq("is_active", true)
        .eq("item_type", "extra")
        .order("sort_order", { ascending: true });
      if (data) setExtras(data as ExtraItem[]);
    };
    fetchExtras();
  }, [hasHookah]);

  const available = extras.filter((e) => !cartIds.has(e.id));

  if (!hasHookah || available.length === 0) return null;

  const getDisplayName = (item: ExtraItem) =>
    (language !== "en" && (item.name_translations as any)?.[language]) || item.name;

  const handleAdd = (item: ExtraItem) => {
    addItem(
      {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        priceDisplay: item.price_display,
        isSignature: item.is_signature,
        itemType: "extra" as ItemType,
      },
      false
    );
  };

  return (
    <div className="mt-4 pt-4 border-t border-border/30">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-golden" />
        <span className="text-sm font-display text-golden">{t("cart.extraTitle")}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {available.map((item) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleAdd(item)}
            className="flex-shrink-0 flex items-center gap-2 bg-muted/60 hover:bg-muted border border-border/40 rounded-xl px-3 py-2 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-golden" />
            <span className="text-sm text-foreground whitespace-nowrap">{getDisplayName(item)}</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {(item.price / 1000).toFixed(0)}K
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default ExtraSuggestions;
