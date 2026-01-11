/**
 * 3-Stage Noise Filter for Voice Assistant
 * 
 * Stage 1: Audio-level filter (before Whisper) - handled in WebRTC config
 * Stage 2: Text sanity filter (after Whisper)
 * Stage 3: Semantic filter (FSM-aware)
 */

import { OrderStage } from './types';
import { isBackchannelOnly, isNoise, NOISE_PATTERNS, BACKCHANNEL_WORDS } from './intentConfig';

// ============= FILTER RESULT =============

export type FilterResult = 
  | { type: 'valid'; text: string }
  | { type: 'noise'; reason: string }
  | { type: 'backchannel'; reason: string }
  | { type: 'invalid'; reason: string };

// ============= STAGE KEYWORDS =============

const STAGE_KEYWORDS: Record<OrderStage, string[]> = {
  login: [
    // Registration-related
    'yes', 'no', 'да', 'нет', 'register', 'регистр', 'sign', 'help', 'помог',
    'want', 'хочу', 'skip', 'пропустить', 'okay', 'ок', 'давай', 'конечно'
  ],
  room: [
    // Room number related
    'room', 'комната', 'номер', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
  ],
  strength: [
    // Strength related
    'light', 'medium', 'strong', 'bold', 'ultra',
    'лёгкий', 'легкий', 'средний', 'крепкий', 'лайт', 'медиум'
  ],
  flavor: [
    // Flavor and quantity related
    'vanilla', 'mint', 'apple', 'grape', 'berry', 'lime', 'watermelon',
    'ваниль', 'мята', 'яблоко', 'виноград', 'ягода', 'лайм', 'арбуз',
    'hookah', 'кальян', 'shisha', 'one', 'two', 'three', 'один', 'два', 'три',
    '1', '2', '3', '4', '5',
    'african', 'queen', 'tangiers', 'darkside', 'tipsy', 'moscow'
  ],
  cart: [
    // Confirmation related
    'yes', 'no', 'да', 'нет', 'confirm', 'подтвержда', 'cancel', 'отмена',
    'correct', 'верно', 'wrong', 'неверно', 'submit', 'оформ', 'готов'
  ],
  more: [
    // "Want more?" stage - yes/no responses
    'yes', 'no', 'да', 'нет', 'ещё', 'more', 'another', 'хватит', 'достаточно',
    'enough', 'всё', 'все', 'done', 'готов', 'stop', 'стоп', 'ок', 'okay'
  ],
  payment: [
    // Payment related
    'pay', 'оплат', 'card', 'карт', 'cash', 'наличн', 'transfer', 'перевод'
  ],
  ready: []
};

// ============= FILTER FUNCTIONS =============

/**
 * Stage 2: Text Sanity Filter
 * Checks basic text validity after Whisper transcription
 */
export function textSanityFilter(text: string): FilterResult {
  const trimmed = text.trim();
  
  // Empty or whitespace only
  if (!trimmed) {
    return { type: 'noise', reason: 'empty_text' };
  }
  
  // Too short (less than 3 chars)
  if (trimmed.length < NOISE_PATTERNS.minLength) {
    return { type: 'noise', reason: 'too_short' };
  }
  
  // Only filler words
  const words = trimmed.toLowerCase().split(/\s+/);
  if (words.every(word => NOISE_PATTERNS.maxNoiseWords.includes(word))) {
    return { type: 'noise', reason: 'only_filler_words' };
  }
  
  // Only backchannel
  if (isBackchannelOnly(trimmed)) {
    return { type: 'backchannel', reason: 'backchannel_only' };
  }
  
  return { type: 'valid', text: trimmed };
}

/**
 * Stage 3: Semantic Filter (FSM-aware)
 * Checks if text contains relevant content for current stage
 */
export function semanticFilter(text: string, currentStage: OrderStage): FilterResult {
  const lowerText = text.toLowerCase();
  
  // Get keywords for current stage
  const stageKeywords = STAGE_KEYWORDS[currentStage];
  
  // For ready stage, everything is noise (session should end)
  if (currentStage === 'ready' || currentStage === 'payment') {
    return { type: 'noise', reason: 'session_complete' };
  }
  
  // Check if text contains any relevant keyword for current stage
  const hasRelevantKeyword = stageKeywords.some(keyword => 
    lowerText.includes(keyword)
  );
  
  // Check if text contains numbers (relevant for room and quantity)
  const hasNumbers = /\d/.test(text);
  
  // For room stage, numbers are especially important
  if (currentStage === 'room' && hasNumbers) {
    return { type: 'valid', text };
  }
  
  // For flavor stage with quantity, numbers are important
  if (currentStage === 'flavor' && hasNumbers) {
    return { type: 'valid', text };
  }
  
  if (hasRelevantKeyword) {
    return { type: 'valid', text };
  }
  
  // Text doesn't contain stage-relevant content
  return { type: 'invalid', reason: 'no_stage_relevant_content' };
}

/**
 * Combined filter pipeline
 */
export function filterTranscript(text: string, currentStage: OrderStage): FilterResult {
  // Stage 2: Text sanity
  const sanityResult = textSanityFilter(text);
  if (sanityResult.type !== 'valid') {
    return sanityResult;
  }
  
  // Stage 3: Semantic filter
  return semanticFilter(sanityResult.text, currentStage);
}

/**
 * Get appropriate response for noise/invalid input
 */
export function getNoiseResponse(result: FilterResult, language: 'ru' | 'en' = 'ru'): string {
  const responses = {
    noise: {
      ru: 'Извините, я не расслышал. Пожалуйста, повторите.',
      en: "Sorry, I didn't catch that. Please repeat."
    },
    backchannel: {
      ru: 'Извините, не понял. Что вы хотели сказать?',
      en: "Sorry, I didn't understand. What did you want to say?"
    },
    invalid: {
      ru: 'Пожалуйста, ответьте на текущий вопрос.',
      en: 'Please answer the current question.'
    }
  };
  
  if (result.type === 'valid') {
    return '';
  }
  
  return responses[result.type][language];
}
