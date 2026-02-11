import { motion, AnimatePresence } from "framer-motion";
import { ReactNode, useState, useEffect } from "react";
import { Plus, ChevronDown, ShoppingCart } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { getMenuDescription } from "@/data/menuTranslations";
import { supabase } from "@/integrations/supabase/client";

import { ItemType } from "@/hooks/useCart";

interface MenuItemProps {
  id: string;
  name: string;
  nameTranslations?: Record<string, string>;
  descriptionTranslations?: Record<string, string>;
  dbDescription?: string;
  price: number;
  priceDisplay: string;
  isSignature?: boolean;
  delay?: number;
  strength?: string;
  itemType?: ItemType;
}

const MenuItem = ({ id, name, nameTranslations, descriptionTranslations, dbDescription, price, priceDisplay, isSignature, delay = 0, strength, itemType = "hookah" }: MenuItemProps) => {
  const { t, language } = useLanguage();
  const { addItem } = useCart();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get localized name: prefer DB translations, then fallback to English
  const displayName = (language !== "en" && nameTranslations?.[language]) || name;

  // Get localized description: prefer DB translations, then fallback to menuTranslations.ts, then English DB description
  const description = (language !== "en" && descriptionTranslations?.[language])
    || getMenuDescription(id, language)
    || (language === "en" ? dbDescription : undefined)
    || dbDescription;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({
      id,
      name,
      description,
      price,
      priceDisplay,
      strength,
      isSignature,
      itemType,
    });
    toast.success(t("menu.addedToCart"));
  };

  const toggleExpand = () => {
    if (description) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay }}
      className="group"
    >
      <div 
        className={`py-4 px-4 rounded-xl bg-background/50 hover:bg-background/80 border border-transparent hover:border-golden/20 transition-all duration-300 ${description ? 'cursor-pointer' : ''}`}
        onClick={toggleExpand}
      >
        <div className="flex items-center gap-4">
          {/* Item Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className={`font-display text-lg md:text-xl ${isSignature ? 'text-golden' : 'text-foreground'} group-hover:text-golden transition-colors duration-300`}>
                {displayName}
              </h4>
              {isSignature && (
                <span className="text-[9px] uppercase tracking-widest text-sunset border border-sunset/40 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                  {t("menu.signature")}
                </span>
              )}
            </div>
            {description && !isExpanded && (
              <p className="text-sm text-muted-foreground mt-0.5 font-body line-clamp-1">
                {description}
              </p>
            )}
          </div>

          {/* Expand indicator */}
          {description && (
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-muted-foreground flex-shrink-0"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          )}

          {/* Price */}
          <div className="font-display text-lg md:text-xl text-smoke-light whitespace-nowrap">
            {priceDisplay}
          </div>

          {/* Add Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAddToCart}
            className="p-3 rounded-xl transition-all duration-300 flex-shrink-0 bg-golden/20 hover:bg-golden text-golden hover:text-background"
          >
            <Plus className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Expanded Description */}
        <AnimatePresence>
          {isExpanded && description && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <p className="text-sm text-muted-foreground mt-3 pt-3 border-t border-border/30 font-body">
                {description}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

interface MenuCategoryProps {
  title: string;
  subtitle?: string;
  strength: "ultra-light" | "light" | "medium" | "bold" | "extra";
  children: ReactNode;
  delay?: number;
}

const strengthColors = {
  "ultra-light": "from-smoke/30 to-smoke/10",
  "light": "from-smoke-light/30 to-smoke/15",
  "medium": "from-golden/25 to-amber/15",
  "bold": "from-sunset/25 to-accent/15",
  "extra": "from-emerald-500/20 to-teal-500/10",
};

const strengthBadge = {
  "ultra-light": "bg-smoke/30 text-smoke-light border-smoke/50",
  "light": "bg-smoke-light/30 text-smoke-light border-smoke-light/50",
  "medium": "bg-golden/30 text-golden border-golden/50",
  "bold": "bg-sunset/30 text-sunset border-sunset/50",
  "extra": "bg-emerald-500/30 text-emerald-400 border-emerald-500/50",
};

const strengthLabels: Record<string, string> = {
  "ultra-light": "strength.ultraLight",
  "light": "strength.light",
  "medium": "strength.medium",
  "bold": "strength.boldStrong",
  "extra": "menu.extras",
};

const MenuCategory = ({ title, subtitle, strength, children, delay = 0 }: MenuCategoryProps) => {
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, delay }}
      className="relative"
    >
      <div className={`bg-gradient-to-br ${strengthColors[strength]} backdrop-blur-md rounded-2xl p-6 md:p-8 shadow-card border border-border/30`}>
        <div className="mb-6 pb-4 border-b border-border/30">
          <h3 className="font-display text-2xl md:text-3xl text-foreground tracking-wide">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1 tracking-widest uppercase font-body">
              {subtitle}
            </p>
          )}
        </div>

        {/* Menu Items */}
        <div className="space-y-2">
          {children}
        </div>
      </div>
    </motion.div>
  );
};

