// Global singleton state for voice assistant
// This ensures only ONE voice session can exist across the entire app
// CRITICAL: This is the SINGLE SOURCE OF TRUTH for session state

interface VoiceAssistantSingletonState {
  isSessionActive: boolean;
  isStarting: boolean;
  instanceId: string | null;
  peerConnection: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  mediaStream: MediaStream | null;
  audioElement: HTMLAudioElement | null;
  // Track the current FSM stage globally
  currentStage: 'login' | 'room' | 'strength' | 'flavor' | 'more' | 'cart' | 'payment' | 'ready';
  // Track session start time to detect stale sessions
  sessionStartTime: number | null;
  // Lock with timestamp to prevent permanent locks
  lockTimestamp: number | null;
}

// Global singleton - shared across all hook instances
const globalState: VoiceAssistantSingletonState = {
  isSessionActive: false,
  isStarting: false,
  instanceId: null,
  peerConnection: null,
  dataChannel: null,
  mediaStream: null,
  audioElement: null,
  currentStage: 'login',
  sessionStartTime: null,
  lockTimestamp: null,
};

// Lock timeout (ms) - if lock is older than this, it's stale
const LOCK_TIMEOUT = 5000;
const SESSION_TIMEOUT = 300000; // 5 minutes

export const voiceAssistantSingleton = {
  // Try to acquire session - returns true if successful
  tryAcquireSession: (instanceId: string): boolean => {
    const now = Date.now();
    
    // Check for stale lock
    if (globalState.lockTimestamp && (now - globalState.lockTimestamp > LOCK_TIMEOUT)) {
      console.log('[VoiceSingleton] Stale lock detected, clearing');
      globalState.lockTimestamp = null;
    }
    
    // Check for stale session
    if (globalState.sessionStartTime && (now - globalState.sessionStartTime > SESSION_TIMEOUT)) {
      console.log('[VoiceSingleton] Stale session detected, force cleanup');
      voiceAssistantSingleton.forceCleanup();
    }
    
    if (globalState.lockTimestamp) {
      console.log('[VoiceSingleton] Session locked, rejecting acquire request');
      return false;
    }
    
    if (globalState.isSessionActive || globalState.isStarting) {
      console.log('[VoiceSingleton] Session already active/starting:', globalState.instanceId);
      // If same instance, allow it
      if (globalState.instanceId === instanceId) {
        return true;
      }
      return false;
    }
    
    globalState.lockTimestamp = now;
    globalState.isStarting = true;
    globalState.instanceId = instanceId;
    globalState.sessionStartTime = now;
    
    // Release lock after short delay
    setTimeout(() => {
      globalState.lockTimestamp = null;
    }, 100);
    
    console.log('[VoiceSingleton] Session acquired by:', instanceId);
    return true;
  },
  
  // Mark session as active (after WebRTC connected)
  markSessionActive: (instanceId: string): boolean => {
    if (globalState.instanceId !== instanceId) {
      console.log('[VoiceSingleton] Cannot mark active - wrong instance');
      return false;
    }
    globalState.isSessionActive = true;
    globalState.isStarting = false;
    console.log('[VoiceSingleton] Session marked active:', instanceId);
    return true;
  },
  
  // Release session
  releaseSession: (instanceId: string): void => {
    if (globalState.instanceId !== instanceId && globalState.instanceId !== null) {
      console.log('[VoiceSingleton] Cannot release - wrong instance:', instanceId, 'current:', globalState.instanceId);
      return;
    }
    
    console.log('[VoiceSingleton] Releasing session:', instanceId);
    
    // Cleanup all resources
    if (globalState.dataChannel) {
      try {
        globalState.dataChannel.close();
      } catch (e) {
        console.log('[VoiceSingleton] Error closing data channel:', e);
      }
      globalState.dataChannel = null;
    }
    
    if (globalState.peerConnection) {
      try {
        globalState.peerConnection.close();
      } catch (e) {
        console.log('[VoiceSingleton] Error closing peer connection:', e);
      }
      globalState.peerConnection = null;
    }
    
    if (globalState.mediaStream) {
      globalState.mediaStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.log('[VoiceSingleton] Error stopping track:', e);
        }
      });
      globalState.mediaStream = null;
    }
    
    if (globalState.audioElement) {
      try {
        globalState.audioElement.pause();
        globalState.audioElement.srcObject = null;
      } catch (e) {
        console.log('[VoiceSingleton] Error cleaning audio element:', e);
      }
      globalState.audioElement = null;
    }
    
    globalState.isSessionActive = false;
    globalState.isStarting = false;
    globalState.instanceId = null;
    globalState.lockTimestamp = null;
    globalState.sessionStartTime = null;
    globalState.currentStage = 'login';
  },
  
  // Force cleanup any existing session
  forceCleanup: (): void => {
    console.log('[VoiceSingleton] Force cleanup called');
    
    // Cleanup all resources regardless of instance
    if (globalState.dataChannel) {
      try {
        globalState.dataChannel.close();
      } catch (e) {}
      globalState.dataChannel = null;
    }
    
    if (globalState.peerConnection) {
      try {
        globalState.peerConnection.close();
      } catch (e) {}
      globalState.peerConnection = null;
    }
    
    if (globalState.mediaStream) {
      globalState.mediaStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {}
      });
      globalState.mediaStream = null;
    }
    
    if (globalState.audioElement) {
      try {
        globalState.audioElement.pause();
        globalState.audioElement.srcObject = null;
      } catch (e) {}
      globalState.audioElement = null;
    }
    
    globalState.isSessionActive = false;
    globalState.isStarting = false;
    globalState.instanceId = null;
    globalState.lockTimestamp = null;
    globalState.sessionStartTime = null;
    globalState.currentStage = 'login';
  },
  
  // Set current FSM stage globally
  setStage: (stage: 'login' | 'room' | 'strength' | 'flavor' | 'more' | 'cart' | 'payment' | 'ready'): void => {
    console.log('[VoiceSingleton] Stage changed:', globalState.currentStage, '->', stage);
    globalState.currentStage = stage;
  },
  
  getStage: (): string => globalState.currentStage,
  
  // Store WebRTC objects
  setPeerConnection: (pc: RTCPeerConnection | null): void => {
    globalState.peerConnection = pc;
  },
  
  setDataChannel: (dc: RTCDataChannel | null): void => {
    globalState.dataChannel = dc;
  },
  
  setMediaStream: (stream: MediaStream | null): void => {
    globalState.mediaStream = stream;
  },
  
  setAudioElement: (audio: HTMLAudioElement | null): void => {
    globalState.audioElement = audio;
  },
  
  // Getters
  getDataChannel: (): RTCDataChannel | null => globalState.dataChannel,
  getPeerConnection: (): RTCPeerConnection | null => globalState.peerConnection,
  getMediaStream: (): MediaStream | null => globalState.mediaStream,
  isActive: (): boolean => globalState.isSessionActive,
  isStarting: (): boolean => globalState.isStarting,
  getCurrentInstanceId: (): string | null => globalState.instanceId,
};

export default voiceAssistantSingleton;
