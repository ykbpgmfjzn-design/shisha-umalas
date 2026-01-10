import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { VoiceAssistantOverlay } from "@/components/VoiceAssistantOverlay";
import { VoiceAssistantActive } from "@/components/VoiceAssistantActive";
import { VoiceAssistantButton } from "@/components/VoiceAssistantButton";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";

export const GlobalVoiceAssistant = () => {
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [wasNotLoggedIn, setWasNotLoggedIn] = useState(false);
  const [roomNumber, setRoomNumber] = useState<string | null>(null);
  const [pendingLoginContinue, setPendingLoginContinue] = useState(false);
  const { language } = useLanguage();
  const { setIsOpen: setCartOpen, items: cartItems, isOpen: isCartOpen } = useCart();
  const location = useLocation();
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wasActiveBeforeLogin = useRef(false);
  const orderCompletedRef = useRef(false); // Track if order was completed
  const startingSessionRef = useRef(false); // Prevent double start calls
  
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

  // Track authentication status and handle post-login flow
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
      console.log('[GlobalVoiceAssistant] Auth event:', event, 'loggedIn:', loggedIn, 'wasNotLoggedIn:', wasNotLoggedIn, 'wasActiveBeforeLogin:', wasActiveBeforeLogin.current, 'orderCompleted:', orderCompletedRef.current);
      
      // CRITICAL: Don't restart voice session if order was already completed
      if (orderCompletedRef.current) {
        console.log('[GlobalVoiceAssistant] Order already completed, ignoring auth change');
        setIsLoggedIn(loggedIn);
        if (session?.user) {
          fetchRoomNumber(session.user.id);
        }
        return;
      }
      
      // User just logged in (only handle SIGNED_IN event, not token refreshes)
      if (event === 'SIGNED_IN' && loggedIn && wasNotLoggedIn && session?.user) {
        const room = await fetchRoomNumber(session.user.id);
        
        // If voice assistant was active before login, continue the conversation
        if (wasActiveBeforeLogin.current && showVoiceAssistant) {
          console.log('[GlobalVoiceAssistant] User logged in, restarting voice session to continue conversation');
          setPendingLoginContinue(true);
        } else if (cartItems.length > 0) {
          // Open cart if there are items
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
        // Track if assistant was active when user logged out/not logged in
        if (isActive && !orderCompletedRef.current) {
          wasActiveBeforeLogin.current = true;
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [wasNotLoggedIn, cartItems.length, setCartOpen, showVoiceAssistant, isActive]);

  // Handle pending login continuation - restart session after login
  useEffect(() => {
    // CRITICAL: Don't continue if order was completed
    if (orderCompletedRef.current) {
      setPendingLoginContinue(false);
      return;
    }
    
    if (pendingLoginContinue && isLoggedIn && !isActive && !startingSessionRef.current) {
      console.log('[GlobalVoiceAssistant] Continuing voice session after login');
      setPendingLoginContinue(false);
      wasActiveBeforeLogin.current = false;
      startingSessionRef.current = true;
      
      // Small delay to ensure auth state is fully settled
      setTimeout(() => {
        setShowVoiceAssistant(true);
        startSession(language, true, roomNumber);
        startingSessionRef.current = false;
      }, 500);
    }
  }, [pendingLoginContinue, isLoggedIn, isActive, language, roomNumber, startSession]);

  // Auto-close when stage is 'ready' or state is 'complete' - MARK ORDER AS COMPLETED
  useEffect(() => {
    if (currentStage === 'ready' || state === 'complete') {
      // Mark order as completed to prevent restart
      orderCompletedRef.current = true;
      wasActiveBeforeLogin.current = false;
      setPendingLoginContinue(false);
      startingSessionRef.current = false;
      
      console.log('[GlobalVoiceAssistant] Order completed, marking orderCompletedRef=true');
      
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
    // CRITICAL: Prevent double starts
    if (isActive || startingSessionRef.current) {
      console.log('[GlobalVoiceAssistant] Already starting or active, ignoring');
      return;
    }
    
    startingSessionRef.current = true;
    // Reset order completed flag when starting a new session
    orderCompletedRef.current = false;
    setShowVoiceAssistant(true);
    wasActiveBeforeLogin.current = true; // Track that voice was started
    // Pass current login status and room number to the session
    startSession(language, isLoggedIn, roomNumber);
    
    // Release after a short delay
    setTimeout(() => {
      startingSessionRef.current = false;
    }, 1000);
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

  // Check if we're on special pages
  const isAuthPage = location.pathname === '/auth';
  const isOrderConfirmationPage = location.pathname === '/order-confirmation';
  
  // Force minimize when cart is open or when on auth page at login stage
  const shouldMinimize = isCartOpen || (isAuthPage && currentStage === 'login');
  
  // Hide voice assistant completely on order confirmation page
  const hideVoiceAssistant = isOrderConfirmationPage;

  // Auto-end session when navigating to order confirmation
  useEffect(() => {
    if (isOrderConfirmationPage && isActive) {
      console.log('[GlobalVoiceAssistant] On order confirmation page, ending voice session');
      orderCompletedRef.current = true;
      handleEndVoice();
    }
  }, [isOrderConfirmationPage, isActive]);

  return (
    <>
      {/* Voice Assistant Overlay (once per session) - hide on order confirmation */}
      {!hideVoiceAssistant && (
        <VoiceAssistantOverlay
          onStart={handleStartVoice}
          onDismiss={() => {}}
        />
      )}
      
      {/* Voice Assistant Button - ONLY show when NOT active to prevent duplicate UI */}
      {!hideVoiceAssistant && !isActive && (
        <VoiceAssistantButton
          isActive={isActive}
          onClick={handleToggleVoice}
        />
      )}
      
      {/* Voice Assistant Active Panel - this is the ONLY UI when active */}
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