interface SubCategoryProps {
  title: string;
  children: ReactNode;
}

const SubCategory = ({ title, children }: SubCategoryProps) => (
  <div className="mb-6 last:mb-0">
    <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mb-3 font-body px-4 flex items-center gap-2">
      <span className="w-6 h-px bg-gradient-to-r from-golden/50 to-transparent" />
      {title}
      <span className="flex-1 h-px bg-gradient-to-r from-transparent via-border/30 to-transparent" />
    </p>
    <div className="space-y-1">
      {children}
    </div>
  </div>
);

const strengthToKey: Record<string, "ultra-light" | "light" | "medium" | "bold" | "extra"> = {
  "Ultra Light": "ultra-light",
  "Light": "light",
  "Medium": "medium",
  "Bold Strong": "bold",
  "Extra": "extra",
};

const strengthOrder = ["Ultra Light", "Light", "Medium", "Bold Strong", "Extra"];

interface DbMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  price_display: string;
  strength: string;
  is_signature: boolean;
  item_type: string;
  sort_order: number;
  name_translations: Record<string, string> | any;
  description_translations: Record<string, string> | any;
}

const MenuSection = () => {
  const { t } = useLanguage();
  const [dbItems, setDbItems] = useState<DbMenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);

  useEffect(() => {
    const fetchMenu = async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, name, description, price, price_display, strength, is_signature, item_type, sort_order, name_translations, description_translations")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!error && data) {
        setDbItems(data);
      }
      setLoadingMenu(false);
    };
    fetchMenu();
  }, []);

  return (
    <section className="relative py-24 md:py-32 bg-background" id="menu">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-golden/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-sunset/5 rounded-full blur-3xl" />
      </div>

      <div className="container max-w-4xl mx-auto px-4 md:px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm text-golden tracking-[0.3em] uppercase mb-4 font-body">
            {t("menu.ourSelection")}
          </p>
          <h2 className="font-display text-4xl md:text-6xl text-foreground mb-6">
            {t("menu.curatedFlavors")}
          </h2>
          <div className="w-16 h-px bg-gradient-golden mx-auto mb-6" />
          
          {/* Order instruction */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-golden/10 text-golden px-4 py-2 rounded-full text-sm"
          >
            <ShoppingCart className="w-4 h-4" />
            {t("menu.clickToAdd")}
          </motion.div>
        </motion.div>

        {/* Menu Categories */}
        <div className="space-y-8">
          {loadingMenu ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            strengthOrder
              .filter((strength) => dbItems.some((i) => i.strength === strength))
              .map((strength, catIdx) => {
                const key = strengthToKey[strength] || "light";
                const categoryItems = dbItems.filter((i) => i.strength === strength);
                const singles = categoryItems.filter((i) => !i.is_signature);
                const signatures = categoryItems.filter((i) => i.is_signature);

                return (
                  <MenuCategory
                    key={strength}
                    title={t(strengthLabels[key] || key)}
                    strength={key}
                    delay={catIdx * 0.1}
                  >
                    {singles.length > 0 && strength !== "Extra" && (
                      <SubCategory title={t("menu.singleFlavor")}>
                        {singles.map((item, i) => (
                          <MenuItem
                            key={item.id}
                            id={item.id}
                            name={item.name}
                            nameTranslations={item.name_translations}
                            descriptionTranslations={item.description_translations}
                            dbDescription={item.description}
                            price={item.price}
                            priceDisplay={item.price_display}
                            strength={item.strength}
                            isSignature={false}
                            itemType={item.item_type as any}
                            delay={i * 0.05}
                          />
                        ))}
                      </SubCategory>
                    )}
                    {signatures.length > 0 && strength !== "Extra" && (
                      <SubCategory title={t("menu.signatureMixes")}>
                        {signatures.map((item, i) => (
                          <MenuItem
                            key={item.id}
                            id={item.id}
                            name={item.name}
                            nameTranslations={item.name_translations}
                            descriptionTranslations={item.description_translations}
                            dbDescription={item.description}
                            price={item.price}
                            priceDisplay={item.price_display}
                            strength={item.strength}
                            isSignature
                            itemType={item.item_type as any}
                            delay={i * 0.05}
                          />
                        ))}
                      </SubCategory>
                    )}
                    {strength === "Extra" &&
                      categoryItems.map((item, i) => (
                        <MenuItem
                          key={item.id}
                          id={item.id}
                          name={item.name}
                          nameTranslations={item.name_translations}
                          descriptionTranslations={item.description_translations}
                          dbDescription={item.description}
                          price={item.price}
                          priceDisplay={item.price_display}
                          strength={item.strength}
                          itemType={item.item_type as any}
                          delay={i * 0.05}
                        />
                      ))}
                  </MenuCategory>
                );
              })
          )}
        </div>
      </div>
    </section>
  );
};

export default MenuSection;
