import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Clock, CheckCircle, XCircle, ExternalLink,
  Hash, Calendar, Coffee, Cookie, Shield, Building2, User,
  ChevronDown, ChevronUp, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PurchaseWithProfile } from "@/hooks/useAdmin";

interface OrdersTableProps {
  orders: PurchaseWithProfile[];
  onUpdateStatus: (id: string, status: string) => Promise<void>;
  showFilters?: boolean;
  title?: string;
}

type StatusFilter = "all" | "pending" | "PAID" | "cancelled";

const OrdersTable = ({ orders, onUpdateStatus, showFilters = true, title = "Заказы" }: OrdersTableProps) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [updating, setUpdating] = useState<string | null>(null);

  const filteredOrders = orders
    .filter(order => {
      if (statusFilter === "all") return true;
      return order.payment_status === statusFilter;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "PAID":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Оплачено
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Отменён
          </Badge>
        );
      default:
        return (
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Ожидает
          </Badge>
        );
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdating(orderId);
    await onUpdateStatus(orderId, newStatus);
    setUpdating(null);
  };

  return (
    <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h2 className="font-display text-xl">{title}</h2>
        
        {showFilters && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-[140px] bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="pending">Ожидают</SelectItem>
                  <SelectItem value="PAID">Оплачены</SelectItem>
                  <SelectItem value="cancelled">Отменены</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
              className="gap-1"
            >
              {sortOrder === "desc" ? (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Новые
                </>
              ) : (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Старые
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Нет заказов</p>
          </div>
        ) : (
          filteredOrders.map((order, index) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className="p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                {/* Order Info */}
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <Hash className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{order.hookah_count} кальян(ов)</span>
                    {order.amount && (
                      <span className="text-golden font-medium">
                        {order.amount.toLocaleString()} ₽
                      </span>
                    )}
                  </div>
                  
                  {/* User Info */}
                  {order.profile && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      {order.profile.guest_type === "special" ? (
                        <Building2 className="w-3 h-3 text-golden" />
                      ) : (
                        <User className="w-3 h-3" />
                      )}
                      <span>{order.profile.email || "Без email"}</span>
                      {order.profile.room_number && (
                        <Badge variant="outline" className="text-xs">
                          Комната {order.profile.room_number}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(order.created_at)}
                    </div>
                    {order.free_drink_used && (
                      <div className="flex items-center gap-1 text-golden">
                        <Coffee className="w-3 h-3" />
                        Напиток
                      </div>
                    )}
                    {order.free_snack_used && (
                      <div className="flex items-center gap-1 text-golden">
                        <Cookie className="w-3 h-3" />
                        Снек
                      </div>
                    )}
                  </div>

                  {order.notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      {order.notes}
                    </p>
                  )}
                </div>

                {/* Status & Actions */}
                <div className="flex flex-col items-end gap-2">
                  {getStatusBadge(order.payment_status)}
                  
                  <div className="flex gap-2">
                    {order.payment_status !== "PAID" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-400 border-green-400/30 hover:bg-green-400/10"
                        disabled={updating === order.id}
                        onClick={() => handleStatusChange(order.id, "PAID")}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Оплачено
                      </Button>
                    )}
                    {order.payment_status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                        disabled={updating === order.id}
                        onClick={() => handleStatusChange(order.id, "cancelled")}
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Отмена
                      </Button>
                    )}
                    {order.xendit_invoice_url && (
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                      >
                        <a href={order.xendit_invoice_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default OrdersTable;
