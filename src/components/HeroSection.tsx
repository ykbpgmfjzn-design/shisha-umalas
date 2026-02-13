import { motion, useScroll, useTransform } from "framer-motion";
import heroVideo from "@/assets/hero-animated-bg.mp4";
import logo from "@/assets/shisha-cool-logo-new.svg";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";

const HeroSection = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"]
  });
  
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.8], [0.6, 0.95]);

  return (
    <section ref={sectionRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Video */}
      <div className="absolute inset-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src={heroVideo} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-smoke" />
        <motion.div 
          className="absolute inset-0 bg-background" 
          style={{ opacity: overlayOpacity }}
        />
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
          <motion.div 
            className="mb-6 flex justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
            }}
            transition={{ 
              duration: 1.2, 
              ease: [0.25, 0.46, 0.45, 0.94],
              delay: 0.2
            }}
          >
            <motion.img 
              src={logo} 
              alt="Shisha Cool" 
              className="w-80 h-auto md:w-[28rem] lg:w-[32rem] object-contain"
              animate={{
                filter: [
                  'drop-shadow(0 0 20px rgba(212,175,55,0.3))',
                  'drop-shadow(0 0 60px rgba(212,175,55,0.6))',
                  'drop-shadow(0 0 20px rgba(212,175,55,0.3))',
                ],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>
          <h1 className="sr-only">Shisha Cool Bali — Premium Hookah Delivery & Lounge in Umalas, Seminyak, Canggu</h1>
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
          {/* Valentine CTA */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            onClick={() => navigate("/valentine")}
            className="mt-6 inline-flex items-center gap-2 bg-red-500/80 hover:bg-red-500 backdrop-blur-sm border border-red-400/40 px-5 py-2.5 rounded-full transition-colors cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Heart className="w-4 h-4 text-white fill-white" />
            <span className="text-white text-sm font-semibold tracking-wide">Valentine Series</span>
            <Heart className="w-4 h-4 text-white fill-white" />
          </motion.button>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="mt-4 inline-flex items-center gap-2 bg-golden/15 backdrop-blur-sm border border-golden/30 px-4 py-2 rounded-full"
          >
            <span className="text-golden text-lg">★</span>
            <span className="text-smoke-light text-sm font-medium">4.8</span>
            <span className="text-muted-foreground text-xs">from 100+ reviews</span>
          </motion.div>
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
