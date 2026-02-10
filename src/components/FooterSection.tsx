import { motion } from "framer-motion";
import shishaImage from "@/assets/shisha-smoke.jpg";
import { useLanguage } from "@/contexts/LanguageContext";

const FooterSection = () => {
  const { t } = useLanguage();

  return (
    <footer aria-label="Contact and location information" className="relative py-24 bg-background overflow-hidden">
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

          {/* Social Links */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">
            {/* WhatsApp Contact */}
            <a 
              href="https://wa.me/6287750783373"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 text-[#25D366] hover:text-[#20BD5A] transition-colors group"
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span className="font-body text-base group-hover:underline">+62 877-5078-3373</span>
            </a>

            {/* Instagram */}
            <a 
              href="https://www.instagram.com/shisha.cool.lounge/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 text-[#E4405F] hover:text-[#C13584] transition-colors group"
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              <span className="font-body text-base group-hover:underline">@shisha.cool.lounge</span>
            </a>
          </div>
        </motion.div>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-golden/30 to-transparent" />
    </footer>
  );
};

export default FooterSection;
