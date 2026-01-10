import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { VoiceAssistantOverlay } from "@/components/VoiceAssistantOverlay";
import { VoiceAssistantActive } from "@/components/VoiceAssistantActive";
import { VoiceAssistantButton } from "@/components/VoiceAssistantButton";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

export const GlobalVoiceAssistant = () => {
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [wasNotLoggedIn, setWasNotLoggedIn] = useState(false);
  const { language } = useLanguage();
  const { setIsOpen: setCartOpen, items: cartItems } = useCart();
  const { profile } = useProfile();
  const location = useLocation();
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const {
    state,
    transcript,
    assistantMessage,
    error,
    startSession,
    endSession,
    isActive,
    audioLevel,
    currentStage,
  } = useVoiceAssistant();

  // Track authentication status and auto-open cart after login
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const loggedIn = !!session?.user;
      setIsLoggedIn(loggedIn);
      if (!loggedIn) {
        setWasNotLoggedIn(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const loggedIn = !!session?.user;
      
      // User just logged in and has items in cart - open cart
      if (loggedIn && wasNotLoggedIn && cartItems.length > 0) {
        setTimeout(() => {
          setCartOpen(true);
        }, 500);
        setWasNotLoggedIn(false);
      }
      
      setIsLoggedIn(loggedIn);
    });

    return () => subscription.unsubscribe();
  }, [wasNotLoggedIn, cartItems.length, setCartOpen]);

  // Auto-close when stage is 'ready' or state is 'complete'
  useEffect(() => {
    if (currentStage === 'ready' || state === 'complete') {
      autoCloseTimerRef.current = setTimeout(() => {
        handleEndVoice();
      }, 4000);
    }
    
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, [currentStage, state]);

  const handleStartVoice = () => {
    setShowVoiceAssistant(true);
    // Pass current login status and room number to the session
    startSession(language, isLoggedIn, profile?.room_number || null);
  };

  const handleEndVoice = () => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
    }
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

  // Check if we're on auth page - position differently
  const isAuthPage = location.pathname === '/auth';

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
      
      {/* Voice Assistant Active Panel - positioned differently on auth page */}
      {showVoiceAssistant && isActive && (
        <div className={isAuthPage ? "fixed top-4 left-4 right-4 z-[40] max-w-sm" : ""}>
          <VoiceAssistantActive
            state={state}
            transcript={transcript}
            assistantMessage={assistantMessage}
            error={error}
            onEnd={handleEndVoice}
            audioLevel={audioLevel}
            currentStage={currentStage}
          />
        </div>
      )}
    </>
  );
};
