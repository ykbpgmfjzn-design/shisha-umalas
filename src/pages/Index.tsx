import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import HeroSection from "@/components/HeroSection";
import MenuSection from "@/components/MenuSection";
import FooterSection from "@/components/FooterSection";
import LanguageSelector from "@/components/LanguageSelector";
import BottomNavigation from "@/components/BottomNavigation";
import Cart from "@/components/Cart";
import WhatsAppChat from "@/components/WhatsAppChat";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/contexts/CartContext";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      toast.success('Оплата прошла успешно! / Payment successful!');
      searchParams.delete('payment');
      setSearchParams(searchParams, { replace: true });
    } else if (paymentStatus === 'failed') {
      toast.error('Ошибка оплаты. Попробуйте снова. / Payment failed. Please try again.');
      searchParams.delete('payment');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <LanguageProvider>
      <CartProvider>
        <main className="min-h-screen bg-background pb-20">
          <LanguageSelector />
          <HeroSection />
          <MenuSection />
          <FooterSection />
          <Cart />
          <WhatsAppChat />
          <BottomNavigation />
        </main>
      </CartProvider>
    </LanguageProvider>
  );
};

export default Index;
