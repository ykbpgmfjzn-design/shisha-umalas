import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { menuItems, findMenuItemByKeyword, getStrengthFromKeyword } from '@/data/menuItems';
import { toast } from 'sonner';
import voiceAssistantSingleton from './useVoiceAssistantSingleton';
import { Language } from '@/contexts/LanguageContext';
import { 
  filterTranscript, 
  getNoiseResponse 
} from './voiceAssistant/noiseFilter';
import { 
  detectIntent, 
  guardIntent, 
  isBackchannelOnly,
  STAGE_REMINDERS,
  CONFIDENCE_THRESHOLDS
} from './voiceAssistant/intentConfig';
import { eventStore } from './voiceAssistant/eventStore';

export type VoiceAssistantState = 
  | 'idle' 
  | 'connecting' 
  | 'listening' 
  | 'speaking' 
  | 'processing'
  | 'complete'
  | 'error';

// FSM Stages: login → room → hookah (strength→flavor→more loop) → cart → payment → ready
export type OrderStage = 'login' | 'room' | 'strength' | 'flavor' | 'more' | 'cart' | 'payment' | 'ready';

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
  strengthAsked?: boolean;
  flavorAsked?: boolean;
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

const VOICE_LANGUAGE_KEY = 'voice-assistant-language';

// Load saved language from localStorage
const loadSavedLanguage = (): Language | null => {
  try {
    const saved = localStorage.getItem(VOICE_LANGUAGE_KEY);
    if (saved && ['en', 'ru', 'uk', 'id', 'fr', 'hi', 'zh'].includes(saved)) {
      return saved as Language;
    }
  } catch (e) {
    console.error('[VoiceAssistant] Error loading saved language:', e);
  }
  return null;
};

// Save language to localStorage
const saveLanguage = (lang: Language): void => {
  try {
    localStorage.setItem(VOICE_LANGUAGE_KEY, lang);
    console.log('[VoiceAssistant] Language saved to localStorage:', lang);
  } catch (e) {
    console.error('[VoiceAssistant] Error saving language:', e);
  }
};

