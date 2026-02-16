import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star, ExternalLink, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const GOOGLE_REVIEW_URL = "https://g.page/r/CWUVTUf3-kd2EBM/review";

interface GooglePromptScreenProps {
  t: (key: string) => string;
  onBack: () => void;
}

const GooglePromptScreen = ({ t, onBack }: GooglePromptScreenProps) => {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (countdown <= 0) {
      window.location.href = GOOGLE_REVIEW_URL;
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  return (
    <div className="pt-24 px-4 max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-6 py-12"
      >
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="font-display text-2xl text-golden">
          {t("feedback.thankYou")}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
          {t("feedback.thankYouRedirect")}
        </p>
        <p className="text-golden/70 text-xs">
          Redirecting in {countdown}s...
        </p>
        <div className="flex flex-col gap-3 pt-4">
          <a
            href={GOOGLE_REVIEW_URL}
            className="inline-flex items-center justify-center gap-2 bg-golden text-background font-bold py-3 px-6 rounded-full hover:bg-golden/90 transition-colors"
          >
            <Star className="w-5 h-5 fill-current" />
            Leave a Google Review
            <ExternalLink className="w-4 h-4" />
          </a>
          <Button
            variant="outline"
            className="border-golden/30 text-golden hover:bg-golden/10 rounded-full py-3"
            onClick={onBack}
          >
            <Home className="w-4 h-4 mr-2" />
            {t("nav.home") || "Back to Site"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default GooglePromptScreen;
