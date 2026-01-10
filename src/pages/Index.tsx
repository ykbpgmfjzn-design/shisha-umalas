import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import HeroSection from "@/components/HeroSection";
import MenuSection from "@/components/MenuSection";
import FooterSection from "@/components/FooterSection";
import LanguageSelector from "@/components/LanguageSelector";
import BottomNavigation from "@/components/BottomNavigation";
import Cart from "@/components/Cart";
import { VoiceAssistantOverlay } from "@/components/VoiceAssistantOverlay";
import { VoiceAssistantActive } from "@/components/VoiceAssistantActive";
import { VoiceAssistantButton } from "@/components/VoiceAssistantButton";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useLanguage } from "@/contexts/LanguageContext";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);
  const { language } = useLanguage();
  const {
    state,
    transcript,
    assistantMessage,
    error,
    startSession,
    endSession,
    isActive,
    audioLevel,
  } = useVoiceAssistant();

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      toast.success('Оплата прошла успешно! / Payment successful!');
      searchParams.delete('payment');
      setSearchParams(searchParams, { replace: true });
    } else if (paymentStatus === 'failed') {
      toast.error('Ошибка оплаты. Попробуйте снова. / Payment failed. Please try again.');
      searchParams.delete('payment');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleStartVoice = () => {
    setShowVoiceAssistant(true);
    startSession(language);
  };

  const handleEndVoice = () => {
    endSession();
    setShowVoiceAssistant(false);
  };

  const handleToggleVoice = () => {
    if (isActive) {
      handleEndVoice();
    } else {
      handleStartVoice();
    }
  };

  return (
    <main className="min-h-screen bg-background pb-20">
      <LanguageSelector />
      <HeroSection />
      <MenuSection />
      <FooterSection />
      <Cart />
      <BottomNavigation />
      
      {/* Voice Assistant Overlay (first visit only) */}
      <VoiceAssistantOverlay
        onStart={handleStartVoice}
        onDismiss={() => {}}
      />
      
      {/* Voice Assistant Button (replaces WhatsApp) */}
      <VoiceAssistantButton
        isActive={isActive}
        onClick={handleToggleVoice}
      />
      
      {/* Voice Assistant Active Panel */}
      {showVoiceAssistant && isActive && (
        <VoiceAssistantActive
          state={state}
          transcript={transcript}
          assistantMessage={assistantMessage}
          error={error}
          onEnd={handleEndVoice}
          audioLevel={audioLevel}
        />
      )}
    </main>
  );
};

export default Index;
