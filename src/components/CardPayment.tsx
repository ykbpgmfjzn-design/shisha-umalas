import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Lock, CheckCircle, XCircle, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

interface CardPaymentProps {
  purchaseId: string;
  amount: number;
  description: string;
  customerName: string;
  customerEmail: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type PaymentStatus = "form" | "processing" | "success" | "failed" | "redirecting";

const CardPayment = ({
  purchaseId,
  amount,
  description,
  customerName,
  customerEmail,
  onSuccess,
  onCancel,
}: CardPaymentProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<PaymentStatus>("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpMonth, setCardExpMonth] = useState("");
  const [cardExpYear, setCardExpYear] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  const getCardType = (number: string) => {
    const num = number.replace(/\s/g, '');
    if (num.startsWith('4')) return 'visa';
    if (/^5[1-5]/.test(num) || /^2[2-7]/.test(num)) return 'mastercard';
    if (/^3[47]/.test(num)) return 'amex';
    if (num.startsWith('35')) return 'jcb';
    return 'unknown';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    if (cleanCardNumber.length < 15) {
      setErrorMessage(t("card.invalidNumber"));
      return;
    }
    if (!cardExpMonth || parseInt(cardExpMonth) < 1 || parseInt(cardExpMonth) > 12) {
      setErrorMessage(t("card.invalidMonth"));
      return;
    }
    if (!cardExpYear || cardExpYear.length < 2) {
      setErrorMessage(t("card.invalidYear"));
      return;
    }
    if (cardCvv.length < 3) {
      setErrorMessage(t("card.invalidCvv"));
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);
    setStatus("processing");

    try {
      const { data, error } = await supabase.functions.invoke('create-card-payment', {
        body: {
          purchaseId,
          amount,
          description,
          customerName,
          customerEmail,
          cardNumber: cleanCardNumber,
          cardExpMonth,
          cardExpYear,
          cardCvv,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Payment failed");
      }

      if (data.requires3DS && data.redirectUrl) {
        // 3DS required - redirect user
        setStatus("redirecting");
        toast({
          title: t("card.redirecting3ds"),
          description: t("card.redirecting3dsDesc"),
        });
        setTimeout(() => {
          window.location.href = data.redirectUrl;
        }, 1500);
        return;
      }

      if (data.paid) {
        setStatus("success");
        setTimeout(onSuccess, 2000);
      } else {
        throw new Error("Payment was not completed");
      }
      
    } catch (error) {
      console.error("Card payment error:", error);
      setErrorMessage(error instanceof Error ? error.message : t("card.paymentFailed"));
      setStatus("failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cardType = getCardType(cardNumber);

  const renderContent = () => {
    switch (status) {
      case "form":
        return (
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {/* Card Number */}
            <div className="space-y-2">
              <Label htmlFor="cardNumber" className="text-foreground">
                {t("card.cardNumber")}
              </Label>
              <div className="relative">
                <Input
                  id="cardNumber"
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  className="pl-12 bg-muted/50 border-border/50"
                  required
                />
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                {cardType !== 'unknown' && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium uppercase text-golden">
                    {cardType}
                  </div>
                )}
              </div>
            </div>

            {/* Expiry and CVV */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="expMonth" className="text-foreground text-sm">
                  {t("card.month")}
                </Label>
                <Input
                  id="expMonth"
                  type="text"
                  value={cardExpMonth}
                  onChange={(e) => setCardExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="MM"
                  maxLength={2}
                  className="bg-muted/50 border-border/50 text-center"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expYear" className="text-foreground text-sm">
                  {t("card.year")}
                </Label>
                <Input
                  id="expYear"
                  type="text"
                  value={cardExpYear}
                  onChange={(e) => setCardExpYear(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="YY"
                  maxLength={2}
                  className="bg-muted/50 border-border/50 text-center"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvv" className="text-foreground text-sm">
                  CVV
                </Label>
                <Input
                  id="cvv"
                  type="password"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="•••"
                  maxLength={4}
                  className="bg-muted/50 border-border/50 text-center"
                  required
                />
              </div>
            </div>

            {/* Error message */}
            {errorMessage && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-destructive text-sm text-center"
              >
                {errorMessage}
              </motion.p>
            )}

            {/* Security note */}
            <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <ShieldCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                {t("card.securityNote")}
              </p>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 h-12 text-lg font-display disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Lock className="w-4 h-4 mr-2" />
              )}
              {isSubmitting ? t("card.processing") : `${t("card.payNow")} IDR ${(amount / 1000).toFixed(0)}K`}
            </Button>
          </motion.form>
        );

      case "processing":
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
            <p className="text-muted-foreground">{t("card.processing")}</p>
          </motion.div>
        );

      case "redirecting":
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
            <p className="text-foreground font-medium mb-2">{t("card.redirecting3ds")}</p>
            <p className="text-muted-foreground text-sm text-center">{t("card.redirecting3dsDesc")}</p>
          </motion.div>
        );

      case "success":
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4"
            >
              <CheckCircle className="w-12 h-12 text-green-500" />
            </motion.div>
            <h3 className="font-display text-2xl text-foreground mb-2">{t("card.success")}</h3>
            <p className="text-muted-foreground">{t("card.successDesc")}</p>
          </motion.div>
        );

      case "failed":
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <div className="w-20 h-20 bg-destructive/20 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-12 h-12 text-destructive" />
            </div>
            <h3 className="font-display text-2xl text-foreground mb-2">{t("card.failed")}</h3>
            <p className="text-muted-foreground mb-2">{t("card.failedDesc")}</p>
            {errorMessage && (
              <p className="text-destructive text-sm mb-4">{errorMessage}</p>
            )}
            <Button onClick={() => { setStatus("form"); setErrorMessage(""); }} className="bg-blue-600 hover:bg-blue-700">
              {t("card.tryAgain")}
            </Button>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card rounded-3xl border border-border/50 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/10 p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/20 rounded-full mb-3">
            <CreditCard className="w-6 h-6 text-blue-500" />
          </div>
          <h2 className="font-display text-2xl text-foreground">{t("card.title")}</h2>
          <p className="text-muted-foreground text-sm mt-1">{t("card.subtitle")}</p>
        </div>

        {/* Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>
        </div>

        {/* Footer - Back button */}
        {(status === "form" || status === "failed") && (
          <div className="px-6 pb-6">
            <Button
              onClick={onCancel}
              variant="outline"
              className="w-full h-12 border-border/50 hover:bg-muted/50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("card.back")}
            </Button>
          </div>
        )}

        {/* Accepted cards */}
        {status === "form" && (
          <div className="px-6 pb-6 pt-0">
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
              <span>VISA</span>
              <span>•</span>
              <span>Mastercard</span>
              <span>•</span>
              <span>JCB</span>
              <span>•</span>
              <span>AMEX</span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default CardPayment;