export const useVoiceAssistant = (props?: UseVoiceAssistantProps): UseVoiceAssistantReturn => {
  const { onLanguageDetected } = props || {};
  
  // Generate unique instance ID for this hook instance
  const instanceId = useMemo(() => `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []);
  
  // Track detected language - initialize from localStorage
  const detectedLanguageRef = useRef<Language | null>(loadSavedLanguage());
  
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
      
      // Use detected language for follow-up, default to Russian
      const lang = detectedLanguageRef.current;
      const isRussian = lang === 'ru' || lang === 'uk' || !lang;
      
      setTimeout(() => {
        if (isRussian) {
          sendFollowUpMessage(`Комната ${roomNumber} сохранена. Скажи ТОЛЬКО: "Отлично, комната ${roomNumber}! Какую крепость кальяна выберете? Ультра лёгкий, Лёгкий, Средний или Крепкий?" Потом СТОП и жди ответ. ГОВОРИ ТОЛЬКО ПО-РУССКИ.`);
        } else {
          sendFollowUpMessage(`Room ${roomNumber} saved. Say ONLY: "Great, room ${roomNumber}! What hookah strength would you like? Ultra Light, Light, Medium, or Bold Strong?" Then STOP and wait for answer. SPEAK ONLY IN ENGLISH.`);
        }
      }, 500);
      
      return true;
    } catch (err) {
      console.error('[VoiceAssistant] Error saving room number:', err);
      toast.error('Ошибка сохранения комнаты');
      return false;
    }
  }, [sendFollowUpMessage]);

  // Helper to update orderState and ref together - ALSO syncs to singleton
  const updateOrderState = useCallback((updater: (prev: OrderState) => OrderState) => {
    setOrderState(prev => {
      const newState = updater(prev);
      orderStateRef.current = newState;
      
      // CRITICAL: Sync stage to global singleton to prevent dual-assistant issues
      if (newState.stage !== prev.stage) {
        voiceAssistantSingleton.setStage(newState.stage);
      }
      
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
      
      // Use detected language for follow-up
      const lang = detectedLanguageRef.current;
      const isRussian = lang === 'ru' || lang === 'uk' || !lang;
      
      setTimeout(() => {
        if (isRussian) {
          sendFollowUpMessage('Пользователь успешно вошёл. Скажи ТОЛЬКО: "Отлично, вы вошли! Какой номер вашей комнаты для доставки?" Потом СТОП и жди ответ. ГОВОРИ ТОЛЬКО ПО-РУССКИ.');
        } else {
          sendFollowUpMessage('User just logged in successfully. Say ONLY: "Great, you are logged in! What is your room number for delivery?" Then STOP and wait. SPEAK ONLY IN ENGLISH.');
        }
      }, 1000);
    }
  }, [user, navigate, updateOrderState, sendFollowUpMessage]);

  // Process user transcript - FSM aware
  const processTranscript = useCallback((text: string) => {
    const lowerText = text.toLowerCase();
    const currentStage = orderStateRef.current.stage;
    console.log('[VoiceAssistant] Processing transcript:', text, 'Current stage:', currentStage);
    
    // ROOM STAGE: Extract and save room number, then move to strength
    if (currentStage === 'room') {
      const roomNumber = extractRoomNumber(text);
      if (roomNumber) {
        console.log('[VoiceAssistant] Detected room number at room stage:', roomNumber);
        updateOrderState(prev => ({ ...prev, roomNumber, stage: 'strength' }));
        saveRoomNumber(roomNumber);
        return;
      }
    }
    
    // STRENGTH STAGE: Detect strength and move to flavor
    if (currentStage === 'strength') {
      const strength = getStrengthFromKeyword(lowerText);
      if (strength) {
        console.log('[VoiceAssistant] Detected strength:', strength, '-> moving to flavor stage');
        updateOrderState(prev => ({ ...prev, strength, stage: 'flavor', strengthAsked: true }));
        
        // Use detected language
        const lang = detectedLanguageRef.current;
        const isRussian = lang === 'ru' || lang === 'uk' || !lang;
        
        // Ask for flavor
        setTimeout(() => {
          if (isRussian) {
            sendFollowUpMessage(`Пользователь выбрал крепость ${strength}. Скажи ТОЛЬКО вкусы этой категории на РУССКОМ, макс 20 слов. ГОВОРИ ТОЛЬКО ПО-РУССКИ.`);
          } else {
            sendFollowUpMessage(`User chose ${strength} strength. Now list flavors for this category in ENGLISH only, max 20 words. SPEAK ONLY IN ENGLISH.`);
          }
        }, 500);
        return;
      }
    }
    
    // FLAVOR STAGE: Detect flavor/menu item and add to cart, then ask "want more?"
    if (currentStage === 'flavor') {
      const menuItem = findMenuItemByKeyword(lowerText);
      if (menuItem) {
        console.log('[VoiceAssistant] Detected menu item:', menuItem.name, '-> adding to cart');
        
        // Default quantity is 1
        const quantity = orderStateRef.current.quantity || 1;
        
        updateOrderState(prev => ({ 
          ...prev, 
          flavor: menuItem.name,
          itemId: menuItem.id,
          strength: menuItem.strength || prev.strength,
          quantity,
          flavorAsked: true,
          addedToCart: true,
        }));
        
        // Add to cart using the addItem from context (DON'T open cart yet!)
        for (let i = 0; i < quantity; i++) {
          addItem({
            id: menuItem.id,
            name: menuItem.name,
            price: menuItem.price,
            priceDisplay: menuItem.priceDisplay,
            strength: menuItem.strength,
            isSignature: menuItem.isSignature,
            itemType: menuItem.itemType,
          }, false);
        }
        
        toast.success(`Добавлено ${quantity}x ${menuItem.name}!`);
        
        // Move to "more" stage - ask if they want another hookah
        updateOrderState(prev => ({ ...prev, stage: 'more' }));
        
        // Use detected language
        const lang = detectedLanguageRef.current;
        const isRussian = lang === 'ru' || lang === 'uk' || !lang;
        
        setTimeout(() => {
          if (isRussian) {
            sendFollowUpMessage(`${quantity}x ${menuItem.name} добавлено. Скажи ТОЛЬКО: "Добавлено! Хотите заказать ещё один кальян?" Потом СТОП и жди да/нет. ГОВОРИ ТОЛЬКО ПО-РУССКИ.`);
          } else {
            sendFollowUpMessage(`${quantity}x ${menuItem.name} added to cart. Say ONLY: "Added! Would you like to order another hookah?" Then STOP and wait for yes/no. SPEAK ONLY IN ENGLISH.`);
          }
        }, 500);
        return;
      }
      
      // Also check for quantity in flavor stage
      const quantityPatterns = [
        /(\d+)\s*(hookah|кальян|shisha|штук)/i,
        /(one|two|three|four|five|один|два|три|четыре|пять)\s*(hookah|кальян)?/i,
      ];
      
      const numMap: Record<string, number> = {
        'one': 1, 'один': 1,
        'two': 2, 'два': 2,
        'three': 3, 'три': 3,
        'four': 4, 'четыре': 4,
        'five': 5, 'пять': 5,
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
    }
    
    // MORE STAGE: User deciding whether to add more hookahs or proceed to cart
    if (currentStage === 'more') {
      const wantsMore = [
        'да', 'yes', 'ещё', 'more', 'another', 'хочу', 'давай', 'конечно', 'sure', 'iya', 'ya', 'ок', 'okay'
      ].some(kw => lowerText.includes(kw));
      
      const noMore = [
        'нет', 'no', 'хватит', 'достаточно', 'enough', 'всё', 'все', 'done', 'готов', 'stop', 'стоп', 'не надо', 'больше не', 'это всё'
      ].some(kw => lowerText.includes(kw));
      
      if (wantsMore && !noMore) {
        // User wants to add more - go back to strength selection
        console.log('[VoiceAssistant] User wants more hookahs, returning to strength');
        updateOrderState(prev => ({ ...prev, stage: 'strength', strength: undefined, flavor: undefined, quantity: undefined, itemId: undefined }));
        
        // Use detected language
        const lang = detectedLanguageRef.current;
        const isRussian = lang === 'ru' || lang === 'uk' || !lang;
        
        setTimeout(() => {
          if (isRussian) {
            sendFollowUpMessage('Пользователь хочет ещё. Скажи ТОЛЬКО: "Отлично! Какую крепость? Ультра лёгкий, Лёгкий, Средний или Крепкий." Потом СТОП и жди. ГОВОРИ ТОЛЬКО ПО-РУССКИ.');
          } else {
            sendFollowUpMessage('User wants another hookah. Say ONLY: "Great! What strength? Ultra Light, Light, Medium, or Bold Strong." Then STOP and wait. SPEAK ONLY IN ENGLISH.');
          }
        }, 500);
        return;
      }
      
      if (noMore && !wantsMore) {
        // User is done - open cart for verification
        console.log('[VoiceAssistant] User done ordering, opening cart for verification');
        updateOrderState(prev => ({ ...prev, stage: 'cart', cartOpened: true }));
        
        // Use detected language
        const lang = detectedLanguageRef.current;
        const isRussian = lang === 'ru' || lang === 'uk' || !lang;
        
        setTimeout(() => {
          setCartOpen(true);
          setTimeout(() => {
            if (isRussian) {
              sendFollowUpMessage('Открыта корзина. Скажи ТОЛЬКО: "Открываю корзину. Проверьте заказ - всё верно? Если да, скажите подтверждаю. Если нужно изменить - скажите что именно." Потом СТОП. ГОВОРИ ТОЛЬКО ПО-РУССКИ.');
            } else {
              sendFollowUpMessage('Cart is open. Say ONLY: "Opening cart. Check your order - is everything correct? If yes, say confirm. If you need to change something - tell me what." Then STOP. SPEAK ONLY IN ENGLISH.');
            }
          }, 800);
        }, 300);
        return;
      }
    }
  }, [extractRoomNumber, saveRoomNumber, updateOrderState, sendFollowUpMessage, addItem, setCartOpen]);

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
          updateOrderState(prev => ({ ...prev, stage: 'strength' }));
        }
        
        if (transcriptLower.includes('what strength') || 
            transcriptLower.includes('какую крепость')) {
          updateOrderState(prev => ({ ...prev, stage: 'strength' }));
        }
        
        if (transcriptLower.includes('which flavor') ||
            transcriptLower.includes('какой вкус')) {
          updateOrderState(prev => ({ ...prev, stage: 'flavor' }));
        }
        
        // Handle "added to cart" - move to 'more' stage (ask if want another)
        if ((transcriptLower.includes('added to cart') || 
            transcriptLower.includes('добавлено в корзину') ||
            transcriptLower.includes('добавлено!')) &&
            !transcriptLower.includes('открываю корзину')) {
          console.log('[VoiceAssistant] Item added, moving to more stage');
          updateOrderState(prev => ({ ...prev, stage: 'more' }));
        }
        
        // Handle "opening cart" - only when user said they don't want more
        if (transcriptLower.includes('opening cart') ||
            transcriptLower.includes('открываю корзину') ||
            transcriptLower.includes('открываю для проверки')) {
          console.log('[VoiceAssistant] Opening cart for verification');
          updateOrderState(prev => ({ ...prev, stage: 'cart', cartOpened: true }));
          setTimeout(() => {
            setCartOpen(true);
          }, 300);
        }
        
        // ONLY mark as complete if order was actually submitted (stage is cart and submitting was triggered)
        if (orderStateRef.current.stage === 'cart' && submittingOrderRef.current) {
          if (transcriptLower.includes('order guide complete') || 
              transcriptLower.includes('сопровождение заказа завершено') ||
              transcriptLower.includes('order placed') ||
              transcriptLower.includes('заказ оформлен') ||
              transcriptLower.includes('order submitted') ||
              transcriptLower.includes('заказ отправлен') ||
              transcriptLower.includes('enjoy your hookah') ||
              transcriptLower.includes('приятного отдыха') ||
              transcriptLower.includes('приятного курения')) {
            console.log('[VoiceAssistant] Order confirmed complete, ending session');
            updateOrderState(prev => ({ ...prev, stage: 'ready' }));
            setState('complete');
          }
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
        
        // ============= FSM NOISE & BACKCHANNEL FILTER =============
        const currentStage = orderStateRef.current.stage;
        const filterResult = filterTranscript(transcriptText, currentStage);
        
        if (filterResult.type === 'noise' || filterResult.type === 'backchannel') {
          console.log('[VoiceAssistant] Filtered out:', filterResult.type, filterResult.reason);
          
          // Log event for analytics
          eventStore.logEvent(
            instanceId,
            currentStage,
            filterResult.type,
            0,
            false,
            filterResult.reason
          );
          
          // Ask to repeat - don't process further
          const noiseResponse = getNoiseResponse(filterResult, detectedLanguageRef.current === 'ru' ? 'ru' : 'en');
          if (noiseResponse) {
            sendFollowUpMessage(`Say ONLY: "${noiseResponse}" Then STOP and wait.`);
          }
          setState('listening');
          break; // Exit early - don't process noise/backchannel
        }
        
        // ============= FSM INTENT DETECTION WITH CONFIDENCE =============
        const slots = {
          roomNumber: orderStateRef.current.roomNumber,
          strength: orderStateRef.current.strength,
          flavor: orderStateRef.current.flavor,
          quantity: orderStateRef.current.quantity,
        };
        
        const intentResult = detectIntent(transcriptText, currentStage, slots);
        console.log('[VoiceAssistant] Intent detected:', intentResult);
        
        // Log intent event
        eventStore.logEvent(
          instanceId,
          currentStage,
          intentResult.intent,
          intentResult.confidence,
          intentResult.accepted,
          intentResult.reason
        );
        
        // ============= PROCESS VALID TRANSCRIPT =============
        processTranscript(transcriptText);
        
        // Detect language from user speech and switch app language + AI language
        if (transcriptText.length > 3) {
          const detectedLang = detectLanguageFromText(transcriptText);
          if (detectedLang && detectedLang !== detectedLanguageRef.current) {
            console.log('[VoiceAssistant] Detected language:', detectedLang);
            detectedLanguageRef.current = detectedLang;
            
            // Save to localStorage for persistence between sessions
            saveLanguage(detectedLang);
            
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
        
        // ============= REGISTRATION FLOW =============
        // Handle registration acceptance/decline at login stage
        // IMPORTANT: Check stage is 'login' OR check for explicit registration keywords regardless of stage
        const isLoginStage = orderStateRef.current.stage === 'login';
        const wasRegistrationOffered = orderStateRef.current.registrationOffered;
        
        // Keywords that indicate user wants to register (regardless of current stage)
        const registrationAcceptKeywords = [
          'да', 'yes', 'хочу', 'готов', 'давай', 'помог', 'регистр', 
          'ok', 'ок', 'окей', 'конечно', 'sure', 'iya', 'ya', 'ладно', 'согласен'
        ];
        const registrationDeclineKeywords = [
          'нет', 'no', 'не хочу', 'не надо', 'без', 'skip', 'пропустить', 
          'потом', 'later', 'сам', 'tidak', 'не сейчас'
        ];
        
        const userWantsToRegister = registrationAcceptKeywords.some(kw => userTextLower.includes(kw));
        const userDeclinesRegistration = registrationDeclineKeywords.some(kw => userTextLower.includes(kw));
        
        // Only process if: at login stage, OR registration was offered and not yet redirecting
        if ((isLoginStage || wasRegistrationOffered) && !redirectingToAuthRef.current) {
          
          // User DECLINES registration
          if (userDeclinesRegistration && !userWantsToRegister) {
            console.log('[VoiceAssistant] User declined registration');
            sendFollowUpMessage('User declined registration. Say ONLY: "Без проблем! Выбирайте кальян в меню, а оплатить можно на ресепшене. Приятного выбора!" or in English: "No problem! Browse the menu. Enjoy!" Then STOP.');
            setTimeout(() => {
              updateOrderState(prev => ({ ...prev, stage: 'ready' }));
              setState('complete');
            }, 3000);
          }
          // User ACCEPTS registration
          else if (userWantsToRegister && !userDeclinesRegistration) {
            console.log('[VoiceAssistant] User confirmed registration, redirecting to /auth');
            
            redirectingToAuthRef.current = true;
            pendingAuthContinueRef.current = true;
            
            // Navigate immediately
            navigate('/auth');
            
            // Voice feedback
            sendFollowUpMessage('Say ONLY: "Открываю регистрацию!" or "Opening registration!" Then STOP.');
          }
        }
        
        // ============= STRICT CONFIRM ORDER CHECK =============
        // CRITICAL: Simple "да/yes/ok" is NOT enough for order confirmation
        if (orderStateRef.current.stage === 'cart' && !submittingOrderRef.current) {
          
          // Check if it's just backchannel (should not confirm order)
          if (isBackchannelOnly(transcriptText)) {
            console.log('[VoiceAssistant] Backchannel detected at cart stage, asking for explicit confirmation');
            sendFollowUpMessage('Say ONLY: "Пожалуйста, скажите \'подтверждаю заказ\' для оформления." or "Please say \'confirm order\' to proceed." Then STOP.');
          }
          // Check if it's a valid confirm_order intent with high confidence
          else if (intentResult.intent === 'confirm_order') {
            if (intentResult.accepted && intentResult.confidence >= CONFIDENCE_THRESHOLDS.confirm_order) {
              console.log('[VoiceAssistant] User explicitly confirmed order, submitting...');
              
              submittingOrderRef.current = true;
              updateOrderState(prev => ({ ...prev, stage: 'payment' }));
              
              sendFollowUpMessage('Great! Opening payment page now.');
              
              setTimeout(() => {
                submitOrderProgrammatically().then((success) => {
                  if (success) {
                    console.log('[VoiceAssistant] Order submitted, navigated to payment');
                    // Payment page handles the rest - assistant says goodbye
                    setTimeout(() => {
                      sendFollowUpMessage('Say ONLY: "Заказ оформлен! Выберите способ оплаты. Приятного отдыха!" or "Order confirmed! Choose your payment method. Enjoy!" Then STOP.');
                    }, 800);
                    updateOrderState(prev => ({ ...prev, stage: 'ready' }));
                    setState('complete');
                  } else {
                    console.log('[VoiceAssistant] Order submission failed');
                    submittingOrderRef.current = false;
                    updateOrderState(prev => ({ ...prev, stage: 'cart' }));
                    sendFollowUpMessage('There was an issue. Please try the Payment button manually.');
                  }
                });
              }, 500);
            } else {
              // Confidence too low - ask for explicit confirmation
              console.log('[VoiceAssistant] Confirm intent detected but confidence too low:', intentResult.confidence);
              sendFollowUpMessage('Say ONLY: "Для подтверждения заказа скажите \'подтверждаю\'." or "To confirm your order, please say \'confirm\'." Then STOP.');
            }
          }
          // Check for explicit confirmation keywords (stricter set)
          else if (
            userTextLower.includes('подтверждаю') ||
            userTextLower.includes('confirm') ||
            userTextLower.includes('оформить заказ') ||
            userTextLower.includes('да, всё верно') ||
            userTextLower.includes('yes, correct') ||
            userTextLower.includes('submit order')
          ) {
            console.log('[VoiceAssistant] User confirmed order with explicit keywords, submitting...');
            
            submittingOrderRef.current = true;
            updateOrderState(prev => ({ ...prev, stage: 'payment' }));
            sendFollowUpMessage('Great! Opening payment page now.');
            
            setTimeout(() => {
              submitOrderProgrammatically().then((success) => {
                if (success) {
                  console.log('[VoiceAssistant] Order submitted, navigated to payment');
                  setTimeout(() => {
                    sendFollowUpMessage('Say ONLY: "Заказ оформлен! Приятного отдыха!" or "Order confirmed! Enjoy!" Then STOP.');
                  }, 800);
                  updateOrderState(prev => ({ ...prev, stage: 'ready' }));
                  setState('complete');
                } else {
                  submittingOrderRef.current = false;
                  updateOrderState(prev => ({ ...prev, stage: 'cart' }));
                  sendFollowUpMessage('There was an issue. Please try the Payment button manually.');
                }
              });
            }, 500);
          }
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
        updateOrderState(() => ({ stage: 'strength' }));
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
        // Set to 'speaking' initially because AI will greet first
        setState('speaking');
        voiceAssistantSingleton.markSessionActive(instanceId);
        
        // Use detected language for greeting, default to Russian for Russian-speaking locale
        const lang = detectedLanguageRef.current || language;
        const isRussian = lang === 'ru' || lang === 'uk';
        
        // Send initial greeting in ONE language only - AI MUST speak first
        let greetingInstruction = '';
        if (!isLoggedIn) {
          greetingInstruction = isRussian 
            ? 'НЕМЕДЛЕННО начни говорить. Скажи: "Добро пожаловать! Для заказа с доставкой в номер нужно зарегистрироваться. Хотите помогу?" ГОВОРИ СЕЙЧАС, не жди.'
            : 'IMMEDIATELY start speaking. Say: "Welcome! To order with room delivery, you need to register. Would you like help?" SPEAK NOW, do not wait.';
        } else if (!roomNumber) {
          greetingInstruction = isRussian
            ? 'НЕМЕДЛЕННО начни говорить. Скажи: "Здравствуйте! Подскажите номер вашей комнаты для доставки?" ГОВОРИ СЕЙЧАС, не жди.'
            : 'IMMEDIATELY start speaking. Say: "Hello! What is your room number for delivery?" SPEAK NOW, do not wait.';
        } else {
          greetingInstruction = isRussian
            ? `НЕМЕДЛЕННО начни говорить. Скажи: "Здравствуйте! Доставка в комнату ${roomNumber}. Какую крепость кальяна выберете? Ультра лёгкий, Лёгкий, Средний или Крепкий?" ГОВОРИ СЕЙЧАС.`
            : `IMMEDIATELY start speaking. Say: "Hello! Delivery to room ${roomNumber}. What hookah strength would you like? Ultra Light, Light, Medium, or Bold Strong?" SPEAK NOW.`;
        }
        
        // Force AI to respond immediately with audio
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
