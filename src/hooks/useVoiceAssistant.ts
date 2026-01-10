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
  const [orderState, setOrderState] = useState<OrderState>({ stage: 'ordering' });
  const [user, setUser] = useState<any>(null);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const { addItem, setIsOpen: setCartOpen } = useCart();
  const navigate = useNavigate();

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

  // Process user transcript and add to cart if order is complete
  const processTranscript = useCallback((text: string) => {
    const lowerText = text.toLowerCase();
    
    // Try to find flavor
    const menuItem = findMenuItemByKeyword(lowerText);
    if (menuItem) {
      setOrderState(prev => ({ 
        ...prev, 
        flavor: menuItem.name,
        itemId: menuItem.id,
        strength: menuItem.strength,
      }));
    }
    
    // Try to find strength
    const strength = getStrengthFromKeyword(lowerText);
    if (strength) {
      setOrderState(prev => ({ ...prev, strength }));
    }
    
    // Try to find quantity
    const quantityMatch = lowerText.match(/(\d+)\s*(hookah|кальян|shisha)/i) ||
                         lowerText.match(/(\d+)\s*штук/i) ||
                         lowerText.match(/(one|two|three|four|five|один|два|три|четыре|пять)/i);
    if (quantityMatch) {
      const numMap: Record<string, number> = {
        'one': 1, 'два': 2, 'один': 1, 'two': 2, 'три': 3, 'three': 3, 
        'four': 4, 'четыре': 4, 'five': 5, 'пять': 5
      };
      const qty = numMap[quantityMatch[1].toLowerCase()] || parseInt(quantityMatch[1]);
      if (qty > 0) {
        setOrderState(prev => ({ ...prev, quantity: qty }));
      }
    }
  }, []);

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

  // Add items to cart
  const addToCart = useCallback((itemId: string, quantity: number) => {
    const item = menuItems.find(m => m.id === itemId);
    if (item) {
      for (let i = 0; i < quantity; i++) {
        addItem({
          id: item.id,
          name: item.name,
          price: item.price,
          priceDisplay: item.priceDisplay,
          strength: item.strength,
          isSignature: item.isSignature,
          itemType: item.itemType,
        });
      }
      toast.success(`Added ${quantity}x ${item.name} to cart!`);
      return true;
    }
    return false;
  }, [addItem]);

  const endSession = useCallback(() => {
    // If we have a complete order, add to cart
    if (orderState.itemId && orderState.quantity) {
      addToCart(orderState.itemId, orderState.quantity);
    }
    cleanup();
    setState('idle');
    setTranscript('');
    setAssistantMessage('');
    setOrderState({ stage: 'ordering' });
  }, [cleanup, orderState, addToCart]);

  const startSession = useCallback(async (language: string = 'en', isLoggedIn: boolean = false, roomNumber: string | null = null) => {
    try {
      setState('connecting');
      setError(null);
      setTranscript('');
      setAssistantMessage('');

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
        // Send initial greeting request
        dc.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['audio', 'text'],
            instructions: 'Greet the user briefly and ask what flavor hookah they want. Keep it under 10 words.',
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
  }, [cleanup, state]);

  const handleRealtimeEvent = useCallback((event: any) => {
    switch (event.type) {
      case 'response.audio_transcript.delta':
        setAssistantMessage(prev => prev + (event.delta || ''));
        setState('speaking');
        break;
        
      case 'response.audio_transcript.done':
        const transcriptLower = (event.transcript || '').toLowerCase();
        
        // Detect "added to cart" - open cart and move to cart stage
        if (transcriptLower.includes('added to cart') || 
            transcriptLower.includes('добавлено в корзину') ||
            transcriptLower.includes('opening cart') ||
            transcriptLower.includes('открываю корзину')) {
          // Add to cart if we have the order info
          if (orderState.itemId && orderState.quantity) {
            addToCart(orderState.itemId, orderState.quantity);
          }
          // Open cart drawer
          setTimeout(() => setCartOpen(true), 500);
          setOrderState(prev => ({ ...prev, stage: 'cart', cartOpened: true }));
        }
        
        // Detect login needed
        if (transcriptLower.includes('need to log in') || 
            transcriptLower.includes('нужно войти') ||
            transcriptLower.includes('click login') ||
            transcriptLower.includes('нажмите войти')) {
          setOrderState(prev => ({ ...prev, stage: 'login' }));
        }
        
        // Detect opening registration page
        if (transcriptLower.includes('opening registration') || 
            transcriptLower.includes('открываю регистрацию')) {
          navigate('/auth');
        }
        
        // Detect room number stage
        if (transcriptLower.includes("what's your room") || 
            transcriptLower.includes('какой номер комнаты') ||
            transcriptLower.includes('номер комнаты')) {
          setOrderState(prev => ({ ...prev, stage: 'room' }));
        }
        
        // Detect ready for payment - auto close after 3 seconds
        if (transcriptLower.includes('order guide complete') || 
            transcriptLower.includes('сопровождение заказа завершено') ||
            transcriptLower.includes('everything ready') ||
            transcriptLower.includes('всё готово') ||
            transcriptLower.includes('ready to pay') ||
            transcriptLower.includes('готово к оплате') ||
            transcriptLower.includes('click pay') ||
            transcriptLower.includes('нажмите оплатить')) {
          setOrderState(prev => ({ ...prev, stage: 'ready' }));
          setState('complete');
        }
        break;
        
      case 'input_audio_buffer.speech_started':
        setState('listening');
        setTranscript('');
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        const transcriptText = event.transcript || '';
        setTranscript(transcriptText);
        // Process the transcript to extract order info
        processTranscript(transcriptText);
        setState('processing');
        break;
        
      case 'response.done':
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
  }, [state, orderState, addToCart, processTranscript, setCartOpen, navigate]);

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
