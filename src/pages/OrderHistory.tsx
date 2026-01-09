import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Package, CheckCircle, XCircle, CreditCard, Truck } from "lucide-react";
import { format } from "date-fns";
import LanguageSelector from "@/components/LanguageSelector";
import BottomNavigation from "@/components/BottomNavigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import heroBackground from "@/assets/rooftop-shisha-bg.jpg";

interface Order {
  id: string;
  created_at: string;
  hookah_count: number;
  amount: number | null;
  payment_status: string | null;
  notes: string | null;
  paid_at: string | null;
}

const OrderHistory = () => {
  const { t } = useLanguage();
  const { user } = useProfile();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("purchases")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  };

  const getStatusConfig = (status: string | null) => {
    switch (status) {
      case "paid":
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          text: t("history.paid"),
          className: "bg-green-500/20 text-green-400 border-green-500/30"
        };
      case "delivered":
        return {
          icon: <Truck className="w-4 h-4" />,
          text: t("history.delivered"),
          className: "bg-blue-500/20 text-blue-400 border-blue-500/30"
        };
      case "cancelled":
        return {
          icon: <XCircle className="w-4 h-4" />,
          text: t("history.cancelled"),
          className: "bg-red-500/20 text-red-400 border-red-500/30"
        };
      case "failed":
        return {
          icon: <XCircle className="w-4 h-4" />,
          text: t("history.failed"),
          className: "bg-red-500/20 text-red-400 border-red-500/30"
        };
      default:
        return {
          icon: <Clock className="w-4 h-4" />,
          text: t("history.pending"),
          className: "bg-golden/20 text-golden border-golden/30"
        };
    }
  };

  return (
    <main
      className="min-h-screen bg-background pb-24 relative"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(20, 15, 10, 0.85), rgba(20, 15, 10, 0.95)), url(${heroBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <LanguageSelector />

      <div className="pt-24 px-4 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl text-golden mb-2">
              {t("history.title")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("history.subtitle")}
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-golden border-t-transparent rounded-full animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{t("history.noOrders")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order, index) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-card/50 backdrop-blur-sm border border-border/30 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), "MMM d, yyyy • HH:mm")}
                      </p>
                      <p className="font-medium text-foreground mt-1">
                        {order.hookah_count} {t("history.hookahs")}
                      </p>
                    </div>
                    {(() => {
                      const config = getStatusConfig(order.payment_status);
                      return (
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${config.className}`}>
                          {config.icon}
                          <span>{config.text}</span>
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    {order.amount && (
                      <p className="text-golden font-display text-lg">
                        IDR {(order.amount / 1000).toFixed(0)}K
                      </p>
                    )}
                    {order.paid_at && (
                      <p className="text-xs text-green-400 flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        {format(new Date(order.paid_at), "MMM d, HH:mm")}
                      </p>
                    )}
                  </div>
                  
                  {order.notes && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {order.notes}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <BottomNavigation />
    </main>
  );
};

export default OrderHistory;
