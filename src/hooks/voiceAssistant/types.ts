/**
 * Voice Assistant Type Definitions
 */

import { Language } from '@/contexts/LanguageContext';

// ============= STATE TYPES =============

export type VoiceAssistantState = 
  | 'idle' 
  | 'connecting' 
  | 'listening' 
  | 'speaking' 
  | 'processing'
  | 'complete'
  | 'error';

export type OrderStage = 'login' | 'room' | 'ordering' | 'cart' | 'ready';

// ============= ORDER STATE =============

export interface OrderState {
  stage: OrderStage;
  flavor?: string;
  strength?: string;
  quantity?: number;
  itemId?: string;
  roomNumber?: string;
  cartOpened?: boolean;
  addedToCart?: boolean;
  registrationOffered?: boolean;
}

// ============= EVENT TYPES =============

export interface VoiceEvent {
  sessionId: string;
  timestamp: number;
  stage: OrderStage;
  intent?: string;
  confidence?: number;
  accepted?: boolean;
  reason?: string;
  payload?: Record<string, unknown>;
}

// ============= HOOK INTERFACES =============

export interface UseVoiceAssistantProps {
  onLanguageDetected?: (language: Language) => void;
}

export interface UseVoiceAssistantReturn {
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
