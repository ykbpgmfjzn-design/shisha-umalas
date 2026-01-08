import { Building2, Banknote, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface PaymentMethodsProps {
  className?: string;
  compact?: boolean;
}

const PaymentMethods = ({ className = "", compact = false }: PaymentMethodsProps) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const bankDetails = {
    name: "PT. SAMAHITA UMALAS PRASADA",
    bank: "Bank Mandiri",
    account: "1750002625779",
  };

  if (compact) {
    return (
      <div className={`space-y-3 ${className}`}>
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {t("payment.methods")}
        </h4>
        
        <div className="space-y-2">
          {/* Bank Transfer */}
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4 text-golden shrink-0" />
            <span className="text-muted-foreground">{t("payment.bankTransfer")}</span>
          </div>
          
          {/* Cash */}
          <div className="flex items-center gap-2 text-sm">
            <Banknote className="w-4 h-4 text-green-500 shrink-0" />
            <span className="text-muted-foreground">{t("payment.cash")}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-6 ${className}`}
    >
      <h3 className="font-display text-lg text-foreground mb-4 flex items-center gap-2">
        <Banknote className="w-5 h-5 text-golden" />
        {t("payment.methods")}
      </h3>
      
      <div className="space-y-4">
        {/* Bank Transfer */}
        <div className="p-4 bg-muted/30 rounded-xl border border-border/30">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-5 h-5 text-golden" />
            <span className="font-medium text-foreground">{t("payment.bankTransfer")}</span>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("payment.accountName")}:</span>
              <span className="text-foreground font-medium text-right text-xs sm:text-sm">
                {bankDetails.name}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("payment.bankName")}:</span>
              <span className="text-foreground font-medium">{bankDetails.bank}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("payment.accountNumber")}:</span>
              <div className="flex items-center gap-2">
                <span className="text-golden font-mono font-bold">{bankDetails.account}</span>
                <button
                  onClick={() => handleCopy(bankDetails.account, "account")}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title={t("payment.copy")}
                >
                  {copied === "account" ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Cash */}
        <div className="p-4 bg-muted/30 rounded-xl border border-border/30">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-green-500" />
            <span className="font-medium text-foreground">{t("payment.cash")}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {t("payment.cashDescription")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethods;
