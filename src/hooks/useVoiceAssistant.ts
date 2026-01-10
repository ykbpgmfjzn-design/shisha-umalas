import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { menuItems, findMenuItemByKeyword, getStrengthFromKeyword } from '@/data/menuItems';
import { toast } from 'sonner';

export type VoiceAssistantState = 
  | 'idle' 
  | 'connecting' 
  | 'listening' 
  | 'speaking' 
  | 'processing'
  | 'complete'
  | 'error';

export type OrderStage = 'ordering' | 'cart' | 'login' | 'room' | 'ready';

interface OrderState {
  flavor?: string;
  strength?: string;
  quantity?: number;
  itemId?: string;
  stage: OrderStage;
  cartOpened?: boolean;
  autoCloseTimer?: NodeJS.Timeout;
  roomNumber?: string;
  addedToCart?: boolean;  // Flag to prevent duplicate additions
}

interface UseVoiceAssistantReturn {
  state: VoiceAssistantState;
  transcript: string;
  assistantMessage: string;
  error: string | null;
  startSession: (language?: string, isLoggedIn?: boolean, roomNumber?: string | null) => Promise<void>;
  endSession: () => void;
  isActive: boolean;
  audioLevel: number;
  currentStage: OrderStage;
}

export const useVoiceAssistant = (): UseVoiceAssistantReturn => {
  const [state, setState] = useState<VoiceAssistantState>('idle');
  const [transcript, setTranscript] = useState('');
  const [assistantMessage, setAssistantMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0.5);
  const [orderState, setOrderState] = useState<OrderState>({ stage: 'login' });
  const orderStateRef = useRef<OrderState>({ stage: 'login' });
  const [user, setUser] = useState<any>(null);
  const isAiRespondingRef = useRef(false); // Track if AI is currently responding
  const pendingFollowUpRef = useRef<string | null>(null); // Queue for pending follow-up
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const { addItem, setIsOpen: setCartOpen, submitOrderProgrammatically } = useCart();
  const navigate = useNavigate();

  // Track if session was started before auth change (for continuing after login)
  const wasActiveBeforeAuthRef = useRef(false);
  const pendingAuthContinueRef = useRef(false);

  // Listen for auth changes - basic setup (continuation logic moved after function definitions)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Audio level analyzer for visualization
  const startAudioAnalysis = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(1, average / 128));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
    } catch (e) {
      console.error('Audio analysis error:', e);
    }
  }, []);

  const stopAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  // Extract room number from text
  const extractRoomNumber = useCallback((text: string): string | null => {
    const lowerText = text.toLowerCase();
    
    // Match patterns like "room 101", "номер 205", "комната 303", or just numbers
    const patterns = [
      /room\s*(\d+)/i,
      /номер\s*(\d+)/i,
      /комната\s*(\d+)/i,
      /(\d{2,4})/,  // 2-4 digit numbers
    ];
    
    for (const pattern of patterns) {
      const match = lowerText.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }, []);

  // Send follow-up message to continue conversation (with queue to avoid conflicts)
  const sendFollowUpMessage = useCallback((instruction: string) => {
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== 'open') {
      console.log('[VoiceAssistant] Data channel not ready for follow-up');
      return;
    }
    
    // If AI is currently responding, queue the message
    if (isAiRespondingRef.current) {
      console.log('[VoiceAssistant] AI is responding, queuing follow-up:', instruction);
      pendingFollowUpRef.current = instruction;
      return;
    }
    
    console.log('[VoiceAssistant] Sending follow-up instruction:', instruction);
    isAiRespondingRef.current = true;
    dc.send(JSON.stringify({
      type: 'response.create',
      response: {
        modalities: ['audio', 'text'],
        instructions: instruction,
      },
    }));
  }, []);

  // Save room number to profile - get fresh session to ensure we have user
  const saveRoomNumber = useCallback(async (roomNumber: string) => {
    console.log('[VoiceAssistant] Attempting to save room number:', roomNumber);
    
    // Get fresh session to ensure we have the current user
    const { data: { session } } = await supabase.auth.getSession();
    const currentUser = session?.user;
    
    if (!currentUser) {
      console.error('[VoiceAssistant] Cannot save room - no user logged in (fresh check)');
      toast.error('Войдите в систему чтобы сохранить комнату');
      return false;
    }
    
    console.log('[VoiceAssistant] Saving room for user:', currentUser.id, currentUser.email);
    
    try {
      const { error, data } = await supabase
        .from('profiles')
        .update({ room_number: roomNumber })
        .eq('id', currentUser.id)
        .select();
      
      if (error) {
        console.error('[VoiceAssistant] Failed to save room number:', error);
        toast.error('Не удалось сохранить номер комнаты');
        return false;
      }
      
      console.log('[VoiceAssistant] Room number saved successfully:', roomNumber, 'Result:', data);
      toast.success(`Комната ${roomNumber} сохранена!`);
      
      // Continue conversation - ask about order strength ONLY
      setTimeout(() => {
        sendFollowUpMessage(`Room ${roomNumber} saved. Say ONLY: "Отлично, комната ${roomNumber}! Какую крепость? Ультра лёгкий, Лёгкий, Средний или Крепкий?" Then STOP and wait for answer.`);
      }, 500);
      
      return true;
    } catch (err) {
      console.error('[VoiceAssistant] Error saving room number:', err);
      toast.error('Ошибка сохранения комнаты');
      return false;
    }
  }, [sendFollowUpMessage]);

  // Helper to update orderState and ref together
  const updateOrderState = useCallback((updater: (prev: OrderState) => OrderState) => {
    setOrderState(prev => {
      const newState = updater(prev);
      orderStateRef.current = newState;
      return newState;
    });
  }, []);

  // Effect to continue conversation after user logs in
  useEffect(() => {
    // Check if user just logged in and we have a pending continue request
    if (user && pendingAuthContinueRef.current && dataChannelRef.current?.readyState === 'open') {
      console.log('[VoiceAssistant] User logged in, continuing conversation');
      pendingAuthContinueRef.current = false;
      
      // Navigate back to home and show toast
      toast.success('Вход выполнен! Продолжаем заказ...');
      navigate('/');
      
      // Update stage to room (need to get room number)
      updateOrderState(prev => ({ ...prev, stage: 'room' }));
      
      // Send follow-up to continue the conversation
      setTimeout(() => {
        sendFollowUpMessage('User just logged in successfully. Say ONLY: "Отлично, вы вошли! Какой номер вашей комнаты для доставки?" or in English: "Great, you are logged in! What is your room number for delivery?" Then STOP and wait.');
      }, 1000);
    }
  }, [user, navigate, updateOrderState, sendFollowUpMessage]);

  // Process user transcript and add to cart if order is complete
  const processTranscript = useCallback((text: string) => {
    const lowerText = text.toLowerCase();
    console.log('[VoiceAssistant] Processing transcript:', text, 'Current stage:', orderStateRef.current.stage);
    
    // Try to extract room number - only when we're at 'room' stage
    if (orderStateRef.current.stage === 'room') {
      const roomNumber = extractRoomNumber(text);
      if (roomNumber) {
        console.log('[VoiceAssistant] Detected room number at room stage:', roomNumber);
        updateOrderState(prev => ({ ...prev, roomNumber, stage: 'ordering' }));
        // Save to profile
        saveRoomNumber(roomNumber);
        return; // Don't process other patterns when we got room number
      }
    }
    
    // Try to find flavor (search in full text)
    const menuItem = findMenuItemByKeyword(lowerText);
    if (menuItem) {
      console.log('[VoiceAssistant] Detected menu item:', menuItem.name);
      updateOrderState(prev => ({ 
        ...prev, 
        flavor: menuItem.name,
        itemId: menuItem.id,
        strength: menuItem.strength,
      }));
    }
    
    // Try to find strength
    const strength = getStrengthFromKeyword(lowerText);
    if (strength) {
      console.log('[VoiceAssistant] Detected strength:', strength);
      updateOrderState(prev => ({ ...prev, strength }));
    }
    
    // Try to find quantity - multiple patterns
    const quantityPatterns = [
      /(\d+)\s*(hookah|кальян|shisha|штук)/i,
      /^(\d+)$/,  // Just a number
      /(one|two|three|four|five|один|два|три|четыре|пять|1|2|3|4|5)\s*(hookah|кальян)?/i,
    ];
    
    const numMap: Record<string, number> = {
      'one': 1, 'один': 1, '1': 1,
      'two': 2, 'два': 2, '2': 2,
      'three': 3, 'три': 3, '3': 3,
      'four': 4, 'четыре': 4, '4': 4,
      'five': 5, 'пять': 5, '5': 5,
    };
    
    for (const pattern of quantityPatterns) {
      const match = lowerText.match(pattern);
      if (match && match[1]) {
        const qty = numMap[match[1].toLowerCase()] || parseInt(match[1]);
        if (qty > 0 && qty <= 10) {
          console.log('[VoiceAssistant] Detected quantity:', qty);
          updateOrderState(prev => ({ ...prev, quantity: qty }));
          break;
        }
      }
    }
  }, [extractRoomNumber, saveRoomNumber, updateOrderState]);

  const cleanup = useCallback(() => {
    stopAudioAnalysis();
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }
  }, [stopAudioAnalysis]);

  // Add items to cart - returns true if added successfully
  const addToCart = useCallback((itemId: string, quantity: number): boolean => {
    // Check if already added to prevent duplicates
    if (orderStateRef.current.addedToCart) {
      console.log('[VoiceAssistant] Already added to cart, skipping duplicate');
      return false;
    }
    
    const item = menuItems.find(m => m.id === itemId);
    if (item) {
      console.log('[VoiceAssistant] Adding to cart:', item.name, 'x', quantity);
      // Add items with quantity directly (not in a loop)
      for (let i = 0; i < quantity; i++) {
        addItem({
          id: item.id,
          name: item.name,
          price: item.price,
          priceDisplay: item.priceDisplay,
          strength: item.strength,
          isSignature: item.isSignature,
          itemType: item.itemType,
        }, false); // Don't auto-open cart - we'll do it manually
      }
      
      // Mark as added to prevent duplicates
      orderStateRef.current = { ...orderStateRef.current, addedToCart: true };
      updateOrderState(prev => ({ ...prev, addedToCart: true }));
      
      toast.success(`Добавлено ${quantity}x ${item.name}!`);
      return true;
    }
    return false;
  }, [addItem, updateOrderState]);

  const endSession = useCallback(() => {
    // NOTE: Don't add to cart here - it was already added when AI said "added to cart"
    // This prevents duplicate additions
    console.log('[VoiceAssistant] Ending session, state:', orderStateRef.current);
    cleanup();
    setState('idle');
    setTranscript('');
    setAssistantMessage('');
    updateOrderState(() => ({ stage: 'login' }));
  }, [cleanup, updateOrderState]);

  const startSession = useCallback(async (language: string = 'en', isLoggedIn: boolean = false, roomNumber: string | null = null) => {
    try {
      setState('connecting');
      setError(null);
      setTranscript('');
      setAssistantMessage('');
      
      // Set initial stage based on user status
      if (!isLoggedIn) {
        updateOrderState(() => ({ stage: 'login' }));
      } else if (!roomNumber) {
        updateOrderState(() => ({ stage: 'room' }));
      } else {
        updateOrderState(() => ({ stage: 'ordering' }));
      }

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Get ephemeral token from edge function with auth status and room number
      const { data, error: fnError } = await supabase.functions.invoke('openai-realtime-session', {
        body: { language, isLoggedIn, roomNumber },
      });

      if (fnError || !data?.client_secret) {
        throw new Error(fnError?.message || 'Failed to get session token');
      }

      // Create WebRTC peer connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Set up audio element for playback
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioElementRef.current = audioEl;

      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
      };

      // Add local audio track and start analysis
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      startAudioAnalysis(stream);

      // Create data channel for events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.onopen = () => {
        setState('listening');
        // Send initial greeting based on user status
        let greetingInstruction = '';
        if (!isLoggedIn) {
          greetingInstruction = 'Greet briefly and tell user they need to register first to order. Ask if they want help registering. Max 15 words.';
        } else if (!roomNumber) {
          greetingInstruction = 'Greet briefly and ask for room number for delivery. Max 15 words.';
        } else {
          greetingInstruction = `Greet briefly, mention room ${roomNumber}, and ask what strength hookah they want. Max 15 words.`;
        }
        
        dc.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['audio', 'text'],
            instructions: greetingInstruction,
          },
        }));
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleRealtimeEvent(msg);
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      dc.onerror = (event) => {
        console.error('Data channel error:', event);
        setError('Connection error');
        setState('error');
      };

      dc.onclose = () => {
        if (state !== 'complete') {
          setState('idle');
        }
      };

      // Create and set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to OpenAI and get answer
      const sdpResponse = await fetch(
        `https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${data.client_secret.value}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        }
      );

      if (!sdpResponse.ok) {
        throw new Error('Failed to connect to OpenAI Realtime');
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

    } catch (err) {
      console.error('Voice assistant error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start voice assistant');
      setState('error');
      cleanup();
    }
  }, [cleanup, state, startAudioAnalysis, updateOrderState]);

  const handleRealtimeEvent = useCallback((event: any) => {
    switch (event.type) {
      case 'response.audio_transcript.delta':
        setAssistantMessage(prev => prev + (event.delta || ''));
        setState('speaking');
        isAiRespondingRef.current = true; // AI is responding
        break;
        
      case 'response.audio_transcript.done':
        const transcriptLower = (event.transcript || '').toLowerCase();
        console.log('[VoiceAssistant] AI said:', event.transcript);
        
        // Detect registration/login needed
        if (transcriptLower.includes('need to register') || 
            transcriptLower.includes('нужно зарегистрироваться') ||
            transcriptLower.includes('please log in') ||
            transcriptLower.includes('войдите')) {
          updateOrderState(prev => ({ ...prev, stage: 'login' }));
        }
        
        // Detect opening registration page
        if (transcriptLower.includes('opening registration') || 
            transcriptLower.includes('открываю регистрацию')) {
          navigate('/auth');
          updateOrderState(prev => ({ ...prev, stage: 'login' }));
        }
        
        // Detect room number request - user logged in, need room
        if (transcriptLower.includes("what's your room") || 
            transcriptLower.includes('какой номер комнаты') ||
            transcriptLower.includes('номер комнаты') ||
            transcriptLower.includes('room number')) {
          updateOrderState(prev => ({ ...prev, stage: 'room' }));
        }
        
        // Detect room confirmed, moving to ordering
        if (transcriptLower.includes('got it, room') || 
            transcriptLower.includes('комната') && transcriptLower.includes('принято') ||
            transcriptLower.includes("let's order") ||
            transcriptLower.includes('давайте закажем')) {
          updateOrderState(prev => ({ ...prev, stage: 'ordering' }));
        }
        
        // Detect strength/flavor selection - we're in ordering stage
        if (transcriptLower.includes('what strength') || 
            transcriptLower.includes('какую крепость') ||
            transcriptLower.includes('which flavor') ||
            transcriptLower.includes('какой вкус')) {
          updateOrderState(prev => ({ ...prev, stage: 'ordering' }));
        }
        
        // Detect "added to cart" - ADD FIRST then open cart
        if (transcriptLower.includes('added to cart') || 
            transcriptLower.includes('добавлено в корзину') ||
            transcriptLower.includes('opening cart') ||
            transcriptLower.includes('открываю корзину')) {
          // Use ref for current state to avoid stale closure
          let currentOrder = orderStateRef.current;
          console.log('[VoiceAssistant] Current order state before AI parse:', currentOrder);
          
          // If no itemId, try to extract from AI's confirmation message
          // AI says things like "1 Ultra Light Whiteline Vanilla, 280k. Added to cart!"
          if (!currentOrder.itemId) {
            console.log('[VoiceAssistant] No itemId, trying to extract from AI message:', event.transcript);
            const menuItem = findMenuItemByKeyword(event.transcript || '');
            if (menuItem) {
              console.log('[VoiceAssistant] Found item from AI message:', menuItem.name);
              updateOrderState(prev => ({ 
                ...prev, 
                itemId: menuItem.id,
                flavor: menuItem.name,
                strength: menuItem.strength,
              }));
              // Update ref immediately
              orderStateRef.current = { 
                ...orderStateRef.current, 
                itemId: menuItem.id,
                flavor: menuItem.name,
                strength: menuItem.strength,
              };
              currentOrder = orderStateRef.current;
            }
          }
          
          console.log('[VoiceAssistant] Final order state:', currentOrder);
          
          // Add to cart FIRST if we have the order info
          if (currentOrder.itemId) {
            const qty = currentOrder.quantity || 1;
            console.log('[VoiceAssistant] Adding to cart:', currentOrder.itemId, qty);
            addToCart(currentOrder.itemId, qty);
          } else {
            console.log('[VoiceAssistant] No itemId in order state, cannot add to cart');
          }
          
          // Open cart drawer after a small delay to ensure item is added
          // Then send follow-up to ask for confirmation
          setTimeout(() => {
            setCartOpen(true);
            console.log('[VoiceAssistant] Cart opened, sending confirmation request');
            // Wait a bit for cart to fully open, then ask for confirmation
            setTimeout(() => {
              sendFollowUpMessage('The order has been added to cart. Now ask the user to confirm: "Check your order. Is everything correct? Say yes to proceed to payment." Be brief, max 15 words. Use the same language as the conversation.');
            }, 800);
          }, 300);
          updateOrderState(prev => ({ ...prev, stage: 'cart', cartOpened: true }));
        }
        
        // NOTE: User confirmation detection moved to 'conversation.item.input_audio_transcription.completed'
        // because we need to detect what the USER says, not what the AI says
        
        // Detect ready for payment / farewell - auto close after 3 seconds
        if (transcriptLower.includes('order guide complete') || 
            transcriptLower.includes('сопровождение заказа завершено') ||
            transcriptLower.includes('everything ready') ||
            transcriptLower.includes('всё готово') ||
            transcriptLower.includes('enjoy your hookah') ||
            transcriptLower.includes('приятного') ||
            transcriptLower.includes('goodbye') ||
            transcriptLower.includes('до свидания') ||
            transcriptLower.includes('see you') ||
            transcriptLower.includes('до встречи') ||
            transcriptLower.includes('have a great') ||
            transcriptLower.includes('хорошего')) {
          updateOrderState(prev => ({ ...prev, stage: 'ready' }));
          setState('complete');
        }
        break;
        
      case 'input_audio_buffer.speech_started':
        setState('listening');
        setTranscript('');
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        const transcriptText = event.transcript || '';
        const userTextLower = transcriptText.toLowerCase();
        console.log('[VoiceAssistant] User said:', transcriptText);
        setTranscript(transcriptText);
        // Process the transcript to extract order info
        processTranscript(transcriptText);
        
        // Detect user wants to register (when at login stage and not logged in)
        if (orderStateRef.current.stage === 'login' && 
            (userTextLower.includes('yes') || 
             userTextLower.includes('да') ||
             userTextLower.includes('готов') ||
             userTextLower.includes('хочу') ||
             userTextLower.includes('register') ||
             userTextLower.includes('регистр') ||
             userTextLower.includes('sign up') ||
             userTextLower.includes('help') ||
             userTextLower.includes('помог') ||
             userTextLower.includes('okay') ||
             userTextLower.includes('ок') ||
             userTextLower.includes('давай'))) {
          console.log('[VoiceAssistant] User wants to register, redirecting to auth page');
          
          // Set flag to continue conversation after login
          pendingAuthContinueRef.current = true;
          
          // Tell user we're opening registration
          sendFollowUpMessage('Opening registration page now. Say ONLY: "Открываю страницу регистрации. После входа продолжим." or in English: "Opening registration. We will continue after you log in." Then STOP.');
          
          // Navigate to auth page
          setTimeout(() => {
            navigate('/auth');
          }, 500);
        }
        
        // Detect user confirmation to submit order (only when in cart stage)
        if (orderStateRef.current.stage === 'cart' && 
            (userTextLower.includes('yes') || 
             userTextLower.includes('да') ||
             userTextLower.includes('confirm') ||
             userTextLower.includes('подтвержда') ||
             userTextLower.includes('согласен') ||
             userTextLower.includes('верно') ||
             userTextLower.includes('correct') ||
             userTextLower.includes('proceed') ||
             userTextLower.includes('готов') ||
             userTextLower.includes('оформ') ||
             userTextLower.includes('submit') ||
             userTextLower.includes('отправ') ||
             userTextLower.includes('okay') ||
             userTextLower.includes('ок') ||
             userTextLower.includes('хорошо'))) {
          console.log('[VoiceAssistant] User confirmed order, submitting...');
          
          // Tell user we're submitting
          sendFollowUpMessage('Great! Submitting your order now. Please wait a moment.');
          
          // Add delay to ensure cart state is fully synced before submitting
          setTimeout(() => {
            submitOrderProgrammatically().then((success) => {
              if (success) {
                console.log('[VoiceAssistant] Order submitted successfully');
                // Send farewell message after successful submission
                setTimeout(() => {
                  sendFollowUpMessage('Order submitted successfully! Thank the user warmly, wish them to enjoy their hookah, and say goodbye. Be brief and friendly, max 20 words. Say it in the same language as the user.');
                }, 800);
                updateOrderState(prev => ({ ...prev, stage: 'ready' }));
              } else {
                console.log('[VoiceAssistant] Order submission failed');
                sendFollowUpMessage('There was an issue submitting the order. Please try clicking the Submit Order button manually, or try again.');
              }
            });
          }, 500);
        }
        
        setState('processing');
        break;
        
      case 'response.done':
        isAiRespondingRef.current = false; // AI finished responding
        
        // Send any pending follow-up message
        if (pendingFollowUpRef.current) {
          const pending = pendingFollowUpRef.current;
          pendingFollowUpRef.current = null;
          setTimeout(() => {
            sendFollowUpMessage(pending);
          }, 300);
        }
        
        if (state !== 'complete') {
          setState('listening');
        }
        setAssistantMessage('');
        break;
        
      case 'error':
        console.error('Realtime error:', event.error);
        setError(event.error?.message || 'An error occurred');
        setState('error');
        break;
    }
  }, [state, addToCart, processTranscript, setCartOpen, navigate, updateOrderState, sendFollowUpMessage, submitOrderProgrammatically]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    transcript,
    assistantMessage,
    error,
    startSession,
    endSession,
    isActive: state !== 'idle' && state !== 'error',
    audioLevel,
    currentStage: orderState.stage,
  };
};
