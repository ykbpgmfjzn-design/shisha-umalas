import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import type { VoiceAssistantState } from '@/hooks/useVoiceAssistant';

interface VoiceAssistantActiveProps {
  state: VoiceAssistantState;
  transcript: string;
  assistantMessage: string;
  error: string | null;
  onEnd: () => void;
}

export const VoiceAssistantActive = ({
  state,
  transcript,
  assistantMessage,
  error,
  onEnd,
}: VoiceAssistantActiveProps) => {
  const { t } = useLanguage();

  const getStateInfo = () => {
    switch (state) {
      case 'connecting':
        return {
          icon: <Loader2 className="w-8 h-8 animate-spin" />,
          text: t('voice.connecting'),
          color: 'text-muted-foreground',
        };
      case 'listening':
        return {
          icon: <Mic className="w-8 h-8" />,
          text: t('voice.listening'),
          color: 'text-green-500',
        };
      case 'speaking':
        return {
          icon: <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <Mic className="w-8 h-8" />
          </motion.div>,
          text: t('voice.speaking'),
          color: 'text-primary',
        };
      case 'processing':
        return {
          icon: <Loader2 className="w-8 h-8 animate-spin" />,
          text: t('voice.processing'),
          color: 'text-yellow-500',
        };
      case 'complete':
        return {
          icon: <CheckCircle className="w-8 h-8" />,
          text: t('voice.complete'),
          color: 'text-green-500',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-8 h-8" />,
          text: error || t('voice.error'),
          color: 'text-destructive',
        };
      default:
        return {
          icon: <MicOff className="w-8 h-8" />,
          text: '',
          color: 'text-muted-foreground',
        };
    }
  };

  const stateInfo = getStateInfo();

  if (state === 'idle') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      className="fixed bottom-24 left-4 right-4 z-[90] max-w-md mx-auto"
    >
      <div className="bg-card/95 backdrop-blur-lg border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`${stateInfo.color} transition-colors`}>
              {stateInfo.icon}
            </div>
            <span className={`font-medium ${stateInfo.color}`}>
              {stateInfo.text}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEnd}
            className="h-8 w-8 rounded-full"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* User transcript */}
          {transcript && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-muted/50 rounded-lg p-3"
            >
              <p className="text-xs text-muted-foreground mb-1">{t('voice.youSaid')}</p>
              <p className="text-foreground">{transcript}</p>
            </motion.div>
          )}

          {/* Assistant message */}
          {assistantMessage && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-primary/10 rounded-lg p-3 border border-primary/20"
            >
              <p className="text-xs text-primary mb-1">{t('voice.assistant')}</p>
              <p className="text-foreground">{assistantMessage}</p>
            </motion.div>
          )}

          {/* Audio visualization when listening */}
          {state === 'listening' && (
            <div className="flex justify-center gap-1 py-2">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    height: [12, 24 + Math.random() * 12, 12],
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                  className="w-1 bg-primary rounded-full"
                />
              ))}
            </div>
          )}

          {/* Complete state */}
          {state === 'complete' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4"
            >
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="text-foreground font-medium">{t('voice.orderAdded')}</p>
              <Button
                onClick={onEnd}
                className="mt-4"
                variant="default"
              >
                {t('voice.continueShopping')}
              </Button>
            </motion.div>
          )}

          {/* Error state */}
          {state === 'error' && (
            <div className="text-center py-2">
              <Button onClick={onEnd} variant="outline">
                {t('voice.tryAgain')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
