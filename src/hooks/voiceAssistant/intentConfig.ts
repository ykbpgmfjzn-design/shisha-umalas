/**
 * FSM Intent Configuration - Single Source of Truth
 * 
 * This file defines the strict mapping between intents, handlers, and allowed stages.
 * The FSM controls the conversation flow, not the LLM.
 */

import { OrderStage } from './types';

// ============= INTENT DEFINITIONS =============

export type IntentType = 
  | 'agree_registration'
  | 'decline_registration'
  | 'provide_room_number'
  | 'choose_strength'
  | 'choose_flavor'
  | 'choose_quantity'
  | 'confirm_order'
  | 'decline_order'
  | 'backchannel'
  | 'noise'
  | 'unknown';

export interface IntentRule {
  intent: IntentType;
  allowedStage: OrderStage;
  minConfidence: number;
  keywords: string[];
  antiKeywords?: string[]; // Words that should NOT be in the text
  requiresSlots?: string[]; // Required slot values
  handler: string; // Handler function name
}

// ============= CONFIDENCE THRESHOLDS =============

export const CONFIDENCE_THRESHOLDS: Record<IntentType, number> = {
  agree_registration: 0.50, // Lower threshold - simple "да/yes" should work
  decline_registration: 0.50, // Lower threshold for declining too
  provide_room_number: 0.70,
  choose_strength: 0.70,
  choose_flavor: 0.70,
  choose_quantity: 0.80,
  confirm_order: 0.95, // MOST STRICT - prevent accidental confirmations
  decline_order: 0.70,
  backchannel: 0.0, // Always matches if only backchannel words
  noise: 0.0,
  unknown: 0.0,
};

// ============= BACKCHANNEL WORDS (NEVER count as intent) =============
// NOTE: "да", "yes", "нет", "no" are NOT backchannel - they're valid responses!
// Backchannel = filler words with NO semantic meaning

export const BACKCHANNEL_WORDS = [
  // English fillers only (NOT yes/no - those have meaning)
  'uh-huh', 'mhm', 'hmm', 'ah', 'oh', 'um', 'uh',
  // Russian fillers only (NOT да/нет - those have meaning)
  'угу', 'ага', 'мм', 'ммм', 'ну', 'ээ', 'аа',
  // Indonesian fillers only
  'hmm',
];

// ============= NOISE PATTERNS =============

export const NOISE_PATTERNS = {
  minLength: 3, // Minimum characters for valid input
  maxNoiseWords: ['мм', 'аа', 'ээ', 'hmm', 'uh', 'ah', 'um', 'er'],
  minSpeechDuration: 600, // ms
  silenceThreshold: 400, // ms
  minVolumeDb: -35,
};

// ============= INTENT RULES TABLE =============

