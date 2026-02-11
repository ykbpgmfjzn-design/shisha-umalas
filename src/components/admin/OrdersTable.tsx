import { useState, useEffect, useRef, useMemo } from "react";
import PhotoLightbox from "@/components/PhotoLightbox";
import { motion } from "framer-motion";
import { 
  Clock, CheckCircle, XCircle, ExternalLink,
  Hash, Calendar as CalendarIcon, Coffee, Cookie, Building2, User,
  ChevronDown, ChevronUp, Filter, Truck, CreditCard, ChefHat, Pencil, CalendarDays, X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import ManualOrderForm, { type EditOrderData } from "@/components/shisha-master/ManualOrderForm";
import type { PurchaseWithProfile } from "@/hooks/useAdmin";

interface OrdersTableProps {
  orders: PurchaseWithProfile[];
  onUpdatePaymentStatus?: (id: string, status: string) => Promise<void>;
  onUpdateDeliveryStatus?: (id: string, status: string) => Promise<void>;
  onUpdateStatus?: (id: string, status: string) => Promise<void>;
  onOrderEdited?: () => void;
  showFilters?: boolean;
  title?: string;
}

type PaymentFilter = "all" | "pending" | "paid" | "unpaid" | "unpaid_delivered";
type DeliveryFilter = "all" | "pending" | "preparing" | "delivered" | "cancelled";

const OrdersTable = ({ 
  orders, 
  onUpdatePaymentStatus,
  onUpdateDeliveryStatus,
  onUpdateStatus,
  onOrderEdited,
  showFilters = true, 
  title = "Orders" 
}: OrdersTableProps) => {
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [updating, setUpdating] = useState<string | null>(null);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<EditOrderData | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const prevOrdersRef = useRef<Map<string, { payment_status: string | null; delivery_status: string }>>(new Map());
  const [masterNames, setMasterNames] = useState<Record<string, string>>({});

  // Fetch shisha master names
  useEffect(() => {
    const masterIds = [...new Set(orders.map(o => (o as any).shisha_master_id).filter(Boolean))];
    if (masterIds.length === 0) return;
    const newIds = masterIds.filter(id => !masterNames[id]);
    if (newIds.length === 0) return;
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", newIds)
      .then(({ data }) => {
        if (data) {
          setMasterNames(prev => {
            const updated = { ...prev };
            data.forEach(p => { updated[p.id] = p.full_name || p.email || "Unknown"; });
            return updated;
          });
        }
      });
  }, [orders]);

  useEffect(() => {
    const newUpdated = new Set<string>();
    
    orders.forEach(order => {
      const prev = prevOrdersRef.current.get(order.id);
      if (prev && (prev.payment_status !== order.payment_status || prev.delivery_status !== order.delivery_status)) {
        newUpdated.add(order.id);
      }
    });

    if (newUpdated.size > 0) {
      setRecentlyUpdated(prev => new Set([...prev, ...newUpdated]));
      
      newUpdated.forEach(id => {
        const order = orders.find(o => o.id === id);
        if (order) {
          const prev = prevOrdersRef.current.get(id);
          const statusChange = prev?.delivery_status !== order.delivery_status 
            ? `Delivery: ${order.delivery_status}`
            : `Payment: ${order.payment_status}`;
          toast.info(`Order updated`, {
            description: `#${order.hookah_count} hookah(s) • ${statusChange}`,
          });
        }
      });
      
      setTimeout(() => {
        setRecentlyUpdated(prev => {
          const updated = new Set(prev);
          newUpdated.forEach(id => updated.delete(id));
          return updated;
        });
      }, 3000);
    }

    const newMap = new Map<string, { payment_status: string | null; delivery_status: string }>();
    orders.forEach(order => {
      newMap.set(order.id, { payment_status: order.payment_status, delivery_status: order.delivery_status });
    });
    prevOrdersRef.current = newMap;
  }, [orders]);

  const filteredOrders = orders
    .filter(order => {
      // Date range filter
      if (dateFrom) {
        const orderDate = new Date(order.created_at);
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (orderDate < fromDate) return false;
      }
      if (dateTo) {
        const orderDate = new Date(order.created_at);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (orderDate > toDate) return false;
      }


      if (paymentFilter === "unpaid_delivered") {
        const isPaid = order.payment_status?.toLowerCase() === "paid";
        return !isPaid && order.delivery_status === "delivered";
      }
      if (paymentFilter !== "all") {
        const isPaid = order.payment_status?.toLowerCase() === "paid";
        if (paymentFilter === "paid" && !isPaid) return false;
        if (paymentFilter === "unpaid" && isPaid) return false;
        if (paymentFilter === "pending" && order.payment_status !== "pending") return false;
      }
      if (deliveryFilter !== "all" && order.delivery_status !== deliveryFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPaymentBadge = (status: string | null) => {
    const isPaid = status?.toLowerCase() === "paid";
    if (isPaid) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          <CreditCard className="w-3 h-3 mr-1" />
          Paid
        </Badge>
      );
    }
    return (
      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
        <Clock className="w-3 h-3 mr-1" />
        Unpaid
      </Badge>
    );
  };

  const getDeliveryBadge = (status: string) => {
    switch (status) {
      case "preparing":
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            <ChefHat className="w-3 h-3 mr-1" />
            Preparing
          </Badge>
        );
      case "delivered":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Delivered
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-muted-foreground border-border">
            <Truck className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const handlePaymentChange = async (orderId: string, newStatus: string) => {
    setUpdating(orderId);
    if (onUpdatePaymentStatus) {
      await onUpdatePaymentStatus(orderId, newStatus);
    } else if (onUpdateStatus) {
      await onUpdateStatus(orderId, newStatus);
    }
    setUpdating(null);
  };

  const handleDeliveryChange = async (orderId: string, newStatus: string) => {
    setUpdating(orderId);
    if (onUpdateDeliveryStatus) {
      await onUpdateDeliveryStatus(orderId, newStatus);
    }
    setUpdating(null);
  };

  const openEditSheet = (order: PurchaseWithProfile) => {
    setEditingOrder({
      id: order.id,
      user_id: order.user_id,
      customer_name: order.customer_name,
      hookah_count: order.hookah_count,
      amount: order.amount,
      notes: order.notes,
      payment_status: order.payment_status,
      payment_method: (order as any).payment_method || "cash",
      shisha_master_id: (order as any).shisha_master_id || null,
      delivery_status: order.delivery_status,
      created_at: order.created_at,
    });
    setEditSheetOpen(true);
  };

  return (
    <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-3">
        <h2 className="font-display text-xl">{title}</h2>
        
        {showFilters && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 bg-background/50 text-xs h-9">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {dateFrom ? format(dateFrom, "dd/MM/yy") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-xs">—</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 bg-background/50 text-xs h-9">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {dateTo ? format(dateTo, "dd/MM/yy") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as PaymentFilter)}>
              <SelectTrigger className="w-[130px] sm:w-[160px] bg-background/50">
                <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="unpaid_delivered">⚠️ Debt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-muted-foreground" />
              <Select value={deliveryFilter} onValueChange={(v) => setDeliveryFilter(v as DeliveryFilter)}>
              <SelectTrigger className="w-[110px] sm:w-[130px] bg-background/50">
                <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="preparing">Preparing</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
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
                  Newest
                </>
              ) : (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Oldest
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
            <p>No orders</p>
          </div>
        ) : (
          filteredOrders.map((order, index) => {
            const isJustUpdated = recentlyUpdated.has(order.id);
            return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ 
                opacity: 1, 
                y: 0,
                scale: isJustUpdated ? [1, 1.02, 1] : 1,
              }}
              transition={{ 
                delay: index * 0.02,
                scale: { duration: 0.3 }
              }}
              className={`p-4 rounded-xl transition-all duration-300 ${
                isJustUpdated 
                  ? "bg-primary/20 ring-2 ring-primary/50 shadow-lg shadow-primary/20" 
                  : "bg-muted/30 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Hash className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{order.hookah_count} hookah(s)</span>
                    {order.amount && (
                      <span className="text-primary font-medium">
                        IDR {order.amount.toLocaleString('id-ID')}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    {order.customer_photo_url && (
                      <img loading="lazy" src={order.customer_photo_url} alt="" className="h-7 w-7 rounded-full object-cover border border-border shrink-0 cursor-pointer" onClick={() => setLightboxPhoto(order.customer_photo_url)} />
                    )}
                    {order.profile ? (
                      <>
                        {!order.customer_photo_url && (
                          order.profile.guest_type === "special" ? (
                            <Building2 className="w-3 h-3 text-primary" />
                          ) : (
                            <User className="w-3 h-3" />
                          )
                        )}
                        <span>{order.profile.full_name || order.profile.email || "No email"}</span>
                        {order.profile.room_number && (
                          <Badge variant="outline" className="text-xs">
                            Room {order.profile.room_number}
                          </Badge>
                        )}
                      </>
                    ) : order.customer_name ? (
                      <>
                        {!order.customer_photo_url && <User className="w-3 h-3" />}
                        <span>{order.customer_name}</span>
                        <Badge variant="outline" className="text-xs">Walk-in</Badge>
                      </>
                    ) : (
                      <>
                        {!order.customer_photo_url && <User className="w-3 h-3 text-muted-foreground" />}
                        <span className="italic">Guest</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {formatDate(order.created_at)}
                    </div>
                    {order.free_drink_used && (
                      <div className="flex items-center gap-1 text-primary">
                        <Coffee className="w-3 h-3" />
                        Drink
                      </div>
                    )}
                    {order.free_snack_used && (
                      <div className="flex items-center gap-1 text-primary">
                        <Cookie className="w-3 h-3" />
                        Snack
                      </div>
                    )}
                  </div>

                  {(order as any).shisha_master_id && masterNames[(order as any).shisha_master_id] && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <ChefHat className="w-3 h-3" />
                      <span>{masterNames[(order as any).shisha_master_id]}</span>
                    </div>
                  )}

                  {order.notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      {order.notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
                  <div className="flex gap-2 flex-wrap">
                    {getPaymentBadge(order.payment_status)}
                    {getDeliveryBadge(order.delivery_status)}
                    {(order as any).payment_method && !["cash", undefined, null].includes((order as any).payment_method) && (
                      <Badge className={
                        (order as any).payment_method === "doku" 
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "bg-violet-500/20 text-violet-400 border-violet-500/30"
                      }>
                        {(order as any).payment_method === "edc_machine" ? "💳 EDC" 
                          : (order as any).payment_method === "bank_transfer" ? "🏦 Transfer"
                          : (order as any).payment_method === "doku" ? "🔗 DOKU"
                          : (order as any).payment_method}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    {order.payment_status?.toLowerCase() !== "paid" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-400 border-green-400/30 hover:bg-green-400/10"
                        disabled={updating === order.id}
                        onClick={() => handlePaymentChange(order.id, "paid")}
                      >
                        <CreditCard className="w-3 h-3 mr-1" />
                        Paid
                      </Button>
                    )}
                    
                    {order.delivery_status === "pending" && onUpdateDeliveryStatus && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10"
                        disabled={updating === order.id}
                        onClick={() => handleDeliveryChange(order.id, "preparing")}
                      >
                        <ChefHat className="w-3 h-3 mr-1" />
                        Prepare
                      </Button>
                    )}
                    
                    {(order.delivery_status === "pending" || order.delivery_status === "preparing") && onUpdateDeliveryStatus && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-400 border-green-400/30 hover:bg-green-400/10"
                        disabled={updating === order.id}
                        onClick={() => handleDeliveryChange(order.id, "delivered")}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Delivered
                      </Button>
                    )}
                    
                    {order.delivery_status !== "delivered" && order.delivery_status !== "cancelled" && onUpdateDeliveryStatus && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                        disabled={updating === order.id}
                        onClick={() => handleDeliveryChange(order.id, "cancelled")}
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Cancel
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
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => openEditSheet(order)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
            );
          })
        )}
      </div>
      <PhotoLightbox src={lightboxPhoto} open={!!lightboxPhoto} onOpenChange={(open) => !open && setLightboxPhoto(null)} />
      
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit Order</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <ManualOrderForm
              editOrder={editingOrder}
              onEditComplete={() => {
                setEditSheetOpen(false);
                setEditingOrder(null);
                onOrderEdited?.();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default OrdersTable;
