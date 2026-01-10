import { motion } from 'framer-motion';
import { Mic, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import type { VoiceAssistantState } from '@/hooks/useVoiceAssistant';

interface VoiceAssistantActiveProps {
  state: VoiceAssistantState;
  transcript: string;
  assistantMessage: string;
  error: string | null;
  onEnd: () => void;
  audioLevel?: number;
}

export const VoiceAssistantActive = ({
  state,
  transcript,
  assistantMessage,
  error,
  onEnd,
  audioLevel = 0.5,
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
          icon: <Mic className="w-8 h-8" />,
          text: '',
          color: 'text-muted-foreground',
        };
    }
  };

  const stateInfo = getStateInfo();

  if (state === 'idle') return null;

  // Compact mode - minimal floating bar
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed top-20 left-4 right-4 z-[40] max-w-sm mx-auto pointer-events-auto"
    >
      <div className="bg-card/95 backdrop-blur-lg border border-border rounded-xl shadow-lg overflow-hidden">
        {/* Compact Header with status */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`${stateInfo.color} transition-colors flex-shrink-0`}>
              {state === 'connecting' || state === 'processing' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : state === 'complete' ? (
                <CheckCircle className="w-5 h-5" />
              ) : state === 'error' ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </div>
            <span className={`text-sm font-medium ${stateInfo.color} truncate`}>
              {stateInfo.text}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEnd}
            className="h-7 w-7 rounded-full flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Compact content - only show latest message */}
        {(transcript || assistantMessage) && (
          <div className="px-3 pb-2 space-y-1">
            {transcript && (
              <p className="text-xs text-muted-foreground truncate">
                {t('voice.youSaid')}: {transcript}
              </p>
            )}
            {assistantMessage && (
              <p className="text-xs text-foreground line-clamp-2">
                {assistantMessage}
              </p>
            )}
          </div>
        )}

        {/* Mini audio visualization */}
        {(state === 'listening' || state === 'speaking') && (
          <div className="px-3 pb-2">
            <div className="flex items-center justify-center gap-1 h-4">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className={`w-1 rounded-full ${state === 'speaking' ? 'bg-primary' : 'bg-green-500'}`}
                  animate={{
                    height: [4, 4 + Math.random() * 12 * audioLevel, 4],
                  }}
                  transition={{
                    duration: 0.3,
                    repeat: Infinity,
                    delay: i * 0.05,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error retry button */}
        {state === 'error' && (
          <div className="px-3 pb-2">
            <Button onClick={onEnd} variant="outline" size="sm" className="w-full h-7 text-xs">
              {t('voice.tryAgain')}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
