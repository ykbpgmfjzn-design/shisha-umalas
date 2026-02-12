import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import type { LeaderboardOrder } from "./Leaderboard";

interface LeaderboardOrderDetailsProps {
  masterName: string;
  orders: LeaderboardOrder[];
  onBack: () => void;
}

function parseItemNames(notes: string | null): string {
  if (!notes) return "—";
  const itemsPart = notes.split("\n---\n")[0];
  return itemsPart || "—";
}

export default function LeaderboardOrderDetails({
  masterName,
  orders,
  onBack,
}: LeaderboardOrderDetailsProps) {
  const totalRevenue = orders
    .filter((o) => o.payment_status?.toLowerCase() === "paid")
    .reduce((s, o) => s + (Number(o.amount) || 0), 0);

  const paymentStatusColor = (status: string | null) => {
    if (status?.toLowerCase() === "paid") return "bg-green-500/20 text-green-400 border-green-500/30";
    return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  };

  const deliveryStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "preparing": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "cancelled": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-lg truncate">{masterName}</h3>
          <p className="text-xs text-muted-foreground">
            {orders.length} orders · Revenue: IDR {totalRevenue.toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <Card className="bg-card/60 backdrop-blur-xl border-border/50">
          <CardContent className="py-8 text-center text-muted-foreground">
            No orders in this period.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="bg-card/60 backdrop-blur-xl border-border/50">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">
                      {order.customer_name || "Walk-in"}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Clock className="w-3 h-3" />
                      {format(new Date(order.created_at), "dd MMM, HH:mm")}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {parseItemNames(order.notes)}
                  </p>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${paymentStatusColor(order.payment_status)}`}>
                        {order.payment_status || "Unpaid"}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${deliveryStatusColor(order.delivery_status)}`}>
                        {order.delivery_status}
                      </Badge>
                      {order.payment_method && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <CreditCard className="w-3 h-3" />
                          {order.payment_method}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-sm shrink-0">
                      IDR {(Number(order.amount) || 0).toLocaleString("id-ID")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