export const INTENT_RULES: IntentRule[] = [
  // LOGIN STAGE
  {
    intent: 'agree_registration',
    allowedStage: 'login',
    minConfidence: 0.50, // Low threshold - simple да/yes is enough
    keywords: [
      // Explicit agreement words
      'yes', 'да', 'готов', 'хочу', 'register', 'регистр', 'sign up', 
      'help', 'помог', 'давай', 'конечно', 'sure', "let's go", 'поехали',
      'want', 'need', 'please', 'пожалуйста', 'okay', 'ok', 'ок', 'окей',
      'ладно', 'согласен', 'agree', 'iya', 'ya' // Indonesian yes
    ],
    antiKeywords: ['no', 'нет', 'не хочу', 'без', 'skip', 'пропустить', 'потом', 'later', 'tidak'],
    handler: 'handleAgreeRegistration',
  },
  {
    intent: 'decline_registration',
    allowedStage: 'login',
    minConfidence: 0.50, // Low threshold - simple нет/no is enough
    keywords: [
      'no', 'нет', 'не хочу', 'не надо', 'без регистрации', 'without',
      'skip', 'пропустить', 'потом', 'later', 'just browse', 'просто посмотреть',
      'сам', 'myself', 'не сейчас', 'not now', 'tidak' // Indonesian no
    ],
    handler: 'handleDeclineRegistration',
  },
  
  // ROOM STAGE
  {
    intent: 'provide_room_number',
    allowedStage: 'room',
    minConfidence: 0.70,
    keywords: [], // Detected via regex, not keywords
    requiresSlots: ['roomNumber'],
    handler: 'handleRoomNumber',
  },
  
  // STRENGTH STAGE
  {
    intent: 'choose_strength',
    allowedStage: 'strength',
    minConfidence: 0.85,
    keywords: [
      'ultra light', 'ультра лёгкий', 'ультра легкий', 'очень лёгкий',
      'light', 'лёгкий', 'легкий', 'лайт',
      'medium', 'средний', 'средняя', 'медиум',
      'bold', 'strong', 'крепкий', 'крепкая', 'болд', 'стронг'
    ],
    handler: 'handleStrength',
  },
  
  // FLAVOR STAGE
  {
    intent: 'choose_flavor',
    allowedStage: 'flavor',
    minConfidence: 0.85,
    keywords: [
      // Flavors (partial list - full matching done in menuItems.ts)
      'vanilla', 'ваниль', 'mint', 'мята', 'watermelon', 'арбуз',
      'apple', 'яблоко', 'grape', 'виноград', 'berry', 'ягода',
      'lime', 'лайм', 'cream', 'крем', 'moscow', 'москва',
      'african', 'queen', 'tangiers', 'darkside'
    ],
    handler: 'handleFlavor',
  },
  {
    intent: 'choose_quantity',
    allowedStage: 'flavor',
    minConfidence: 0.90,
    keywords: [
      'one', 'two', 'three', 'four', 'five',
      'один', 'два', 'три', 'четыре', 'пять',
      '1', '2', '3', '4', '5',
      'hookah', 'hookahs', 'кальян', 'кальяна', 'кальянов', 'штук', 'штуки'
    ],
    requiresSlots: ['quantity'],
    handler: 'handleQuantity',
  },
  
  // CART STAGE
  {
    intent: 'confirm_order',
    allowedStage: 'cart',
    minConfidence: 0.95, // HIGHEST - must be very explicit
    keywords: [
      'confirm', 'подтвержда', 'согласен', 'верно', 'correct',
      'proceed', 'готов', 'оформ', 'submit', 'отправ', 'place order',
      'оформить заказ', 'да, всё верно', 'yes, correct'
    ],
    antiKeywords: ['no', 'нет', 'cancel', 'отмена', 'wait', 'подожди', 'change', 'измени'],
    handler: 'handleConfirmOrder',
  },
  {
    intent: 'decline_order',
    allowedStage: 'cart',
    minConfidence: 0.80,
    keywords: [
      'cancel', 'отмена', 'отменить', 'no', 'нет', 'not correct',
      'неверно', 'wrong', 'change', 'измени', 'другой'
    ],
    handler: 'handleDeclineOrder',
  },
];

// ============= STAGE REMINDER MESSAGES =============

export const STAGE_REMINDERS: Record<OrderStage, { ru: string; en: string }> = {
  login: {
    ru: 'Для заказа необходима регистрация. Хотите зарегистрироваться?',
    en: 'Registration is required to place an order. Would you like to register?',
  },
  room: {
    ru: 'Пожалуйста, назовите номер вашей комнаты.',
    en: 'Please tell me your room number.',
  },
  strength: {
    ru: 'Какую крепость кальяна вы предпочитаете?',
    en: 'What hookah strength do you prefer?',
  },
  flavor: {
    ru: 'Какой вкус кальяна вы хотите?',
    en: 'What hookah flavor would you like?',
  },
  cart: {
    ru: 'Пожалуйста, подтвердите заказ.',
    en: 'Please confirm your order.',
  },
  payment: {
    ru: 'Выберите способ оплаты.',
    en: 'Choose your payment method.',
  },
  ready: {
    ru: 'Заказ оформлен. Спасибо!',
    en: 'Order placed. Thank you!',
  },
};

// ============= HELPER FUNCTIONS =============

/**
 * Check if text is only backchannel (no real intent)
 */
export function isBackchannelOnly(text: string): boolean {
  const words = text.toLowerCase().trim().split(/\s+/);
  return words.every(word => BACKCHANNEL_WORDS.includes(word));
}

