// Global singleton state for voice assistant
// This ensures only ONE voice session can exist across the entire app

interface VoiceAssistantSingletonState {
  isSessionActive: boolean;
  isStarting: boolean;
  instanceId: string | null;
  peerConnection: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  mediaStream: MediaStream | null;
  audioElement: HTMLAudioElement | null;
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
};

// Lock for preventing race conditions
let sessionLock = false;

export const voiceAssistantSingleton = {
  // Try to acquire session - returns true if successful
  tryAcquireSession: (instanceId: string): boolean => {
    if (sessionLock) {
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
    
    sessionLock = true;
    globalState.isStarting = true;
    globalState.instanceId = instanceId;
    
    // Release lock after short delay
    setTimeout(() => {
      sessionLock = false;
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
    sessionLock = false;
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
    sessionLock = false;
  },
  
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
