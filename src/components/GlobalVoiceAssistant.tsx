import { useState, useEffect } from "react";
import { VoiceAssistantOverlay } from "@/components/VoiceAssistantOverlay";
import { VoiceAssistantActive } from "@/components/VoiceAssistantActive";
import { VoiceAssistantButton } from "@/components/VoiceAssistantButton";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

export const GlobalVoiceAssistant = () => {
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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

  // Track authentication status
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleStartVoice = () => {
    setShowVoiceAssistant(true);
    // Pass current login status to the session
    startSession(language, isLoggedIn);
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
    <>
      {/* Voice Assistant Overlay (once per session) */}
      <VoiceAssistantOverlay
        onStart={handleStartVoice}
        onDismiss={() => {}}
      />
      
      {/* Voice Assistant Button - always visible */}
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
    </>
  );
};
