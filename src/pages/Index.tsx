import HeroSection from "@/components/HeroSection";
import MenuSection from "@/components/MenuSection";
import FooterSection from "@/components/FooterSection";
import LanguageSelector from "@/components/LanguageSelector";
import VoiceAgent from "@/components/VoiceAgent";
import { LanguageProvider } from "@/contexts/LanguageContext";

const ELEVENLABS_AGENT_ID = "your-agent-id-here"; // Replace with your ElevenLabs agent ID

const Index = () => {
  return (
    <LanguageProvider>
      <main className="min-h-screen bg-background">
        <LanguageSelector />
        <HeroSection />
        <MenuSection />
        <FooterSection />
        <VoiceAgent agentId={ELEVENLABS_AGENT_ID} />
      </main>
    </LanguageProvider>
  );
};

export default Index;
