import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import valentineBanner from "@/assets/valentine-banner.png";

const BANNER_DISMISSED_KEY = "valentine-banner-dismissed";

export const ValentineBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const dismissed = sessionStorage.getItem(BANNER_DISMISSED_KEY);
    if (!dismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    sessionStorage.setItem(BANNER_DISMISSED_KEY, "true");
  };

  const handleNavigate = () => {
    handleClose();
    navigate("/valentine");
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative max-w-md w-full cursor-pointer"
            onClick={(e) => { e.stopPropagation(); handleNavigate(); }}
          >
            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); handleClose(); }}
              className="absolute -top-3 -right-3 z-10 bg-background text-foreground rounded-full p-1.5 shadow-xl border border-border"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Banner image */}
            <img
              src={valentineBanner}
              alt="Valentine Series - Shisha Cool"
              className="w-full rounded-2xl shadow-2xl"
            />

            {/* CTA overlay */}
            <motion.div
              className="absolute bottom-4 left-4 right-4 bg-red-500/90 backdrop-blur-sm text-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 font-semibold shadow-lg"
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Heart className="w-5 h-5 fill-white" />
              Order Now
              <Heart className="w-5 h-5 fill-white" />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
