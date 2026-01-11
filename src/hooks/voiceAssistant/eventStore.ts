/**
 * Event Store for Voice Assistant Sessions
 * 
 * Enables session replay and recovery after disconnections.
 * Uses localStorage for MVP, can be upgraded to Supabase for persistence.
 */

import { OrderStage, VoiceEvent } from './types';

const STORAGE_KEY = 'voice_assistant_events';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ============= SESSION STATE =============

interface SessionState {
  sessionId: string;
  events: VoiceEvent[];
  createdAt: number;
  lastStage: OrderStage;
  slots: {
    roomNumber?: string;
    strength?: string;
    flavor?: string;
    quantity?: number;
    itemId?: string;
  };
}

// ============= STORAGE OPERATIONS =============

function getStoredSessions(): Record<string, SessionState> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

function setStoredSessions(sessions: Record<string, SessionState>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error('[EventStore] Failed to save sessions:', e);
  }
}

function cleanExpiredSessions(): void {
  const sessions = getStoredSessions();
  const now = Date.now();
  
  for (const sessionId of Object.keys(sessions)) {
    if (now - sessions[sessionId].createdAt > SESSION_TTL_MS) {
      delete sessions[sessionId];
    }
  }
  
  setStoredSessions(sessions);
}

// ============= EVENT STORE API =============

export const eventStore = {
  /**
   * Create a new session
   */
  createSession(sessionId: string): SessionState {
    cleanExpiredSessions();
    
    const session: SessionState = {
      sessionId,
      events: [],
      createdAt: Date.now(),
      lastStage: 'login',
      slots: {},
    };
    
    const sessions = getStoredSessions();
    sessions[sessionId] = session;
    setStoredSessions(sessions);
    
    console.log('[EventStore] Created session:', sessionId);
    return session;
  },

  /**
   * Get existing session by ID
   */
  getSession(sessionId: string): SessionState | null {
    cleanExpiredSessions();
    const sessions = getStoredSessions();
    return sessions[sessionId] || null;
  },

  /**
   * Check if there's a recent session to resume
   */
  getResumableSession(): SessionState | null {
    cleanExpiredSessions();
    const sessions = getStoredSessions();
    
    // Find the most recent non-completed session
    let mostRecent: SessionState | null = null;
    
    for (const session of Object.values(sessions)) {
      if (session.lastStage === 'ready') continue; // Skip completed sessions
      if (!mostRecent || session.createdAt > mostRecent.createdAt) {
        mostRecent = session;
      }
    }
    
    return mostRecent;
  },

  /**
   * Log an event to the session
   */
  logEvent(
    sessionId: string, 
    stage: OrderStage, 
    intent?: string, 
    confidence?: number, 
    accepted?: boolean, 
    reason?: string,
    payload?: Record<string, unknown>
  ): VoiceEvent {
    const event: VoiceEvent = {
      sessionId,
      timestamp: Date.now(),
      stage,
      intent,
      confidence,
      accepted,
      reason,
      payload,
    };
    
    const sessions = getStoredSessions();
    const session = sessions[sessionId];
    
    if (session) {
      session.events.push(event);
      session.lastStage = stage;
      
      // Update slots from payload
      if (payload) {
        if (payload.roomNumber) session.slots.roomNumber = payload.roomNumber as string;
        if (payload.strength) session.slots.strength = payload.strength as string;
        if (payload.flavor) session.slots.flavor = payload.flavor as string;
        if (payload.quantity) session.slots.quantity = payload.quantity as number;
        if (payload.itemId) session.slots.itemId = payload.itemId as string;
      }
      
      setStoredSessions(sessions);
      console.log('[EventStore] Logged event:', intent, 'stage:', stage);
    }
    
    return event;
  },

  /**
   * Update session stage
   */
  updateStage(sessionId: string, stage: OrderStage): void {
    const sessions = getStoredSessions();
    const session = sessions[sessionId];
    
    if (session) {
      session.lastStage = stage;
      setStoredSessions(sessions);
    }
  },

  /**
   * Update session slots
   */
  updateSlots(
    sessionId: string, 
    slots: Partial<SessionState['slots']>
  ): void {
    const sessions = getStoredSessions();
    const session = sessions[sessionId];
    
    if (session) {
      session.slots = { ...session.slots, ...slots };
      setStoredSessions(sessions);
    }
  },

  /**
   * Replay events to reconstruct state
   */
  replaySession(sessionId: string): {
    stage: OrderStage;
    slots: SessionState['slots'];
  } | null {
    const session = this.getSession(sessionId);
    if (!session) return null;
    
    // Reconstruct state from events
    let stage: OrderStage = 'login';
    const slots: SessionState['slots'] = {};
    
    for (const event of session.events) {
      // Update stage
      stage = event.stage;
      
      // Update slots from payload
      if (event.payload) {
        if (event.payload.roomNumber) slots.roomNumber = event.payload.roomNumber as string;
        if (event.payload.strength) slots.strength = event.payload.strength as string;
        if (event.payload.flavor) slots.flavor = event.payload.flavor as string;
        if (event.payload.quantity) slots.quantity = event.payload.quantity as number;
        if (event.payload.itemId) slots.itemId = event.payload.itemId as string;
      }
    }
    
    console.log('[EventStore] Replayed session:', sessionId, 'stage:', stage, 'slots:', slots);
    return { stage, slots };
  },

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    const sessions = getStoredSessions();
    delete sessions[sessionId];
    setStoredSessions(sessions);
    console.log('[EventStore] Deleted session:', sessionId);
  },

  /**
   * Clear all sessions
   */
  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[EventStore] Cleared all sessions');
  },

  /**
   * Get session events for debugging
   */
  getEvents(sessionId: string): VoiceEvent[] {
    const session = this.getSession(sessionId);
    return session?.events || [];
  },
};
