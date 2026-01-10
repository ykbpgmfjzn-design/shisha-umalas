import { motion, AnimatePresence } from 'framer-motion';
import { Mic, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface VoiceAssistantButtonProps {
  isActive: boolean;
  onClick: () => void;
}

export const VoiceAssistantButton = ({ isActive, onClick }: VoiceAssistantButtonProps) => {
  const { t } = useLanguage();

  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-28 left-4 z-[60] w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:shadow-xl hover:shadow-primary/40 transition-all md:bottom-24"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      aria-label={t('voice.startButton')}
    >
      <AnimatePresence mode="wait">
        {isActive ? (
          <motion.div
            key="close"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
          >
            <X className="w-6 h-6" />
          </motion.div>
        ) : (
          <motion.div
            key="mic"
            initial={{ rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -90, opacity: 0 }}
            className="relative"
          >
            <Mic className="w-6 h-6" />
            {/* Pulse animation */}
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/30"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};
