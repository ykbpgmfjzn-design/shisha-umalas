import { useConversation } from "@elevenlabs/react";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface VoiceAgentProps {
  agentId: string;
}

const VoiceAgent = ({ agentId }: VoiceAgentProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to voice agent");
      toast({
        title: "Connected",
        description: "Voice agent is ready. Start speaking!",
      });
    },
    onDisconnect: () => {
      console.log("Disconnected from voice agent");
    },
    onMessage: (message) => {
      console.log("Message:", message);
    },
    onError: (error) => {
      console.error("Voice agent error:", error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Failed to connect to voice agent. Please try again.",
      });
    },
  });

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get token from edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-conversation-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ agentId }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get conversation token");
      }

      const data = await response.json();

      if (!data?.token) {
        throw new Error("No token received");
      }

      // Start the conversation with WebRTC
      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });
    } catch (error) {
      console.error("Failed to start conversation:", error);
      toast({
        variant: "destructive",
        title: "Microphone Access Required",
        description: "Please enable microphone access to use voice features.",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [conversation, agentId, toast]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const toggleAgent = () => {
    if (isOpen && conversation.status === "connected") {
      stopConversation();
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Floating Action Button */}
      <motion.div
        className="fixed bottom-6 right-6 z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1, type: "spring" }}
      >
        <Button
          onClick={toggleAgent}
          size="lg"
          className="rounded-full w-16 h-16 bg-gradient-to-br from-golden to-sunset hover:from-sunset hover:to-golden shadow-lg shadow-golden/30"
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </Button>
      </motion.div>

      {/* Voice Agent Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            transition={{ type: "spring", damping: 25 }}
            className="fixed bottom-24 right-6 z-50 w-80 bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-golden/20 to-sunset/20 p-4 border-b border-border/30">
              <h3 className="font-display text-xl text-foreground">Shisha Menu</h3>
              <p className="text-sm text-muted-foreground">Voice Assistant</p>
            </div>

            {/* Content */}
            <div className="p-6 flex flex-col items-center gap-4">
              {/* Status Indicator */}
              <div className="flex items-center gap-2 text-sm">
                <div
                  className={`w-2 h-2 rounded-full ${
                    conversation.status === "connected"
                      ? "bg-green-500 animate-pulse"
                      : "bg-muted-foreground"
                  }`}
                />
                <span className="text-muted-foreground capitalize">
                  {conversation.status === "connected" ? "Connected" : "Disconnected"}
                </span>
              </div>

              {/* Speaking Indicator */}
              {conversation.status === "connected" && (
                <motion.div
                  className="flex items-center gap-3"
                  animate={{ opacity: conversation.isSpeaking ? 1 : 0.5 }}
                >
                  <Volume2
                    className={`w-5 h-5 ${
                      conversation.isSpeaking ? "text-golden animate-pulse" : "text-muted-foreground"
                    }`}
                  />
                  <span className="text-sm text-muted-foreground">
                    {conversation.isSpeaking ? "Agent is speaking..." : "Listening..."}
                  </span>
                </motion.div>
              )}

              {/* Action Button */}
              {conversation.status === "disconnected" ? (
                <Button
                  onClick={startConversation}
                  disabled={isConnecting}
                  className="w-full bg-gradient-to-r from-golden to-sunset hover:from-sunset hover:to-golden"
                >
                  {isConnecting ? (
                    <span className="flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Connecting...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Mic className="w-4 h-4" />
                      Start Conversation
                    </span>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={stopConversation}
                  variant="outline"
                  className="w-full border-destructive text-destructive hover:bg-destructive/10"
                >
                  <MicOff className="w-4 h-4 mr-2" />
                  End Conversation
                </Button>
              )}

              {/* Instructions */}
              <p className="text-xs text-center text-muted-foreground">
                Ask about our shisha flavors, strengths, and signature mixes!
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VoiceAgent;
