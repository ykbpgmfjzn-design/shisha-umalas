import { motion } from "framer-motion";
import shishaImage from "@/assets/shisha-smoke.jpg";
import { useLanguage } from "@/contexts/LanguageContext";

const FooterSection = () => {
  const { t } = useLanguage();

  return (
    <footer className="relative py-24 bg-background overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <img
          src={shishaImage}
          alt="Shisha atmosphere"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/70" />
      </div>

      <div className="container max-w-4xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          {/* Decorative element */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-golden" />
            <div className="w-2 h-2 rounded-full bg-golden glow-pulse" />
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-golden" />
          </div>

          <h3 className="font-display text-3xl md:text-5xl text-foreground mb-4">
            {t("footer.inhale")} <span className="text-gradient-golden">{t("footer.moment")}</span>
          </h3>
          
          <p className="font-body text-muted-foreground max-w-md mx-auto mb-8 text-sm md:text-base leading-relaxed">
            {t("footer.description")}
          </p>

          <div className="w-16 h-px bg-gradient-golden mx-auto mb-8" />
          
          <p className="font-body text-xs text-muted-foreground tracking-[0.2em] uppercase">
            {t("footer.tagline")}
          </p>
        </motion.div>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-golden/30 to-transparent" />
    </footer>
  );
};

export default FooterSection;
