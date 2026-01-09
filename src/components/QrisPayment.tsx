import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, Clock, CheckCircle, XCircle, Loader2, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import QRCode from "react-qr-code";

interface QrisPaymentProps {
  purchaseId: string;
  amount: number;
  description: string;
  customerName: string;
  customerEmail: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type PaymentStatus = "idle" | "loading" | "showing_qr" | "checking" | "success" | "failed" | "expired";

const QrisPayment = ({
  purchaseId,
  amount,
  description,
  customerName,
  customerEmail,
  onSuccess,
  onCancel,
}: QrisPaymentProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [qrContent, setQrContent] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const generateQris = useCallback(async () => {
    setStatus("loading");
    
    try {
      const { data, error } = await supabase.functions.invoke('create-qris-payment', {
        body: {
          purchaseId,
          amount,
          description,
          customerName,
          customerEmail,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Failed to generate QRIS");
      }

      setQrContent(data.qrContent);
      setInvoiceNumber(data.invoiceNumber);
      setExpiresAt(new Date(data.expiresAt));
      setStatus("showing_qr");
      
    } catch (error) {
      console.error("QRIS generation error:", error);
      toast({
        title: t("order.paymentError"),
        description: error instanceof Error ? error.message : t("order.paymentErrorDesc"),
        variant: "destructive",
      });
      setStatus("failed");
    }
  }, [purchaseId, amount, description, customerName, customerEmail, toast, t]);

  const checkPaymentStatus = useCallback(async () => {
    if (!invoiceNumber) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('check-qris-status', {
        body: {
          invoiceNumber,
          purchaseId,
        },
      });

      if (error) {
        console.error("Status check error:", error);
        return;
      }

      if (data?.status === "paid") {
        setStatus("success");
        setTimeout(onSuccess, 2000);
      } else if (data?.status === "failed") {
        setStatus("failed");
      }
    } catch (error) {
      console.error("Status check error:", error);
    }
  }, [invoiceNumber, purchaseId, onSuccess]);

  // Auto-generate QRIS on mount
  useEffect(() => {
    generateQris();
  }, [generateQris]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || status !== "showing_qr") return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      setTimeLeft(diff);
      
      if (diff === 0) {
        setStatus("expired");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, status]);

  // Poll payment status every 5 seconds
  useEffect(() => {
    if (status !== "showing_qr") return;

    const interval = setInterval(checkPaymentStatus, 5000);
    return () => clearInterval(interval);
  }, [status, checkPaymentStatus]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderContent = () => {
    switch (status) {
      case "loading":
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <Loader2 className="w-16 h-16 text-golden animate-spin mb-4" />
            <p className="text-muted-foreground">{t("qris.generating")}</p>
          </motion.div>
        );

      case "showing_qr":
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center"
          >
            {/* Timer */}
            <div className="flex items-center gap-2 mb-4 px-4 py-2 bg-golden/10 rounded-full border border-golden/30">
              <Clock className="w-4 h-4 text-golden" />
              <span className="text-golden font-mono font-bold">{formatTime(timeLeft)}</span>
            </div>

            {/* QR Code */}
            <div className="bg-white p-4 rounded-2xl shadow-lg mb-6">
              {qrContent && (
                <QRCode
                  value={qrContent}
                  size={220}
                  level="H"
                  className="rounded-lg"
                />
              )}
            </div>

            {/* Amount */}
            <div className="text-center mb-4">
              <p className="text-muted-foreground text-sm mb-1">{t("qris.amountToPay")}</p>
              <p className="font-display text-3xl text-golden">
                IDR {(amount / 1000).toFixed(0)}K
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-muted/50 rounded-xl p-4 w-full max-w-sm">
              <div className="flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-golden mt-0.5 flex-shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">{t("qris.scanInstructions")}</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>{t("qris.step1")}</li>
                    <li>{t("qris.step2")}</li>
                    <li>{t("qris.step3")}</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Manual check button */}
            <Button
              onClick={checkPaymentStatus}
              variant="outline"
              className="mt-4 border-golden/30"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {t("qris.checkStatus")}
            </Button>
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
            <h3 className="font-display text-2xl text-foreground mb-2">{t("qris.success")}</h3>
            <p className="text-muted-foreground">{t("qris.successDesc")}</p>
          </motion.div>
        );

      case "failed":
      case "expired":
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <div className="w-20 h-20 bg-destructive/20 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-12 h-12 text-destructive" />
            </div>
            <h3 className="font-display text-2xl text-foreground mb-2">
              {status === "expired" ? t("qris.expired") : t("qris.failed")}
            </h3>
            <p className="text-muted-foreground mb-6">
              {status === "expired" ? t("qris.expiredDesc") : t("qris.failedDesc")}
            </p>
            <Button onClick={generateQris} className="bg-golden hover:bg-golden/90">
              <RefreshCw className="w-4 h-4 mr-2" />
              {t("qris.tryAgain")}
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
        <div className="bg-gradient-to-br from-golden/20 to-sunset/10 p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-golden/20 rounded-full mb-3">
            <QrCode className="w-6 h-6 text-golden" />
          </div>
          <h2 className="font-display text-2xl text-foreground">{t("qris.title")}</h2>
          <p className="text-muted-foreground text-sm mt-1">{t("qris.subtitle")}</p>
        </div>

        {/* Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {status !== "success" && (
          <div className="px-6 pb-6">
            <Button
              onClick={onCancel}
              variant="ghost"
              className="w-full text-muted-foreground"
            >
              {t("qris.cancel")}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default QrisPayment;
