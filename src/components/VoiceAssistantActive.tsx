import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, X, Loader2, CheckCircle, AlertCircle, ChevronUp, ChevronDown, ShoppingCart, UserPlus, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import type { VoiceAssistantState, OrderStage } from '@/hooks/useVoiceAssistant';



interface VoiceAssistantActiveProps {
  state: VoiceAssistantState;
  transcript: string;
  assistantMessage: string;
  error: string | null;
  onEnd: () => void;
  audioLevel?: number;
  currentStage?: OrderStage;
  forceMinimized?: boolean; // External control to force minimized state
}

const stages: { key: OrderStage; labelKey: string; icon: React.ReactNode }[] = [
  { key: 'login', labelKey: 'voice.stageLogin', icon: <UserPlus className="w-3 h-3" /> },
  { key: 'room', labelKey: 'voice.stageRoom', icon: <Mic className="w-3 h-3" /> },
  { key: 'ordering', labelKey: 'voice.stageOrder', icon: <ShoppingCart className="w-3 h-3" /> },
  { key: 'cart', labelKey: 'voice.stageCart', icon: <ShoppingCart className="w-3 h-3" /> },
  { key: 'ready', labelKey: 'voice.stagePayment', icon: <CreditCard className="w-3 h-3" /> },
];

export const VoiceAssistantActive = ({
  state,
  transcript,
  assistantMessage,
  error,
  onEnd,
  audioLevel = 0.5,
  currentStage = 'ordering',
  forceMinimized = false,
}: VoiceAssistantActiveProps) => {
  const { t, language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(true);

  // Auto-minimize when forceMinimized changes
  useEffect(() => {
    if (forceMinimized) {
      setIsExpanded(false);
    }
  }, [forceMinimized]);

  const getStateInfo = () => {
    switch (state) {
      case 'connecting':
        return {
          text: t('voice.connecting'),
          color: 'text-muted-foreground',
        };
      case 'listening':
        return {
          text: t('voice.listening'),
          color: 'text-green-500',
        };
      case 'speaking':
        return {
          text: t('voice.speaking'),
          color: 'text-primary',
        };
      case 'processing':
        return {
          text: t('voice.processing'),
          color: 'text-yellow-500',
        };
      case 'complete':
        return {
          text: t('voice.complete'),
          color: 'text-green-500',
        };
      case 'error':
        return {
          text: error || t('voice.error'),
          color: 'text-destructive',
        };
      default:
        return {
          text: '',
          color: 'text-muted-foreground',
        };
    }
  };

  const stateInfo = getStateInfo();

  const getStageIndex = (stage: OrderStage) => {
    const index = stages.findIndex(s => s.key === stage);
    return index >= 0 ? index : 0;
  };

  const currentStageIndex = getStageIndex(currentStage);

  // Stage labels
  const stageLabels: Record<string, Record<OrderStage, string>> = {
    en: { login: 'Login', room: 'Room', ordering: 'Order', cart: 'Cart', ready: 'Payment' },
    ru: { login: 'Вход', room: 'Комната', ordering: 'Заказ', cart: 'Корзина', ready: 'Оплата' },
  };

  if (state === 'idle') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed top-20 left-4 right-4 z-[100] max-w-sm mx-auto pointer-events-auto"
    >
      <div className="bg-card/95 backdrop-blur-lg border border-border rounded-xl shadow-lg overflow-hidden">
        {/* Header - always visible, clickable to expand/collapse */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
        >
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
          <div className="flex items-center gap-1">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); onEnd(); }}
              className="h-7 w-7 rounded-full flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </button>

        {/* Stage Indicator - always visible */}
        <div className="px-3 pb-2">
          <div className="flex items-center justify-between gap-1">
            {stages.map((stage, index) => {
              const isCompleted = index < currentStageIndex;
              const isCurrent = index === currentStageIndex;
              
              return (
                <div key={stage.key} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex items-center w-full">
                    {/* Step circle */}
                    <div
                      className={`
                        w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all
                        ${isCompleted ? 'bg-green-500 text-white' : ''}
                        ${isCurrent ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' : ''}
                        ${!isCompleted && !isCurrent ? 'bg-muted text-muted-foreground' : ''}
                      `}
                    >
                      {isCompleted ? <CheckCircle className="w-3 h-3" /> : stage.icon}
                    </div>
                    {/* Connector line */}
                    {index < stages.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-1 transition-colors ${
                          index < currentStageIndex ? 'bg-green-500' : 'bg-muted'
                        }`}
                      />
                    )}
                  </div>
                  <span className={`text-[10px] ${isCurrent ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                    {stageLabels[language]?.[stage.key] || stageLabels.en[stage.key]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expandable content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {/* Transcript and assistant message */}
              {(transcript || assistantMessage) && (
                <div className="px-3 pb-2 space-y-1 border-t border-border pt-2">
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
