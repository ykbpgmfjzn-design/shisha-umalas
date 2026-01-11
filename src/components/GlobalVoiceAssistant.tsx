import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { VoiceAssistantOverlay } from "@/components/VoiceAssistantOverlay";
import { VoiceAssistantActive } from "@/components/VoiceAssistantActive";
import { VoiceAssistantButton } from "@/components/VoiceAssistantButton";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import voiceAssistantSingleton from "@/hooks/useVoiceAssistantSingleton";

export const GlobalVoiceAssistant = () => {
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [wasNotLoggedIn, setWasNotLoggedIn] = useState(false);
  const [roomNumber, setRoomNumber] = useState<string | null>(null);
  const [pendingLoginContinue, setPendingLoginContinue] = useState(false);
  const { language, setLanguage } = useLanguage();
  const { setIsOpen: setCartOpen, items: cartItems, isOpen: isCartOpen } = useCart();
  const location = useLocation();
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wasActiveBeforeLogin = useRef(false);
  const orderCompletedRef = useRef(false);
  
  // CRITICAL: Track if we're the one starting the session
  const isInitiatingSessionRef = useRef(false);
  
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
  } = useVoiceAssistant({
    onLanguageDetected: setLanguage,
  });

  // Fetch room number when user is logged in
  const fetchRoomNumber = async (userId: string): Promise<string | null> => {
    const { data } = await supabase
      .from('profiles')
      .select('room_number')
      .eq('id', userId)
      .maybeSingle();
    
    const room = data?.room_number || null;
    setRoomNumber(room);
    return room;
  };

  // Track authentication status
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const loggedIn = !!session?.user;
      setIsLoggedIn(loggedIn);
      if (!loggedIn) {
        setWasNotLoggedIn(true);
      } else if (session?.user) {
        fetchRoomNumber(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const loggedIn = !!session?.user;
      console.log('[GlobalVoiceAssistant] Auth event:', event, 'loggedIn:', loggedIn, 'orderCompleted:', orderCompletedRef.current);
      
      // CRITICAL: Don't restart if order completed
      if (orderCompletedRef.current) {
        console.log('[GlobalVoiceAssistant] Order completed, ignoring auth change');
        setIsLoggedIn(loggedIn);
        if (session?.user) {
          fetchRoomNumber(session.user.id);
        }
        return;
      }
      
      // User just logged in
      if (event === 'SIGNED_IN' && loggedIn && wasNotLoggedIn && session?.user) {
        const room = await fetchRoomNumber(session.user.id);
        
        // CRITICAL: Check if there's already an active session
        const hasActiveSession = voiceAssistantSingleton.isActive() || voiceAssistantSingleton.isStarting();
        
        if (hasActiveSession) {
          console.log('[GlobalVoiceAssistant] Session already exists, just updating stage');
          // Session exists - just update stage, don't restart
          if (!room) {
            voiceAssistantSingleton.setStage('room');
          } else {
            voiceAssistantSingleton.setStage('strength');
          }
        } else if (wasActiveBeforeLogin.current && showVoiceAssistant && !isInitiatingSessionRef.current) {
          console.log('[GlobalVoiceAssistant] User logged in, will restart voice session');
          setPendingLoginContinue(true);
        } else if (cartItems.length > 0) {
          setTimeout(() => {
            setCartOpen(true);
          }, 500);
        }
        
        setWasNotLoggedIn(false);
      }
      
      setIsLoggedIn(loggedIn);
      
      if (session?.user) {
        fetchRoomNumber(session.user.id);
      } else {
        setRoomNumber(null);
        if (isActive && !orderCompletedRef.current) {
          wasActiveBeforeLogin.current = true;
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [wasNotLoggedIn, cartItems.length, setCartOpen, showVoiceAssistant, isActive]);

  // Handle pending login continuation
  useEffect(() => {
    if (orderCompletedRef.current) {
      setPendingLoginContinue(false);
      return;
    }
    
    // CRITICAL: Check singleton state before starting
    if (pendingLoginContinue && isLoggedIn && !isActive && !isInitiatingSessionRef.current && !voiceAssistantSingleton.isActive() && !voiceAssistantSingleton.isStarting()) {
      console.log('[GlobalVoiceAssistant] Continuing voice session after login');
      setPendingLoginContinue(false);
      wasActiveBeforeLogin.current = false;
      isInitiatingSessionRef.current = true;
      
      setTimeout(() => {
        setShowVoiceAssistant(true);
        startSession(language, true, roomNumber);
        
        // Release after delay
        setTimeout(() => {
          isInitiatingSessionRef.current = false;
        }, 2000);
      }, 500);
    }
  }, [pendingLoginContinue, isLoggedIn, isActive, language, roomNumber, startSession]);

  // Auto-close when order ready or session ended (e.g., user declined registration)
  useEffect(() => {
    if (currentStage === 'ready' || state === 'complete') {
      orderCompletedRef.current = true;
      wasActiveBeforeLogin.current = false;
      setPendingLoginContinue(false);
      isInitiatingSessionRef.current = false;
      
      console.log('[GlobalVoiceAssistant] Session ending, stage:', currentStage, 'state:', state);
      
      // Clear any existing timer
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
      
      autoCloseTimerRef.current = setTimeout(() => {
        console.log('[GlobalVoiceAssistant] Auto-closing voice assistant');
        handleEndVoice();
        // Reset orderCompleted so user can start fresh session
        setTimeout(() => {
          orderCompletedRef.current = false;
        }, 500);
      }, 3000);
    }
    
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, [currentStage, state]);

  const handleStartVoice = () => {
    // CRITICAL: Multiple checks to prevent duplicate starts
    if (isActive) {
      console.log('[GlobalVoiceAssistant] Already active, ignoring start');
      return;
    }
    
    if (isInitiatingSessionRef.current) {
      console.log('[GlobalVoiceAssistant] Already initiating, ignoring start');
      return;
    }
    
    if (voiceAssistantSingleton.isActive() || voiceAssistantSingleton.isStarting()) {
      console.log('[GlobalVoiceAssistant] Singleton busy, ignoring start');
      return;
    }
    
    isInitiatingSessionRef.current = true;
    orderCompletedRef.current = false;
    setShowVoiceAssistant(true);
    wasActiveBeforeLogin.current = true;
    
    startSession(language, isLoggedIn, roomNumber);
    
    // Release after delay
    setTimeout(() => {
      isInitiatingSessionRef.current = false;
    }, 2000);
  };

  const handleEndVoice = () => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
    }
    isInitiatingSessionRef.current = false;
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

  // Check if we're on special pages
  const isAuthPage = location.pathname === '/auth';
  const isOrderConfirmationPage = location.pathname === '/order-confirmation';
  
  // Force minimize when cart is open
  const shouldMinimize = isCartOpen || (isAuthPage && currentStage === 'login');
  
  // Hide on order confirmation
  const hideVoiceAssistant = isOrderConfirmationPage;

  // Auto-end on order confirmation
  useEffect(() => {
    if (isOrderConfirmationPage && isActive) {
      console.log('[GlobalVoiceAssistant] On order confirmation, ending session');
      orderCompletedRef.current = true;
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
      isInitiatingSessionRef.current = false;
      endSession();
      setShowVoiceAssistant(false);
    }
  }, [isOrderConfirmationPage, isActive, endSession]);

  return (
    <>
      {/* Voice Assistant Overlay */}
      {!hideVoiceAssistant && (
        <VoiceAssistantOverlay
          onStart={handleStartVoice}
          onDismiss={() => {}}
        />
      )}
      
      {/* Voice Button - ONLY when NOT active */}
      {!hideVoiceAssistant && !isActive && !showVoiceAssistant && (
        <VoiceAssistantButton
          isActive={isActive}
          onClick={handleToggleVoice}
        />
      )}
      
      {/* Active Panel - ONLY ONE UI element when active */}
      {!hideVoiceAssistant && showVoiceAssistant && isActive && (
        <div className={isAuthPage ? "fixed top-4 left-4 right-4 z-[40] max-w-sm" : ""}>
          <VoiceAssistantActive
            state={state}
            transcript={transcript}
            assistantMessage={assistantMessage}
            error={error}
            onEnd={handleEndVoice}
            audioLevel={audioLevel}
            currentStage={currentStage}
            forceMinimized={shouldMinimize}
          />
        </div>
      )}
    </>
  );
};
