import { motion } from "framer-motion";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, Clock, Home, Receipt, ArrowLeft, Building2, AlertCircle, X, PartyPopper, CreditCard, Loader2, Copy, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useRef } from "react";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";
import CardPayment from "@/components/CardPayment";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const OrderConfirmationContent = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const orderId = searchParams.get("id") || "";
  const total = searchParams.get("total") || "0";
  const items = searchParams.get("items") || "";
  const hookahCount = parseInt(searchParams.get("count") || "1");
  
  // Estimate wait time: 10-15 min per hookah, min 15 min
  const estimatedMinutes = Math.max(15, hookahCount * 12);
  
  const [timeLeft, setTimeLeft] = useState(estimatedMinutes * 60);
  const [roomNumber, setRoomNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showCardPayment, setShowCardPayment] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserEmail(session.user.email || null);
        
        const { data } = await supabase
          .from("profiles")
          .select("room_number, full_name")
          .eq("id", session.user.id)
          .maybeSingle();
        
        setRoomNumber(data?.room_number || null);
        setUserName(data?.full_name || null);
      }
      setLoading(false);
    };
    
    fetchProfile();
  }, []);

  // Fetch initial payment status and subscribe to changes
  useEffect(() => {
    if (!orderId) return;

    const fetchPaymentStatus = async () => {
      const { data } = await supabase
        .from("purchases")
        .select("payment_status")
        .eq("id", orderId)
        .maybeSingle();
      
      if (data) {
        setPaymentStatus(data.payment_status);
        setIsPaid(data.payment_status === "paid" || data.payment_status === "delivered");
      }
    };

    fetchPaymentStatus();

    // Subscribe to realtime changes for this purchase
    const channel = supabase
      .channel(`purchase-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'purchases',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const newStatus = payload.new.payment_status;
          setPaymentStatus(newStatus);
          if (newStatus === "paid" || newStatus === "delivered") {
            setIsPaid(true);
            toast({
              title: t("payment.confirmed"),
              description: t("payment.orderStarted"),
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, t, toast]);

  // Timer only starts when payment is confirmed
  useEffect(() => {
    if (!isPaid) return; // Don't start timer until paid
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = Math.max(0, prev - 1);
        if (newTime === 0 && prev !== 0) {
          setIsReady(true);
          playReadySound();
        }
        return newTime;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isPaid]);

  const playReadySound = () => {
    // Create a simple notification sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playTone = (frequency: number, startTime: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    // Play a pleasant chime melody
    const now = audioContext.currentTime;
    playTone(523.25, now, 0.2);        // C5
    playTone(659.25, now + 0.2, 0.2);  // E5
    playTone(783.99, now + 0.4, 0.3);  // G5
  };

  const handleCancelOrder = async () => {
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from("purchases")
        .delete()
        .eq("id", orderId);
      
      if (error) throw error;
      
      toast({
        title: t("order.cancelled"),
        description: t("order.cancelledDesc"),
      });
      
      navigate("/");
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast({
        title: t("order.cancelError"),
        description: t("order.cancelErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };


  const handlePayWithCard = () => {
    if (!orderId || !userEmail) {
      toast({
        title: t("order.paymentError"),
        description: t("order.loginRequired"),
        variant: "destructive",
      });
      return;
    }
    setShowCardPayment(true);
  };

  const handleCardSuccess = () => {
    setShowCardPayment(false);
    toast({
      title: t("card.success"),
      description: t("card.successDesc"),
    });
    window.location.reload();
  };

  const handleCardCancel = () => {
    setShowCardPayment(false);
  };

  const handlePayOnline = async () => {
    if (!orderId || !userEmail) {
      toast({
        title: t("order.paymentError"),
        description: t("order.loginRequired"),
        variant: "destructive",
      });
      return;
    }

    setIsProcessingPayment(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-doku-checkout', {
        body: {
          purchaseId: orderId,
          amount: parseInt(total) * 1000, // Convert back to full amount
          description: items,
          customerName: userName || "Guest",
          customerEmail: userEmail,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Failed to create payment");
      }

      // Redirect to DOKU payment page
      if (data.invoiceUrl) {
        window.location.href = data.invoiceUrl;
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast({
        title: t("order.paymentError"),
        description: error instanceof Error ? error.message : t("order.paymentErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

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
              <div className={`bg-gradient-to-br ${isReady ? 'from-green-500/20 to-emerald-500/10' : 'from-golden/20 to-sunset/10'} p-8 text-center transition-colors duration-500`}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: isReady ? [1, 1.1, 1] : 1 }}
                  transition={isReady ? { repeat: Infinity, duration: 1 } : { delay: 0.2, type: "spring", stiffness: 200 }}
                  className={`inline-flex items-center justify-center w-20 h-20 ${isReady ? 'bg-green-500/20' : 'bg-golden/20'} rounded-full mb-4`}
                >
                  {isReady ? (
                    <PartyPopper className="w-12 h-12 text-green-500" />
                  ) : (
                    <CheckCircle className="w-12 h-12 text-golden" />
                  )}
                </motion.div>
                
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={`font-display text-3xl ${isReady ? 'text-green-500' : 'text-foreground'} mb-2`}
                >
                  {isReady ? t("order.ready") : t("order.confirmed")}
                </motion.h1>
                
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-muted-foreground"
                >
                  {isReady ? t("order.readyDesc") : t("order.thankYou")}
                </motion.p>
              </div>

            {/* Order Details */}
            <div className="p-6 space-y-6">
              {/* Order Number */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border/30">
                <div className="flex items-center gap-3">
                  <Receipt className="w-5 h-5 text-golden" />
                  <span className="text-muted-foreground">{t("order.orderNumber")}</span>
                </div>
                <span className="font-display text-xl text-foreground tracking-wider">
                  #{orderNumber}
                </span>
              </div>

              {/* Wait Time - Only shown after payment */}
              {isPaid ? (
                <div className="p-6 bg-gradient-to-br from-golden/10 to-sunset/5 rounded-xl border border-golden/20">
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
                </div>
              ) : (
                <div className="p-6 bg-gradient-to-br from-amber-500/10 to-orange-500/5 rounded-xl border border-amber-500/20">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                    <span className="text-amber-500 font-medium">{t("payment.awaitingPayment")}</span>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-muted-foreground">
                      {t("payment.timerStartsAfterPayment")}
                    </p>
                  </div>
                </div>
              )}

              {/* Delivery Info */}
              {!loading && (
                <div
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
                </div>
              )}

              {/* Order Summary */}
              <div className="space-y-3">
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
              </div>

              {/* Payment Methods - Unified List */}
              <div className="space-y-4">
                <h3 className="text-sm text-muted-foreground uppercase tracking-wider">
                  {t("payment.methods")}
                </h3>
                
                <div className="space-y-3">
                  {/* Card Payment */}
                  <button
                    onClick={handlePayWithCard}
                    disabled={!userEmail}
                    className="w-full p-4 bg-muted/30 rounded-xl border border-border/30 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <span className="font-medium text-foreground group-hover:text-blue-500 transition-colors">
                          {t("card.payWithCard")}
                        </span>
                        <p className="text-xs text-muted-foreground">Visa, Mastercard, JCB</p>
                      </div>
                    </div>
                  </button>

                  {/* Online Payment - DOKU */}
                  <button
                    onClick={handlePayOnline}
                    disabled={isProcessingPayment || !userEmail}
                    className="w-full p-4 bg-muted/30 rounded-xl border border-border/30 hover:border-golden/50 hover:bg-golden/5 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-golden/20 flex items-center justify-center">
                        {isProcessingPayment ? (
                          <Loader2 className="w-5 h-5 text-golden animate-spin" />
                        ) : (
                          <Building2 className="w-5 h-5 text-golden" />
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-foreground group-hover:text-golden transition-colors">
                          {isProcessingPayment ? t("order.processing") : t("order.payOnline")}
                        </span>
                        <p className="text-xs text-muted-foreground">Virtual Account, E-Wallet</p>
                      </div>
                    </div>
                  </button>

                  {/* Bank Transfer with Details */}
                  <div className="p-4 bg-muted/30 rounded-xl border border-border/30">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{t("payment.bankTransfer")}</span>
                        <p className="text-xs text-muted-foreground">Manual transfer (IDR)</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm pl-13">
                      <div className="flex flex-col gap-1 p-3 bg-background/50 rounded-lg">
                        <span className="text-xs text-muted-foreground">{t("payment.bankName")}</span>
                        <span className="text-foreground font-medium">Bank Mandiri</span>
                      </div>
                      
                      <div className="flex flex-col gap-1 p-3 bg-background/50 rounded-lg">
                        <span className="text-xs text-muted-foreground">{t("payment.accountName")}</span>
                        <span className="text-foreground font-medium text-sm">PT. SAMAHITA UMALAS PRASADA</span>
                      </div>
                      
                      <div className="flex flex-col gap-1 p-3 bg-background/50 rounded-lg">
                        <span className="text-xs text-muted-foreground">{t("payment.accountNumber")}</span>
                        <div className="flex items-center justify-between">
                          <span className="text-golden font-mono font-bold text-lg">1750002625779</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText("1750002625779");
                              toast({
                                title: t("payment.copied"),
                                description: "1750002625779",
                              });
                            }}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                          >
                            <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cash Payment */}
                  <div className="p-4 bg-muted/30 rounded-xl border border-border/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Banknote className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{t("payment.cash")}</span>
                        <p className="text-xs text-muted-foreground">{t("payment.cashDescription")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-4">
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

                {!isReady && (
                  <Button
                    onClick={handleCancelOrder}
                    disabled={isCancelling}
                    variant="ghost"
                    className="w-full text-destructive hover:bg-destructive/10 h-12"
                  >
                    <X className="w-5 h-5 mr-2" />
                    {isCancelling ? t("order.cancelling") : t("order.cancelOrder")}
                  </Button>
                )}
              </div>
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


      {/* Card Payment Modal */}
      {showCardPayment && userEmail && (
        <CardPayment
          purchaseId={orderId}
          amount={parseInt(total) * 1000}
          description={items}
          customerName={userName || "Guest"}
          customerEmail={userEmail}
          onSuccess={handleCardSuccess}
          onCancel={handleCardCancel}
        />
      )}
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
