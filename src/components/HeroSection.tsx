import { motion } from "framer-motion";
import heroVideo from "@/assets/hero-video.mp4";
import { useLanguage } from "@/contexts/LanguageContext";

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Video */}
      <div className="absolute inset-0">
        <video
          src={heroVideo}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-smoke" />
        <div className="absolute inset-0 bg-background/40" />
      </div>

      {/* Floating smoke particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-32 h-32 rounded-full bg-smoke/10 blur-3xl"
            style={{
              left: `${20 + i * 15}%`,
              top: `${30 + (i % 3) * 20}%`,
            }}
            animate={{
              y: [-20, 20, -20],
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 6 + i,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.5,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <h1 className="font-display text-6xl md:text-8xl lg:text-9xl font-light tracking-wider mb-6">
            <span 
              className="text-gradient-golden"
              style={{
                textShadow: '0 4px 20px rgba(0,0,0,0.8), 0 2px 10px rgba(0,0,0,0.9), 0 0 60px rgba(212,175,55,0.4)',
                filter: 'drop-shadow(0 0 30px rgba(0,0,0,0.5))'
              }}
            >
              {t("hero.title")}
            </span>
          </h1>
          <p 
            className="font-display text-2xl md:text-3xl text-smoke-light tracking-[0.3em] mb-4"
            style={{
              textShadow: '0 2px 15px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.7)'
            }}
          >
            {t("hero.subtitle")}
          </p>
          <div className="w-24 h-px bg-gradient-golden mx-auto mb-8" />
          <p className="font-body text-sm md:text-base text-muted-foreground tracking-widest uppercase">
            {t("hero.tagline")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="mt-16"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="inline-block"
          >
            <svg
              className="w-6 h-10 text-golden"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 40"
            >
              <rect x="1" y="1" width="22" height="38" rx="11" strokeWidth="2" />
              <motion.circle
                cx="12"
                cy="12"
                r="4"
                fill="currentColor"
                animate={{ y: [0, 16, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </svg>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
