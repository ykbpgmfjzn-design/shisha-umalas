import { motion } from "framer-motion";
import { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface MenuItemProps {
  name: string;
  description?: string;
  price: string;
  isSignature?: boolean;
  delay?: number;
}

const MenuItem = ({ name, description, price, isSignature, delay = 0 }: MenuItemProps) => {
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay }}
      className="group"
    >
      <div className="flex justify-between items-start gap-4 py-4 border-b border-border/30 hover:border-golden/30 transition-colors duration-300">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h4 className={`font-display text-xl md:text-2xl ${isSignature ? 'text-golden' : 'text-foreground'} group-hover:text-golden transition-colors duration-300`}>
              {name}
            </h4>
            {isSignature && (
              <span className="text-[10px] uppercase tracking-widest text-sunset border border-sunset/40 px-2 py-0.5 rounded-full">
                {t("menu.signature")}
              </span>
            )}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 font-body">
              {description}
            </p>
          )}
        </div>
        <span className="font-display text-lg md:text-xl text-smoke-light whitespace-nowrap">
          {price}
        </span>
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
  "ultra-light": "from-smoke/20 to-smoke/5",
  "light": "from-smoke-light/20 to-smoke/10",
  "medium": "from-golden/20 to-amber/10",
  "bold": "from-sunset/20 to-accent/10",
};

const strengthBadge = {
  "ultra-light": "bg-smoke/20 text-smoke-light",
  "light": "bg-smoke-light/20 text-smoke-light",
  "medium": "bg-golden/20 text-golden",
  "bold": "bg-sunset/20 text-sunset",
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
      <div className={`bg-gradient-to-br ${strengthColors[strength]} backdrop-blur-sm rounded-2xl p-8 md:p-10 shadow-card border border-border/20`}>
        {/* Category Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="font-display text-3xl md:text-4xl text-foreground tracking-wide">
              {title}
            </h3>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1 tracking-widest uppercase font-body">
                {subtitle}
              </p>
            )}
          </div>
          <span className={`${strengthBadge[strength]} text-xs uppercase tracking-widest px-4 py-2 rounded-full font-body`}>
            {t(strengthLabels[strength])}
          </span>
        </div>

        {/* Menu Items */}
        <div className="space-y-1">
          {children}
        </div>
      </div>
    </motion.div>
  );
};

const MenuSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative py-24 md:py-32 bg-background">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-golden/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-sunset/5 rounded-full blur-3xl" />
      </div>

      <div className="container max-w-4xl mx-auto px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <p className="text-sm text-golden tracking-[0.3em] uppercase mb-4 font-body">
            {t("menu.ourSelection")}
          </p>
          <h2 className="font-display text-4xl md:text-6xl text-foreground mb-6">
            {t("menu.curatedFlavors")}
          </h2>
          <div className="w-16 h-px bg-gradient-golden mx-auto" />
        </motion.div>

        {/* Menu Categories */}
        <div className="space-y-12">
          {/* Ultra Light */}
          <MenuCategory title={t("strength.ultraLight")} strength="ultra-light" delay={0}>
            <p className="text-sm text-muted-foreground uppercase tracking-widest mb-4 font-body">{t("menu.singleFlavor")}</p>
            <MenuItem name="Whiteline Vanilla" price="IDR 280K" delay={0.1} />
            <MenuItem name="Whiteline Oolong Tea" price="IDR 280K" delay={0.15} />
            <MenuItem name="Herbaline Watermelon" price="IDR 280K" delay={0.2} />
            
            <p className="text-sm text-muted-foreground uppercase tracking-widest mt-8 mb-4 font-body">{t("menu.signatureMixes")}</p>
            <MenuItem 
              name="Vanilla Breeze" 
              description="Whiteline Vanilla & Whiteline Ice" 
              price="IDR 320K" 
              isSignature 
              delay={0.25} 
            />
            <MenuItem 
              name="Watermelon Wave" 
              description="Herbaline Watermelon & Whiteline Oolong Tea" 
              price="IDR 320K" 
              isSignature 
              delay={0.3} 
            />
          </MenuCategory>

          {/* Light */}
          <MenuCategory title={t("strength.light")} strength="light" delay={0.1}>
            <p className="text-sm text-muted-foreground uppercase tracking-widest mb-4 font-body">{t("menu.singleFlavor")}</p>
            <MenuItem name="Whiteline Mint" price="IDR 295K" delay={0.1} />
            <MenuItem name="Al Fakher Two Apple" price="IDR 295K" delay={0.15} />
            
            <p className="text-sm text-muted-foreground uppercase tracking-widest mt-8 mb-4 font-body">{t("menu.signatureMixes")}</p>
            <MenuItem 
              name="Minty Grapes" 
              description="Sweet grape & cooling mint" 
              price="IDR 335K" 
              isSignature 
              delay={0.2} 
            />
            <MenuItem 
              name="Minty Gum" 
              description="Sweet Minty Aroma & Soft Flavor" 
              price="IDR 335K" 
              isSignature 
              delay={0.25} 
            />
          </MenuCategory>

          {/* Medium */}
          <MenuCategory title={t("strength.medium")} strength="medium" delay={0.2}>
            <p className="text-sm text-muted-foreground uppercase tracking-widest mb-4 font-body">{t("menu.singleFlavor")}</p>
            <MenuItem name="Blackline African Queen" price="IDR 325K" delay={0.1} />
            <MenuItem name="Blackline Spicey Lime" price="IDR 325K" delay={0.15} />
            <MenuItem name="Blackline Booster" price="IDR 325K" delay={0.2} />
            <MenuItem name="Adalya Moscow Evening" price="IDR 325K" delay={0.25} />
            
            <p className="text-sm text-muted-foreground uppercase tracking-widest mt-8 mb-4 font-body">{t("menu.signatureMixes")}</p>
            <MenuItem 
              name="Tipsy Lime" 
              description="Blackline African Queen & Blackline Spicey Lime" 
              price="IDR 405K" 
              isSignature 
              delay={0.3} 
            />
            <MenuItem 
              name="Evening Moscow" 
              description="Adalya Moscow Evening & Blackline Booster" 
              price="IDR 405K" 
              isSignature 
              delay={0.35} 
            />
          </MenuCategory>

          {/* Bold Strong */}
          <MenuCategory title={t("strength.boldStrong")} strength="bold" delay={0.3}>
            <p className="text-sm text-muted-foreground uppercase tracking-widest mb-4 font-body">{t("menu.singleFlavor")}</p>
            <MenuItem name="Tangiers Cooling" price="IDR 380K" delay={0.1} />
            <MenuItem name="Tangiers Schnozzberry" price="IDR 380K" delay={0.15} />
            <MenuItem name="Darkside Polar Cream" price="IDR 345K" delay={0.2} />
            <MenuItem name="Darkside Supernova" price="IDR 345K" delay={0.25} />
            
            <p className="text-sm text-muted-foreground uppercase tracking-widest mt-8 mb-4 font-body">{t("menu.signatureMixes")}</p>
            <MenuItem 
              name="Berry Kiss" 
              description="Darkside Polar Cream & Tangiers Schnozzberry" 
              price="IDR 485K" 
              isSignature 
              delay={0.3} 
            />
            <MenuItem 
              name="Wild Heart" 
              description="Tangiers Cooling & Darkside Supernova" 
              price="IDR 485K" 
              isSignature 
              delay={0.35} 
            />
          </MenuCategory>
        </div>
      </div>
    </section>
  );
};

export default MenuSection;
