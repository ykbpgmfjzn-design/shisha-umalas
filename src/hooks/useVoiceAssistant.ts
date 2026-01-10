import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { menuItems, findMenuItemByKeyword, getStrengthFromKeyword } from '@/data/menuItems';
import { toast } from 'sonner';
import voiceAssistantSingleton from './useVoiceAssistantSingleton';
import { Language } from '@/contexts/LanguageContext';

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
  addedToCart?: boolean;
  registrationOffered?: boolean;
}

interface UseVoiceAssistantProps {
  onLanguageDetected?: (language: Language) => void;
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

// Detect language from text based on character patterns
const detectLanguageFromText = (text: string): Language | null => {
  const lowerText = text.toLowerCase();
  
  // Russian - Cyrillic characters
  if (/[а-яё]/i.test(text)) {
    // Ukrainian has specific letters: і, ї, є, ґ
    if (/[іїєґ]/i.test(text)) {
      return 'uk';
    }
    return 'ru';
  }
  
  // Chinese characters
  if (/[\u4e00-\u9fff]/.test(text)) {
    return 'zh';
  }
  
  // Hindi/Devanagari script
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hi';
  }
  
  // Indonesian keywords
  const indonesianKeywords = ['terima kasih', 'tolong', 'saya mau', 'berapa', 'harga', 'pesan', 'shisha', 'hookah', 'enak', 'bagus', 'minta', 'apa', 'bisa', 'tidak', 'iya', 'ya'];
  if (indonesianKeywords.some(kw => lowerText.includes(kw))) {
    return 'id';
  }
  
  // French keywords
  const frenchKeywords = ['bonjour', 'merci', 's\'il vous plaît', 'je veux', 'comment', 'combien', 'chicha', 'oui', 'non', 'd\'accord', 'c\'est'];
  if (frenchKeywords.some(kw => lowerText.includes(kw))) {
    return 'fr';
  }
  
  // English fallback (or if explicitly English)
  const englishKeywords = ['hello', 'please', 'thank', 'want', 'order', 'hookah', 'shisha', 'yes', 'no', 'okay'];
  if (englishKeywords.some(kw => lowerText.includes(kw))) {
    return 'en';
  }
  
  return null;
};

