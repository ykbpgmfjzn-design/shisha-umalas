import { motion, AnimatePresence } from "framer-motion";
import { useState, useContext } from "react";
import { Link } from "react-router-dom";
import { LanguageContext, Language } from "@/contexts/LanguageContext";
import { Globe } from "lucide-react";
import AuthButton from "./AuthButton";
import logo from "@/assets/logo-shisha-cool.png";

const languages: { code: Language; name: string; flag: string }[] = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "id", name: "Indonesia", flag: "🇮🇩" },
  { code: "uk", name: "Українська", flag: "🇺🇦" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
];

const LanguageSelector = () => {
  const context = useContext(LanguageContext);
  const [isOpen, setIsOpen] = useState(false);

  // Return null if context is not available yet
  if (!context) return null;

  const { language, setLanguage } = context;
  const currentLang = languages.find((l) => l.code === language);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-background/60 backdrop-blur-md border-b border-border/20">
      {/* Logo */}
      <Link to="/">
        <img src={logo} alt="Shisha Cool" className="h-12 w-auto hover:opacity-80 transition-opacity" />
      </Link>
      
      {/* Right side controls */}
      <div className="flex items-center gap-3 relative">
        <AuthButton />
      
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-background/80 backdrop-blur-md border border-border/40 rounded-full text-foreground hover:border-golden/50 transition-colors duration-300 shadow-card"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Globe className="w-4 h-4 text-golden" />
          <span className="text-lg">{currentLang?.flag}</span>
          <span className="font-body text-sm hidden sm:inline">{currentLang?.name}</span>
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0"
                onClick={() => setIsOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full right-0 mt-2 py-2 bg-background/95 backdrop-blur-md border border-border/40 rounded-xl shadow-card min-w-[180px] overflow-hidden z-50"
              >
                {languages.map((lang, index) => (
                  <motion.button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-golden/10 transition-colors duration-200 ${
                      language === lang.code ? "bg-golden/5 text-golden" : "text-foreground"
                    }`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <span className="text-xl">{lang.flag}</span>
                    <span className="font-body text-sm">{lang.name}</span>
                    {language === lang.code && (
                      <motion.div
                        layoutId="activeLanguage"
                        className="ml-auto w-1.5 h-1.5 rounded-full bg-golden"
                      />
                    )}
                  </motion.button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LanguageSelector;