/**
 * Check if text is noise (too short, only filler words)
 */
export function isNoise(text: string): boolean {
  const trimmed = text.trim();
  
  // Too short
  if (trimmed.length < NOISE_PATTERNS.minLength) {
    return true;
  }
  
  // Only noise words
  const words = trimmed.toLowerCase().split(/\s+/);
  if (words.every(word => NOISE_PATTERNS.maxNoiseWords.includes(word))) {
    return true;
  }
  
  return false;
}

/**
 * Calculate intent confidence based on keyword matches
 */
export function calculateIntentConfidence(text: string, rule: IntentRule): number {
  const lowerText = text.toLowerCase();
  
  // Check anti-keywords first (disqualify if present)
  if (rule.antiKeywords?.some(kw => lowerText.includes(kw))) {
    return 0;
  }
  
  // Count keyword matches
  const matches = rule.keywords.filter(kw => lowerText.includes(kw));
  
  if (matches.length === 0) {
    return 0;
  }
  
  // Base confidence from match ratio
  const baseConfidence = Math.min(0.95, 0.5 + (matches.length * 0.15));
  
  // Boost for longer, more explicit phrases
  const lengthBonus = Math.min(0.1, text.length / 100);
  
  return Math.min(1.0, baseConfidence + lengthBonus);
}

/**
 * Get the intent for given text and stage with confidence
 */
export function detectIntent(
  text: string, 
  currentStage: OrderStage,
  slots: { roomNumber?: string; quantity?: number; strength?: string; flavor?: string }
): { intent: IntentType; confidence: number; accepted: boolean; reason?: string } {
  // Filter out noise and backchannel first
  if (isNoise(text)) {
    return { intent: 'noise', confidence: 1.0, accepted: false, reason: 'noise_detected' };
  }
  
  if (isBackchannelOnly(text)) {
    return { intent: 'backchannel', confidence: 1.0, accepted: false, reason: 'backchannel_only' };
  }
  
  // Find matching rules for current stage
  const stageRules = INTENT_RULES.filter(r => r.allowedStage === currentStage);
  
  let bestMatch: { rule: IntentRule; confidence: number } | null = null;
  
  for (const rule of stageRules) {
    const confidence = calculateIntentConfidence(text, rule);
    
    if (confidence > 0 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = { rule, confidence };
    }
  }
  
  // No match found
  if (!bestMatch) {
    // Check if intent matches a different stage (user trying to skip)
    const otherStageRules = INTENT_RULES.filter(r => r.allowedStage !== currentStage);
    for (const rule of otherStageRules) {
      const confidence = calculateIntentConfidence(text, rule);
      if (confidence >= rule.minConfidence) {
        return { 
          intent: rule.intent, 
          confidence, 
          accepted: false, 
          reason: `wrong_stage_expected_${currentStage}` 
        };
      }
    }
    
    return { intent: 'unknown', confidence: 0, accepted: false, reason: 'no_match' };
  }
  
  const { rule, confidence } = bestMatch;
  
  // Check confidence threshold
  if (confidence < rule.minConfidence) {
    return { 
      intent: rule.intent, 
      confidence, 
      accepted: false, 
      reason: 'confidence_below_threshold' 
    };
  }
  
  // Check required slots
  if (rule.requiresSlots) {
    for (const slot of rule.requiresSlots) {
      if (!slots[slot as keyof typeof slots]) {
        return { 
          intent: rule.intent, 
          confidence, 
          accepted: false, 
          reason: `missing_slot_${slot}` 
        };
      }
    }
  }
  
  return { intent: rule.intent, confidence, accepted: true };
}

/**
 * Guard function - returns true if intent is allowed, false otherwise
 */
export function guardIntent(
  intent: IntentType, 
  currentStage: OrderStage
): { allowed: boolean; reminder?: { ru: string; en: string } } {
  const rule = INTENT_RULES.find(r => r.intent === intent);
  
  if (!rule) {
    return { allowed: false, reminder: STAGE_REMINDERS[currentStage] };
  }
  
  if (rule.allowedStage !== currentStage) {
    return { allowed: false, reminder: STAGE_REMINDERS[currentStage] };
  }
  
  return { allowed: true };
}
