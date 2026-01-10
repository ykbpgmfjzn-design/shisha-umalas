import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useNavigate } from 'react-router-dom';

export type VoiceAssistantState = 
  | 'idle' 
  | 'connecting' 
  | 'listening' 
  | 'speaking' 
  | 'processing'
  | 'complete'
  | 'error';

interface UseVoiceAssistantReturn {
  state: VoiceAssistantState;
  transcript: string;
  assistantMessage: string;
  error: string | null;
  startSession: (language?: string) => Promise<void>;
  endSession: () => void;
  isActive: boolean;
}

export const useVoiceAssistant = (): UseVoiceAssistantReturn => {
  const [state, setState] = useState<VoiceAssistantState>('idle');
  const [transcript, setTranscript] = useState('');
  const [assistantMessage, setAssistantMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  
  const { addItem } = useCart();
  const navigate = useNavigate();

  const cleanup = useCallback(() => {
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
  }, []);

  const endSession = useCallback(() => {
    cleanup();
    setState('idle');
    setTranscript('');
    setAssistantMessage('');
  }, [cleanup]);

  const startSession = useCallback(async (language: string = 'en') => {
    try {
      setState('connecting');
      setError(null);
      setTranscript('');
      setAssistantMessage('');

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Get ephemeral token from edge function
      const { data, error: fnError } = await supabase.functions.invoke('openai-realtime-session', {
        body: { language },
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

      // Add local audio track
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

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
        // Check if order is complete
        if (event.transcript?.toLowerCase().includes('order complete')) {
          setState('complete');
        }
        break;
        
      case 'input_audio_buffer.speech_started':
        setState('listening');
        setTranscript('');
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        setTranscript(event.transcript || '');
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
  }, [state]);

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
  };
};
