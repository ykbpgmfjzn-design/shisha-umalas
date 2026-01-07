import HeroSection from "@/components/HeroSection";
import MenuSection from "@/components/MenuSection";
import FooterSection from "@/components/FooterSection";
import LanguageSelector from "@/components/LanguageSelector";
import VoiceAgent from "@/components/VoiceAgent";
import Cart from "@/components/Cart";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/contexts/CartContext";

const Index = () => {
  return (
    <LanguageProvider>
      <CartProvider>
        <main className="min-h-screen bg-background">
          <LanguageSelector />
          <HeroSection />
          <MenuSection />
          <FooterSection />
          <VoiceAgent />
          <Cart />
        </main>
      </CartProvider>
    </LanguageProvider>
  );
};

export default Index;
