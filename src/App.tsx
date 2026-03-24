import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/contexts/CartContext";
import { GlobalVoiceAssistant } from "@/components/GlobalVoiceAssistant";
import WhatsAppChat from "@/components/WhatsAppChat";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Accounting from "./pages/Accounting";
import Expenses from "./pages/Expenses";
import ShishaMaster from "./pages/ShishaMaster";
import OrderConfirmation from "./pages/OrderConfirmation";
import Reservation from "./pages/Reservation";
import OrderHistory from "./pages/OrderHistory";
import Feedback from "./pages/Feedback";
import ActivityLogs from "./pages/ActivityLogs";
import NotFound from "./pages/NotFound";
import Valentine from "./pages/Valentine";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <CartProvider>
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
                <Route path="/valentine" element={<Valentine />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              {/* Global components - visible on all pages */}
              <GlobalVoiceAssistant />
              <WhatsAppChat />
            </BrowserRouter>
          </CartProvider>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
