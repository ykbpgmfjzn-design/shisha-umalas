import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import HeroSection from "@/components/HeroSection";
import MenuSection from "@/components/MenuSection";
import FooterSection from "@/components/FooterSection";
import LanguageSelector from "@/components/LanguageSelector";
import BottomNavigation from "@/components/BottomNavigation";
import Cart from "@/components/Cart";
import PublicReviews from "@/components/PublicReviews";
import { ValentineBanner } from "@/components/ValentineBanner";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      toast.success('Payment successful!');
      searchParams.delete('payment');
      setSearchParams(searchParams, { replace: true });
    } else if (paymentStatus === 'failed') {
      toast.error('Payment failed. Please try again.');
      searchParams.delete('payment');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <main className="min-h-screen bg-background pb-20">
      <ValentineBanner />
      <LanguageSelector />
      <HeroSection />
      <PublicReviews />
      <MenuSection />
      <FooterSection />
      <Cart />
      <BottomNavigation />
    </main>
  );
};

export default Index;
