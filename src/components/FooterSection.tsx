import { motion } from "framer-motion";
import shishaImage from "@/assets/shisha-smoke.jpg";
import { useLanguage } from "@/contexts/LanguageContext";
import PaymentMethods from "./PaymentMethods";

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
        {/* Payment Methods */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-16"
        >
          <PaymentMethods />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
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
          
          <p className="font-body text-xs text-muted-foreground tracking-[0.2em] uppercase mb-8">
            {t("footer.tagline")}
          </p>

          {/* Address */}
          <a 
            href="https://maps.google.com/?q=The+Umalas+Signature,+Jl.+Bumbak+No.156,+Kerobokan,+Bali"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center space-y-1 group mb-6"
          >
            <p className="font-display text-lg text-golden group-hover:text-golden/80 transition-colors">The Umalas Signature</p>
            <p className="font-body text-sm text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
              Jl. Bumbak No.156, Kerobokan, Kec. Kuta Utara,<br />
              Kabupaten Badung, Bali 80361
            </p>
          </a>

          {/* WhatsApp Contact */}
          <a 
            href="https://wa.me/6287750783373"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[#25D366] hover:text-[#20BD5A] transition-colors group"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span className="font-body text-sm group-hover:underline">+62 877-5078-3373</span>
          </a>
        </motion.div>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-golden/30 to-transparent" />
    </footer>
  );
};

export default FooterSection;
