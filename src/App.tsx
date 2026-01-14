import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/contexts/CartContext";
import { GlobalVoiceAssistant } from "@/components/GlobalVoiceAssistant";
import { SplashScreen } from "@/components/SplashScreen";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Accounting from "./pages/Accounting";
import ShishaMaster from "./pages/ShishaMaster";
import OrderConfirmation from "./pages/OrderConfirmation";
import Reservation from "./pages/Reservation";
import OrderHistory from "./pages/OrderHistory";
import Feedback from "./pages/Feedback";
import ActivityLogs from "./pages/ActivityLogs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(() => {
    // Only show splash once per session
    const hasShown = sessionStorage.getItem("splashShown");
    return !hasShown;
  });

  const handleSplashComplete = () => {
    sessionStorage.setItem("splashShown", "true");
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <CartProvider>
            {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/accounting" element={<Accounting />} />
                <Route path="/shisha-master" element={<ShishaMaster />} />
                <Route path="/order-confirmation" element={<OrderConfirmation />} />
                <Route path="/reservation" element={<Reservation />} />
                <Route path="/order-history" element={<OrderHistory />} />
                <Route path="/feedback" element={<Feedback />} />
                <Route path="/activity-logs" element={<ActivityLogs />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              {/* Global Voice Assistant - visible on all pages */}
              <GlobalVoiceAssistant />
            </BrowserRouter>
          </CartProvider>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
