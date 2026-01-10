import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, X, Volume2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface VoiceAssistantOverlayProps {
  onStart: () => void;
  onDismiss: () => void;
}

const OVERLAY_SHOWN_KEY = 'voice-assistant-shown';

export const VoiceAssistantOverlay = ({ onStart, onDismiss }: VoiceAssistantOverlayProps) => {
  const [show, setShow] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    // Check if already shown this session
    const wasShown = sessionStorage.getItem(OVERLAY_SHOWN_KEY);
    if (wasShown) return;

    // Show after 1 second delay
    const timer = setTimeout(() => {
      setShow(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleStart = () => {
    sessionStorage.setItem(OVERLAY_SHOWN_KEY, 'true');
    setShow(false);
    onStart();
  };

  const handleDismiss = () => {
    sessionStorage.setItem(OVERLAY_SHOWN_KEY, 'true');
    setShow(false);
    onDismiss();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={handleDismiss}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative mx-4 max-w-md w-full bg-gradient-to-br from-card to-card/80 border border-primary/20 rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon with animation */}
            <div className="flex justify-center mb-6">
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  boxShadow: [
                    '0 0 20px rgba(var(--primary), 0.3)',
                    '0 0 40px rgba(var(--primary), 0.5)',
                    '0 0 20px rgba(var(--primary), 0.3)',
                  ]
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center"
              >
                <Mic className="w-10 h-10 text-primary-foreground" />
              </motion.div>
            </div>

            {/* Title and description */}
            <h2 className="text-2xl font-bold text-center text-foreground mb-2">
              {t('voice.welcomeTitle')}
            </h2>
            <p className="text-center text-muted-foreground mb-6">
              {t('voice.welcomeSubtitle')}
            </p>

            {/* Features list */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Volume2 className="w-5 h-5 text-primary" />
                <span>{t('voice.feature1')}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Mic className="w-5 h-5 text-primary" />
                <span>{t('voice.feature2')}</span>
              </div>
            </div>

            {/* CTA Button */}
            <Button
              onClick={handleStart}
              size="lg"
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold py-6 text-lg rounded-xl shadow-lg shadow-primary/25 transition-all hover:scale-[1.02]"
            >
              <Mic className="w-5 h-5 mr-2" />
              {t('voice.startButton')}
            </Button>

            {/* Skip text */}
            <p className="text-center text-xs text-muted-foreground mt-4">
              {t('voice.skipText')}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
