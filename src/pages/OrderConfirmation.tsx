import { motion } from "framer-motion";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, Clock, Home, Receipt, ArrowLeft, Building2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";
import { supabase } from "@/integrations/supabase/client";

const OrderConfirmationContent = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  const orderId = searchParams.get("id") || "";
  const total = searchParams.get("total") || "0";
  const items = searchParams.get("items") || "";
  const hookahCount = parseInt(searchParams.get("count") || "1");
  
  // Estimate wait time: 10-15 min per hookah, min 15 min
  const estimatedMinutes = Math.max(15, hookahCount * 12);
  
  const [timeLeft, setTimeLeft] = useState(estimatedMinutes * 60);
  const [roomNumber, setRoomNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("room_number")
          .eq("id", session.user.id)
          .maybeSingle();
        
        setRoomNumber(data?.room_number || null);
      }
      setLoading(false);
    };
    
    fetchProfile();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const orderNumber = orderId.slice(-6).toUpperCase();

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <LanguageSelector />
      
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-golden/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-sunset/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-golden/5 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Success Card */}
          <div className="bg-card/80 backdrop-blur-xl rounded-3xl border border-border/50 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-br from-golden/20 to-sunset/10 p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="inline-flex items-center justify-center w-20 h-20 bg-golden/20 rounded-full mb-4"
              >
                <CheckCircle className="w-12 h-12 text-golden" />
              </motion.div>
              
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="font-display text-3xl text-foreground mb-2"
              >
                {t("order.confirmed")}
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground"
              >
                {t("order.thankYou")}
              </motion.p>
            </div>

            {/* Order Details */}
            <div className="p-6 space-y-6">
              {/* Order Number */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border/30"
              >
                <div className="flex items-center gap-3">
                  <Receipt className="w-5 h-5 text-golden" />
                  <span className="text-muted-foreground">{t("order.orderNumber")}</span>
                </div>
                <span className="font-display text-xl text-foreground tracking-wider">
                  #{orderNumber}
                </span>
              </motion.div>

              {/* Wait Time */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="p-6 bg-gradient-to-br from-golden/10 to-sunset/5 rounded-xl border border-golden/20"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-5 h-5 text-golden" />
                  <span className="text-muted-foreground">{t("order.estimatedTime")}</span>
                </div>
                
                <div className="text-center">
                  <div className="font-display text-5xl text-golden mb-2">
                    {formatTime(timeLeft)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("order.approx")} {estimatedMinutes} {t("order.minutes")}
                  </p>
                </div>
              </motion.div>

              {/* Delivery Info */}
              {!loading && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.65 }}
                  className={`p-4 rounded-xl border ${
                    roomNumber 
                      ? 'bg-golden/10 border-golden/30' 
                      : 'bg-sunset/10 border-sunset/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {roomNumber ? (
                      <>
                        <Building2 className="w-5 h-5 text-golden mt-0.5" />
                        <div>
                          <p className="text-foreground font-medium">
                            {t("order.deliveryTo")} <span className="text-golden">#{roomNumber}</span>
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {t("order.wrongRoom")}
                          </p>
                          <Button
                            variant="link"
                            onClick={() => navigate("/profile")}
                            className="text-golden p-0 h-auto mt-1"
                          >
                            {t("order.updateRoom")}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5 text-sunset mt-0.5" />
                        <div>
                          <p className="text-foreground font-medium">
                            {t("order.noRoom")}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {t("order.addRoomHint")}
                          </p>
                          <Button
                            variant="link"
                            onClick={() => navigate("/profile")}
                            className="text-sunset p-0 h-auto mt-1"
                          >
                            {t("order.addRoom")}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Order Summary */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                className="space-y-3"
              >
                <h3 className="text-sm text-muted-foreground uppercase tracking-wider">
                  {t("order.summary")}
                </h3>
                <div className="p-4 bg-muted/30 rounded-xl border border-border/30">
                  <p className="text-foreground mb-2 line-clamp-3">{items}</p>
                  <div className="flex justify-between items-center pt-3 border-t border-border/30">
                    <span className="text-muted-foreground">{t("cart.total")}</span>
                    <span className="font-display text-xl text-golden">IDR {total}K</span>
                  </div>
                </div>
              </motion.div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="space-y-3 pt-4"
              >
                <Button
                  onClick={() => navigate("/")}
                  className="w-full bg-golden hover:bg-golden/90 text-background h-12"
                >
                  <Home className="w-5 h-5 mr-2" />
                  {t("order.backToMenu")}
                </Button>
                
                <Button
                  onClick={() => navigate("/profile")}
                  variant="outline"
                  className="w-full border-golden/30 hover:bg-golden/10 h-12"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  {t("order.viewProfile")}
                </Button>
              </motion.div>
            </div>
          </div>

          {/* Footer note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-center text-sm text-muted-foreground mt-6"
          >
            {t("order.notification")}
          </motion.p>
        </motion.div>
      </div>
    </main>
  );
};

const OrderConfirmation = () => {
  return (
    <LanguageProvider>
      <OrderConfirmationContent />
    </LanguageProvider>
  );
};

export default OrderConfirmation;
