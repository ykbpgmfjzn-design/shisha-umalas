import { motion } from "framer-motion";
import { ReactNode, useState, useEffect } from "react";
import { Plus, ShoppingCart } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MenuItemProps {
  id: string;
  name: string;
  description?: string;
  price: number;
  priceDisplay: string;
  isSignature?: boolean;
  delay?: number;
  strength: string;
}

const MenuItem = ({ id, name, description, price, priceDisplay, isSignature, delay = 0, strength }: MenuItemProps) => {
  const { t } = useLanguage();
  const { addItem } = useCart();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAddToCart = () => {
    if (!user) {
      toast.info(t("menu.loginToOrder"));
      return;
    }
    
    addItem({
      id,
      name,
      description,
      price,
      priceDisplay,
      strength,
      isSignature,
    });
    toast.success(t("menu.addedToCart"));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay }}
      className="group"
    >
      <div className="flex items-center gap-4 py-4 px-4 rounded-xl bg-background/50 hover:bg-background/80 border border-transparent hover:border-golden/20 transition-all duration-300">
        {/* Item Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`font-display text-lg md:text-xl ${isSignature ? 'text-golden' : 'text-foreground'} group-hover:text-golden transition-colors duration-300 truncate`}>
              {name}
            </h4>
            {isSignature && (
              <span className="text-[9px] uppercase tracking-widest text-sunset border border-sunset/40 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                {t("menu.signature")}
              </span>
            )}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5 font-body line-clamp-1">
              {description}
            </p>
          )}
        </div>

        {/* Price */}
        <div className="font-display text-lg md:text-xl text-smoke-light whitespace-nowrap">
          {priceDisplay}
        </div>

        {/* Add Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleAddToCart}
          className={`p-3 rounded-xl transition-all duration-300 flex-shrink-0 ${
            user 
              ? 'bg-golden/20 hover:bg-golden text-golden hover:text-background' 
              : 'bg-muted/50 text-muted-foreground cursor-default'
          }`}
        >
          <Plus className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );
};

interface MenuCategoryProps {
  title: string;
  subtitle?: string;
  strength: "ultra-light" | "light" | "medium" | "bold";
  children: ReactNode;
  delay?: number;
}

const strengthColors = {
  "ultra-light": "from-smoke/30 to-smoke/10",
  "light": "from-smoke-light/30 to-smoke/15",
  "medium": "from-golden/25 to-amber/15",
  "bold": "from-sunset/25 to-accent/15",
};

const strengthBadge = {
  "ultra-light": "bg-smoke/30 text-smoke-light border-smoke/50",
  "light": "bg-smoke-light/30 text-smoke-light border-smoke-light/50",
  "medium": "bg-golden/30 text-golden border-golden/50",
  "bold": "bg-sunset/30 text-sunset border-sunset/50",
};

const strengthLabels: Record<string, string> = {
  "ultra-light": "strength.ultraLight",
  "light": "strength.light",
  "medium": "strength.medium",
  "bold": "strength.boldStrong",
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
        {/* Category Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/30">
          <div>
            <h3 className="font-display text-2xl md:text-3xl text-foreground tracking-wide">
              {title}
            </h3>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1 tracking-widest uppercase font-body">
                {subtitle}
              </p>
            )}
          </div>
          <span className={`${strengthBadge[strength]} text-xs uppercase tracking-widest px-3 py-1.5 rounded-full font-body border`}>
            {t(strengthLabels[strength])}
          </span>
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

const MenuSection = () => {
  const { t } = useLanguage();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
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
          {user ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-golden/10 text-golden px-4 py-2 rounded-full text-sm"
            >
              <ShoppingCart className="w-4 h-4" />
              {t("menu.clickToAdd")}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-muted/50 text-muted-foreground px-4 py-2 rounded-full text-sm"
            >
              {t("menu.loginToOrderHint")}
            </motion.div>
          )}
        </motion.div>

        {/* Menu Categories */}
        <div className="space-y-8">
          {/* Ultra Light */}
          <MenuCategory title={t("strength.ultraLight")} strength="ultra-light" delay={0}>
            <SubCategory title={t("menu.singleFlavor")}>
              <MenuItem id="wl-vanilla" name="Whiteline Vanilla" price={280000} priceDisplay="IDR 280K" strength="Ultra Light" delay={0.1} />
              <MenuItem id="wl-oolong" name="Whiteline Oolong Tea" price={280000} priceDisplay="IDR 280K" strength="Ultra Light" delay={0.15} />
              <MenuItem id="hl-watermelon" name="Herbaline Watermelon" price={280000} priceDisplay="IDR 280K" strength="Ultra Light" delay={0.2} />
            </SubCategory>
            
            <SubCategory title={t("menu.signatureMixes")}>
              <MenuItem 
                id="vanilla-breeze"
                name="Vanilla Breeze" 
                description="Whiteline Vanilla & Whiteline Ice" 
                price={320000}
                priceDisplay="IDR 320K" 
                isSignature 
                strength="Ultra Light"
                delay={0.25} 
              />
              <MenuItem 
                id="watermelon-wave"
                name="Watermelon Wave" 
                description="Herbaline Watermelon & Whiteline Oolong Tea" 
                price={320000}
                priceDisplay="IDR 320K" 
                isSignature 
                strength="Ultra Light"
                delay={0.3} 
              />
            </SubCategory>
          </MenuCategory>

          {/* Light */}
          <MenuCategory title={t("strength.light")} strength="light" delay={0.1}>
            <SubCategory title={t("menu.singleFlavor")}>
              <MenuItem id="wl-mint" name="Whiteline Mint" price={295000} priceDisplay="IDR 295K" strength="Light" delay={0.1} />
              <MenuItem id="af-two-apple" name="Al Fakher Two Apple" price={295000} priceDisplay="IDR 295K" strength="Light" delay={0.15} />
            </SubCategory>
            
            <SubCategory title={t("menu.signatureMixes")}>
              <MenuItem 
                id="minty-grapes"
                name="Minty Grapes" 
                description="Sweet grape & cooling mint" 
                price={335000}
                priceDisplay="IDR 335K" 
                isSignature 
                strength="Light"
                delay={0.2} 
              />
              <MenuItem 
                id="minty-gum"
                name="Minty Gum" 
                description="Sweet Minty Aroma & Soft Flavor" 
                price={335000}
                priceDisplay="IDR 335K" 
                isSignature 
                strength="Light"
                delay={0.25} 
              />
            </SubCategory>
          </MenuCategory>

          {/* Medium */}
          <MenuCategory title={t("strength.medium")} strength="medium" delay={0.2}>
            <SubCategory title={t("menu.singleFlavor")}>
              <MenuItem id="bl-african" name="Blackline African Queen" price={325000} priceDisplay="IDR 325K" strength="Medium" delay={0.1} />
              <MenuItem id="bl-spicy-lime" name="Blackline Spicey Lime" price={325000} priceDisplay="IDR 325K" strength="Medium" delay={0.15} />
              <MenuItem id="bl-booster" name="Blackline Booster" price={325000} priceDisplay="IDR 325K" strength="Medium" delay={0.2} />
              <MenuItem id="adalya-moscow" name="Adalya Moscow Evening" price={325000} priceDisplay="IDR 325K" strength="Medium" delay={0.25} />
            </SubCategory>
            
            <SubCategory title={t("menu.signatureMixes")}>
              <MenuItem 
                id="tipsy-lime"
                name="Tipsy Lime" 
                description="Blackline African Queen & Blackline Spicey Lime" 
                price={405000}
                priceDisplay="IDR 405K" 
                isSignature 
                strength="Medium"
                delay={0.3} 
              />
              <MenuItem 
                id="evening-moscow"
                name="Evening Moscow" 
                description="Adalya Moscow Evening & Blackline Booster" 
                price={405000}
                priceDisplay="IDR 405K" 
                isSignature 
                strength="Medium"
                delay={0.35} 
              />
            </SubCategory>
          </MenuCategory>

          {/* Bold Strong */}
          <MenuCategory title={t("strength.boldStrong")} strength="bold" delay={0.3}>
            <SubCategory title={t("menu.singleFlavor")}>
              <MenuItem id="tangiers-cooling" name="Tangiers Cooling" price={380000} priceDisplay="IDR 380K" strength="Bold Strong" delay={0.1} />
              <MenuItem id="tangiers-schnozz" name="Tangiers Schnozzberry" price={380000} priceDisplay="IDR 380K" strength="Bold Strong" delay={0.15} />
              <MenuItem id="darkside-polar" name="Darkside Polar Cream" price={345000} priceDisplay="IDR 345K" strength="Bold Strong" delay={0.2} />
              <MenuItem id="darkside-supernova" name="Darkside Supernova" price={345000} priceDisplay="IDR 345K" strength="Bold Strong" delay={0.25} />
            </SubCategory>
            
            <SubCategory title={t("menu.signatureMixes")}>
              <MenuItem 
                id="berry-kiss"
                name="Berry Kiss" 
                description="Darkside Polar Cream & Tangiers Schnozzberry" 
                price={485000}
                priceDisplay="IDR 485K" 
                isSignature 
                strength="Bold Strong"
                delay={0.3} 
              />
              <MenuItem 
                id="wild-heart"
                name="Wild Heart" 
                description="Tangiers Cooling & Darkside Supernova" 
                price={485000}
                priceDisplay="IDR 485K" 
                isSignature 
                strength="Bold Strong"
                delay={0.35} 
              />
            </SubCategory>
          </MenuCategory>
        </div>
      </div>
    </section>
  );
};

export default MenuSection;