export const useVoiceAssistant = (props?: UseVoiceAssistantProps): UseVoiceAssistantReturn => {
  const { onLanguageDetected } = props || {};
  
  // Generate unique instance ID for this hook instance
  const instanceId = useMemo(() => `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []);
  
  // Track detected language to avoid duplicate callbacks
  const detectedLanguageRef = useRef<Language | null>(null);
  
  const [state, setState] = useState<VoiceAssistantState>('idle');
  const [transcript, setTranscript] = useState('');
  const [assistantMessage, setAssistantMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0.5);
  const [orderState, setOrderState] = useState<OrderState>({ stage: 'login' });
  const orderStateRef = useRef<OrderState>({ stage: 'login' });
  const [user, setUser] = useState<any>(null);
  
  // Action flags to prevent duplicate operations
  const isAiRespondingRef = useRef(false);
  const pendingFollowUpRef = useRef<string | null>(null);
  const redirectingToAuthRef = useRef(false);
  const submittingOrderRef = useRef(false);
  
  // Audio analysis refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const { addItem, setIsOpen: setCartOpen, submitOrderProgrammatically } = useCart();
  const navigate = useNavigate();

  // Track if session was started before auth change
  const pendingAuthContinueRef = useRef(false);

  // Listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Audio level analyzer
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
    
    const patterns = [
      /room\s*(\d+)/i,
      /номер\s*(\d+)/i,
      /комната\s*(\d+)/i,
      /(\d{2,4})/,
    ];
    
    for (const pattern of patterns) {
      const match = lowerText.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }, []);

  // Send follow-up message with queue
  const sendFollowUpMessage = useCallback((instruction: string) => {
    const dc = voiceAssistantSingleton.getDataChannel();
    if (!dc || dc.readyState !== 'open') {
      console.log('[VoiceAssistant] Data channel not ready for follow-up');
      return;
    }
    
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

  // Save room number to profile
  const saveRoomNumber = useCallback(async (roomNumber: string) => {
    console.log('[VoiceAssistant] Attempting to save room number:', roomNumber);
    
    const { data: { session } } = await supabase.auth.getSession();
    const currentUser = session?.user;
    
    if (!currentUser) {
      console.error('[VoiceAssistant] Cannot save room - no user logged in');
      toast.error('Войдите в систему чтобы сохранить комнату');
      return false;
    }
    
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
      
      console.log('[VoiceAssistant] Room number saved successfully:', roomNumber);
      toast.success(`Комната ${roomNumber} сохранена!`);
      
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

  // Continue conversation after user logs in
  useEffect(() => {
    if (user && pendingAuthContinueRef.current && voiceAssistantSingleton.getDataChannel()?.readyState === 'open') {
      console.log('[VoiceAssistant] User logged in, continuing conversation');
      pendingAuthContinueRef.current = false;
      
      toast.success('Вход выполнен! Продолжаем заказ...');
      navigate('/');
      
      updateOrderState(prev => ({ ...prev, stage: 'room' }));
      
      setTimeout(() => {
        sendFollowUpMessage('User just logged in successfully. Say ONLY: "Отлично, вы вошли! Какой номер вашей комнаты для доставки?" or in English: "Great, you are logged in! What is your room number for delivery?" Then STOP and wait.');
      }, 1000);
    }
  }, [user, navigate, updateOrderState, sendFollowUpMessage]);

  // Process user transcript
  const processTranscript = useCallback((text: string) => {
    const lowerText = text.toLowerCase();
    console.log('[VoiceAssistant] Processing transcript:', text, 'Current stage:', orderStateRef.current.stage);
    
    if (orderStateRef.current.stage === 'room') {
      const roomNumber = extractRoomNumber(text);
      if (roomNumber) {
        console.log('[VoiceAssistant] Detected room number at room stage:', roomNumber);
        updateOrderState(prev => ({ ...prev, roomNumber, stage: 'ordering' }));
        saveRoomNumber(roomNumber);
        return;
      }
    }
    
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
    
    const strength = getStrengthFromKeyword(lowerText);
    if (strength) {
      console.log('[VoiceAssistant] Detected strength:', strength);
      updateOrderState(prev => ({ ...prev, strength }));
    }
    
    const quantityPatterns = [
      /(\d+)\s*(hookah|кальян|shisha|штук)/i,
      /^(\d+)$/,
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

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[VoiceAssistant] Cleanup called for instance:', instanceId);
    stopAudioAnalysis();
    
    // Release singleton session
    voiceAssistantSingleton.releaseSession(instanceId);
    
    // Reset all action flags
    isAiRespondingRef.current = false;
    pendingFollowUpRef.current = null;
    redirectingToAuthRef.current = false;
    submittingOrderRef.current = false;
  }, [instanceId, stopAudioAnalysis]);

  // Add items to cart
  const addToCart = useCallback((itemId: string, quantity: number): boolean => {
    if (orderStateRef.current.addedToCart) {
      console.log('[VoiceAssistant] Already added to cart, skipping duplicate');
      return false;
    }
    
    const item = menuItems.find(m => m.id === itemId);
    if (item) {
      console.log('[VoiceAssistant] Adding to cart:', item.name, 'x', quantity);
      for (let i = 0; i < quantity; i++) {
        addItem({
          id: item.id,
          name: item.name,
          price: item.price,
          priceDisplay: item.priceDisplay,
          strength: item.strength,
          isSignature: item.isSignature,
          itemType: item.itemType,
        }, false);
      }
      
      orderStateRef.current = { ...orderStateRef.current, addedToCart: true };
      updateOrderState(prev => ({ ...prev, addedToCart: true }));
      
      toast.success(`Добавлено ${quantity}x ${item.name}!`);
      return true;
    }
    return false;
  }, [addItem, updateOrderState]);

  const endSession = useCallback(() => {
    console.log('[VoiceAssistant] Ending session, instance:', instanceId);
    cleanup();
    setState('idle');
    setTranscript('');
    setAssistantMessage('');
    updateOrderState(() => ({ stage: 'login' }));
  }, [cleanup, updateOrderState, instanceId]);

  const handleRealtimeEvent = useCallback((event: any) => {
    switch (event.type) {
      case 'response.audio_transcript.delta':
        setAssistantMessage(prev => prev + (event.delta || ''));
        setState('speaking');
        isAiRespondingRef.current = true;
        break;
        
      case 'response.audio_transcript.done':
        const transcriptLower = (event.transcript || '').toLowerCase();
        console.log('[VoiceAssistant] AI said:', event.transcript);
        
        // AI offered registration - set flag so we can detect user confirmation later
        if (transcriptLower.includes('need to register') || 
            transcriptLower.includes('нужно зарегистрироваться') ||
            transcriptLower.includes('please log in') ||
            transcriptLower.includes('войдите') ||
            transcriptLower.includes('want to register') ||
            transcriptLower.includes('хотите зарегистрироваться') ||
            transcriptLower.includes('would you like to') ||
            transcriptLower.includes('хотите помогу') ||
            transcriptLower.includes('sign up') ||
            transcriptLower.includes('создать аккаунт')) {
          console.log('[VoiceAssistant] AI offered registration');
          updateOrderState(prev => ({ ...prev, stage: 'login', registrationOffered: true }));
        }
        
        // NOTE: We do NOT auto-redirect when AI says "opening registration"
        // The redirect only happens when USER explicitly confirms (see input_audio_transcription.completed handler)
        
        if (transcriptLower.includes("what's your room") || 
            transcriptLower.includes('какой номер комнаты') ||
            transcriptLower.includes('номер комнаты') ||
            transcriptLower.includes('room number')) {
          updateOrderState(prev => ({ ...prev, stage: 'room' }));
        }
        
        if (transcriptLower.includes('got it, room') || 
            transcriptLower.includes('комната') && transcriptLower.includes('принято') ||
            transcriptLower.includes("let's order") ||
            transcriptLower.includes('давайте закажем')) {
          updateOrderState(prev => ({ ...prev, stage: 'ordering' }));
        }
        
        if (transcriptLower.includes('what strength') || 
            transcriptLower.includes('какую крепость') ||
            transcriptLower.includes('which flavor') ||
            transcriptLower.includes('какой вкус')) {
          updateOrderState(prev => ({ ...prev, stage: 'ordering' }));
        }
        
        if (transcriptLower.includes('added to cart') || 
            transcriptLower.includes('добавлено в корзину') ||
            transcriptLower.includes('opening cart') ||
            transcriptLower.includes('открываю корзину')) {
          let currentOrder = orderStateRef.current;
          console.log('[VoiceAssistant] Current order state before AI parse:', currentOrder);
          
          if (!currentOrder.itemId) {
            const menuItem = findMenuItemByKeyword(event.transcript || '');
            if (menuItem) {
              console.log('[VoiceAssistant] Found item from AI message:', menuItem.name);
              updateOrderState(prev => ({ 
                ...prev, 
                itemId: menuItem.id,
                flavor: menuItem.name,
                strength: menuItem.strength,
              }));
              orderStateRef.current = { 
                ...orderStateRef.current, 
                itemId: menuItem.id,
                flavor: menuItem.name,
                strength: menuItem.strength,
              };
              currentOrder = orderStateRef.current;
            }
          }
          
          if (currentOrder.itemId) {
            const qty = currentOrder.quantity || 1;
            addToCart(currentOrder.itemId, qty);
          }
          
          setTimeout(() => {
            setCartOpen(true);
            setTimeout(() => {
              sendFollowUpMessage('The order has been added to cart. Now ask the user to confirm: "Check your order. Is everything correct? Say yes to proceed to payment." Be brief, max 15 words. Use the same language as the conversation.');
            }, 800);
          }, 300);
          updateOrderState(prev => ({ ...prev, stage: 'cart', cartOpened: true }));
        }
        
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
        processTranscript(transcriptText);
        
        // Detect language from user speech and switch app language + AI language
        if (transcriptText.length > 3) {
          const detectedLang = detectLanguageFromText(transcriptText);
          if (detectedLang && detectedLang !== detectedLanguageRef.current) {
            console.log('[VoiceAssistant] Detected language:', detectedLang);
            detectedLanguageRef.current = detectedLang;
            
            // Switch app UI language
            if (onLanguageDetected) {
              onLanguageDetected(detectedLang);
            }
            
            // Send language switch instruction to OpenAI
            const languageNames: Record<Language, string> = {
              'en': 'English',
              'ru': 'Russian',
              'uk': 'Ukrainian', 
              'id': 'Indonesian',
              'fr': 'French',
              'hi': 'Hindi',
              'zh': 'Chinese',
            };
            const langName = languageNames[detectedLang] || 'English';
            
            // Update session with new language preference
            const dc = voiceAssistantSingleton.getDataChannel();
            if (dc && dc.readyState === 'open') {
              dc.send(JSON.stringify({
                type: 'session.update',
                session: {
                  instructions: `IMPORTANT: The user is speaking ${langName}. From now on, respond ONLY in ${langName}. Continue the shisha ordering conversation in ${langName}.`,
                },
              }));
              console.log('[VoiceAssistant] Sent language switch to AI:', langName);
            }
          }
        }
        
        // Detect user wants to register - only if registration was offered by AI
        if (orderStateRef.current.stage === 'login' && 
            orderStateRef.current.registrationOffered &&
            !redirectingToAuthRef.current &&
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
             userTextLower.includes('давай') ||
             userTextLower.includes('конечно') ||
             userTextLower.includes('sure') ||
             userTextLower.includes('let\'s go') ||
             userTextLower.includes('поехали'))) {
          console.log('[VoiceAssistant] User confirmed registration, redirecting to auth page');
          
          redirectingToAuthRef.current = true;
          pendingAuthContinueRef.current = true;
          
          // Navigate immediately without waiting for AI
          navigate('/auth');
          
          // Also send follow-up for voice feedback
          sendFollowUpMessage('Say ONLY in 5 words or less: "Открываю регистрацию!" or "Opening registration!" Then STOP immediately.');
        }
        
        // Detect user confirmation to submit order
        if (orderStateRef.current.stage === 'cart' && 
            !submittingOrderRef.current &&
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
          
          submittingOrderRef.current = true;
          
          sendFollowUpMessage('Great! Submitting your order now. Please wait a moment.');
          
          setTimeout(() => {
            submitOrderProgrammatically().then((success) => {
              if (success) {
                console.log('[VoiceAssistant] Order submitted successfully');
                setTimeout(() => {
                  sendFollowUpMessage('Order submitted successfully! Thank the user warmly, wish them to enjoy their hookah, and say goodbye. Be brief and friendly, max 20 words. Say it in the same language as the user.');
                }, 800);
                updateOrderState(prev => ({ ...prev, stage: 'ready' }));
              } else {
                console.log('[VoiceAssistant] Order submission failed');
                submittingOrderRef.current = false;
                sendFollowUpMessage('There was an issue submitting the order. Please try clicking the Submit Order button manually, or try again.');
              }
            });
          }, 500);
        }
        
        setState('processing');
        break;
        
      case 'response.done':
        isAiRespondingRef.current = false;
        
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
  }, [state, addToCart, processTranscript, setCartOpen, navigate, updateOrderState, sendFollowUpMessage, submitOrderProgrammatically, onLanguageDetected]);

  const startSession = useCallback(async (language: string = 'en', isLoggedIn: boolean = false, roomNumber: string | null = null) => {
    // CRITICAL: Use singleton to prevent duplicate sessions
    if (!voiceAssistantSingleton.tryAcquireSession(instanceId)) {
      console.log('[VoiceAssistant] Could not acquire session - another instance is active');
      return;
    }
    
    try {
      setState('connecting');
      setError(null);
      setTranscript('');
      setAssistantMessage('');
      
      // Reset detected language on new session
      detectedLanguageRef.current = null;
      
      // Reset action flags
      redirectingToAuthRef.current = false;
      submittingOrderRef.current = false;
      pendingAuthContinueRef.current = false;
      isAiRespondingRef.current = false;
      pendingFollowUpRef.current = null;
      
      // Set initial stage
      if (!isLoggedIn) {
        updateOrderState(() => ({ stage: 'login' }));
      } else if (!roomNumber) {
        updateOrderState(() => ({ stage: 'room' }));
      } else {
        updateOrderState(() => ({ stage: 'ordering' }));
      }

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceAssistantSingleton.setMediaStream(stream);

      // Get ephemeral token
      const { data, error: fnError } = await supabase.functions.invoke('openai-realtime-session', {
        body: { language, isLoggedIn, roomNumber },
      });

      if (fnError || !data?.client_secret) {
        throw new Error(fnError?.message || 'Failed to get session token');
      }

      // Create WebRTC peer connection
      const pc = new RTCPeerConnection();
      voiceAssistantSingleton.setPeerConnection(pc);

      // Set up audio element
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      voiceAssistantSingleton.setAudioElement(audioEl);

      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
      };

      // Add local audio track
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      startAudioAnalysis(stream);

      // Create data channel
      const dc = pc.createDataChannel('oai-events');
      voiceAssistantSingleton.setDataChannel(dc);

      dc.onopen = () => {
        setState('listening');
        voiceAssistantSingleton.markSessionActive(instanceId);
        
        // Send initial greeting
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

      // Send offer to OpenAI
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
      
      console.log('[VoiceAssistant] Session started successfully, instance:', instanceId);

    } catch (err) {
      console.error('Voice assistant error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start voice assistant');
      setState('error');
      cleanup();
    }
  }, [cleanup, state, startAudioAnalysis, updateOrderState, instanceId, handleRealtimeEvent]);

  // Cleanup on unmount
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
