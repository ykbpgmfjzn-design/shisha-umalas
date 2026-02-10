import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Clock, CheckCircle, XCircle, User, MessageSquare, Home, Wind, Crown, CreditCard, ChefHat, Pencil, Camera, Loader2, X, CalendarIcon, Filter } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import ManualOrderForm, { type EditOrderData } from "./ManualOrderForm";
import PhotoLightbox from "@/components/PhotoLightbox";

interface OrderWithProfile {
  id: string;
  hookah_count: number;
  amount: number | null;
  notes: string | null;
  payment_status: string | null;
  delivery_status: string;
  created_at: string;
  paid_at: string | null;
  user_id: string;
  customer_name: string | null;
  customer_photo_url: string | null;
  profile: {
    full_name: string | null;
    email: string | null;
    room_number: string | null;
    loyalty_level: number;
  } | null;
}

interface OrdersListProps {
  showHistory?: boolean;
}

export default function OrdersList({ showHistory = false }: OrdersListProps) {
  const { t } = useLanguage();
  const [activeOrders, setActiveOrders] = useState<OrderWithProfile[]>([]);
  const [historyOrders, setHistoryOrders] = useState<OrderWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [now, setNow] = useState(new Date());
  const [deliveryTimeMinutes, setDeliveryTimeMinutes] = useState(15);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const [editingOrder, setEditingOrder] = useState<EditOrderData | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [replacingPhotoOrderId, setReplacingPhotoOrderId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<Date | undefined>(new Date());
  const [deletePhotoOrderId, setDeletePhotoOrderId] = useState<string | null>(null);
  const prevOrdersRef = React.useRef<Map<string, { payment_status: string | null; delivery_status: string }>>(new Map());
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  // Track order changes for highlight effect
  const trackOrderChanges = (orders: OrderWithProfile[]) => {
    const newUpdated = new Set<string>();
    
    orders.forEach(order => {
      const prev = prevOrdersRef.current.get(order.id);
      if (prev && (prev.payment_status !== order.payment_status || prev.delivery_status !== order.delivery_status)) {
        newUpdated.add(order.id);
      }
    });

    if (newUpdated.size > 0) {
      setRecentlyUpdated(prev => new Set([...prev, ...newUpdated]));
      
      // Show toast notification for updated orders
      newUpdated.forEach(id => {
        const order = orders.find(o => o.id === id);
        if (order) {
          const prev = prevOrdersRef.current.get(id);
          const statusChange = prev?.delivery_status !== order.delivery_status 
            ? `${t("history.delivery") || "Delivery"}: ${order.delivery_status}`
            : `${t("history.payment") || "Payment"}: ${order.payment_status}`;
          toast.info(t("shishaMaster.orders.statusUpdated") || "Order updated", {
            description: `${order.hookah_count}x Hookah • ${statusChange}`,
          });
        }
      });
      
      // Clear highlight after 3 seconds
      setTimeout(() => {
        setRecentlyUpdated(prev => {
          const updated = new Set(prev);
          newUpdated.forEach(id => updated.delete(id));
          return updated;
        });
      }, 3000);
    }

    // Update ref with current order states
    const newMap = new Map<string, { payment_status: string | null; delivery_status: string }>();
    orders.forEach(order => {
      newMap.set(order.id, { payment_status: order.payment_status, delivery_status: order.delivery_status });
    });
    prevOrdersRef.current = newMap;
  };

  useEffect(() => {
    fetchSettings();
    fetchOrders();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchases' },
        () => fetchOrders()
      )
      .subscribe();

    // Update timer every second
    const timer = setInterval(() => setNow(new Date()), 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "delivery_time_minutes")
      .maybeSingle();
    
    if (data?.value) {
      setDeliveryTimeMinutes(parseInt(data.value, 10));
    }
  };

  const fetchOrders = async () => {
    // Fetch active orders (not delivered and not cancelled)
    const { data: active, error: activeError } = await supabase
      .from("purchases")
      .select("*")
      .not("delivery_status", "in", '("delivered","cancelled")')
      .order("created_at", { ascending: true });

    // Fetch history (delivered/cancelled) - last 50
    const { data: history, error: historyError } = await supabase
      .from("purchases")
      .select("*")
      .in("delivery_status", ["delivered", "cancelled"])
      .order("paid_at", { ascending: false })
      .limit(50);

    if (activeError || historyError) {
      console.error("Error fetching orders:", activeError || historyError);
      return;
    }

    // Fetch profiles for active orders
    const activeWithProfiles: OrderWithProfile[] = await Promise.all(
      (active || []).map(async (order) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, room_number, loyalty_level")
          .eq("id", order.user_id)
          .maybeSingle();
        return { ...order, profile };
      })
    );

    // Fetch profiles for history orders
    const historyWithProfiles: OrderWithProfile[] = await Promise.all(
      (history || []).map(async (order) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, room_number, loyalty_level")
          .eq("id", order.user_id)
          .maybeSingle();
        return { ...order, profile };
      })
    );

    // Track changes for highlight effect
    trackOrderChanges([...activeWithProfiles, ...historyWithProfiles]);
    
    setActiveOrders(activeWithProfiles);
    setHistoryOrders(historyWithProfiles);
    setLoading(false);
  };

  const getTimeRemaining = (createdAt: string) => {
    const orderTime = new Date(createdAt);
    const deadline = new Date(orderTime.getTime() + deliveryTimeMinutes * 60 * 1000);
    const remaining = deadline.getTime() - now.getTime();
    const total = deliveryTimeMinutes * 60 * 1000;
    
    if (remaining <= 0) return { minutes: 0, seconds: 0, isOverdue: true, percentRemaining: 0 };
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const percentRemaining = (remaining / total) * 100;
    
    return { minutes, seconds, isOverdue: false, percentRemaining };
  };

  const getTimerStyle = (percentRemaining: number, isOverdue: boolean) => {
    if (isOverdue) return { colorClass: "text-destructive", bgClass: "bg-destructive/20" };
    if (percentRemaining > 50) return { colorClass: "text-primary", bgClass: "bg-primary/20" };
    if (percentRemaining > 25) return { colorClass: "text-accent", bgClass: "bg-accent/20" };
    return { colorClass: "text-destructive", bgClass: "bg-destructive/20" };
  };

  const formatTimer = (createdAt: string) => {
    const { minutes, seconds, isOverdue } = getTimeRemaining(createdAt);
    
    if (isOverdue) {
      return t("shishaMaster.orders.overdue") || "OVERDUE";
    }
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleMarkDelivered = async (orderId: string) => {
    const { error } = await supabase
      .from("purchases")
      .update({ delivery_status: "delivered", paid_at: new Date().toISOString() })
      .eq("id", orderId);

    if (error) {
      toast.error(t("shishaMaster.orders.error") || "Error updating order");
      return;
    }

    // Broadcast to Telegram
    supabase.functions.invoke('update-telegram-status', {
      body: { orderId, statusType: 'delivery', newStatus: 'delivered' },
    }).catch(err => console.error('Telegram broadcast failed:', err));

    toast.success(t("shishaMaster.orders.delivered") || "Order delivered");
    fetchOrders();
  };

  const handleMarkPreparing = async (orderId: string) => {
    const { error } = await supabase
      .from("purchases")
      .update({ delivery_status: "preparing" })
      .eq("id", orderId);

    if (error) {
      toast.error(t("shishaMaster.orders.error") || "Error updating order");
      return;
    }

    // Broadcast to Telegram
    supabase.functions.invoke('update-telegram-status', {
      body: { orderId, statusType: 'delivery', newStatus: 'preparing' },
    }).catch(err => console.error('Telegram broadcast failed:', err));

    toast.success(t("shishaMaster.orders.preparingStarted") || "Preparing started");
    fetchOrders();
  };

  const handleMarkPaid = async (orderId: string) => {
    const { error } = await supabase
      .from("purchases")
      .update({ payment_status: "paid" })
      .eq("id", orderId);

    if (error) {
      toast.error(t("shishaMaster.orders.error") || "Error updating order");
      return;
    }

    // Broadcast to Telegram
    supabase.functions.invoke('update-telegram-status', {
      body: { orderId, statusType: 'payment', newStatus: 'paid' },
    }).catch(err => console.error('Telegram broadcast failed:', err));

    toast.success(t("shishaMaster.orders.markedPaid") || "Marked as paid");
    fetchOrders();
  };

  const handleCancelOrder = async () => {
    if (!selectedOrderId) return;

    const { error } = await supabase
      .from("purchases")
      .update({ 
        delivery_status: "cancelled", 
        paid_at: new Date().toISOString(),
        notes: cancelReason ? `${t("shishaMaster.orders.cancelReason") || "Reason"}: ${cancelReason}` : null
      })
      .eq("id", selectedOrderId);

    if (error) {
      toast.error(t("shishaMaster.orders.error") || "Error");
      return;
    }

    // Broadcast to Telegram
    supabase.functions.invoke('update-telegram-status', {
      body: { orderId: selectedOrderId, statusType: 'delivery', newStatus: 'cancelled' },
    }).catch(err => console.error('Telegram broadcast failed:', err));

    toast.success(t("shishaMaster.orders.cancelled") || "Order cancelled");
    setCancelDialogOpen(false);
    setSelectedOrderId(null);
    setCancelReason("");
    fetchOrders();
  };

  const openCancelDialog = (orderId: string) => {
    setSelectedOrderId(orderId);
    setCancelDialogOpen(true);
  };

  const handleReplacePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingPhotoOrderId) return;
    setReplacingPhotoOrderId(prev => prev); // keep loading state
    try {
      const { compressImage } = await import("@/lib/compressImage");
      const compressed = await compressImage(file);
      const fileExt = compressed.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("customer-photos")
        .upload(fileName, compressed);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("customer-photos")
        .getPublicUrl(fileName);
      const { error: updateError } = await supabase
        .from("purchases")
        .update({ customer_photo_url: urlData.publicUrl })
        .eq("id", replacingPhotoOrderId);
      if (updateError) throw updateError;
      toast.success(t("shishaMaster.orders.photoReplaced") || "Photo updated");
      fetchOrders();
    } catch (err: any) {
      console.error("Photo replace error:", err);
      toast.error(err.message || "Upload error");
    } finally {
      setReplacingPhotoOrderId(null);
      if (e.target) e.target.value = "";
    }
  };

  const handleDeletePhoto = async (orderId: string) => {
    const { error } = await supabase
      .from("purchases")
      .update({ customer_photo_url: null })
      .eq("id", orderId);
    if (error) {
      toast.error(t("shishaMaster.orders.error") || "Error");
      return;
    }
    toast.success(t("shishaMaster.orders.photoDeleted") || "Photo removed");
    fetchOrders();
  };

  const openEditSheet = (order: OrderWithProfile) => {
    setEditingOrder({
      id: order.id,
      user_id: order.user_id,
      customer_name: order.customer_name,
      hookah_count: order.hookah_count,
      amount: order.amount,
      notes: order.notes,
      payment_status: order.payment_status,
      delivery_status: order.delivery_status,
      created_at: order.created_at,
    });
    setEditSheetOpen(true);
  };

  const filteredHistoryOrders = useMemo(() => {
    if (!filterDate) return historyOrders;
    return historyOrders.filter((order) => {
      const orderDay = new Date(order.created_at);
      return (
        orderDay.getFullYear() === filterDate.getFullYear() &&
        orderDay.getMonth() === filterDate.getMonth() &&
        orderDay.getDate() === filterDate.getDate()
      );
    });
  }, [historyOrders, filterDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const orders = showHistory ? filteredHistoryOrders : activeOrders;

  // Empty state (only for active orders, history handles its own)
  if (!showHistory && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Wind className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg">{t("shishaMaster.orders.noOrders") || "No active orders"}</p>
      </div>
    );
  }

  // History view - simple cards with date filter
  if (showHistory) {
    return (
      <div className="space-y-3">
        {/* Date filter */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2", filterDate && "border-primary text-primary")}>
                <CalendarIcon className="h-4 w-4" />
                {filterDate ? format(filterDate, "dd.MM.yyyy") : (t("shishaMaster.orders.filterByDate") || "Filter by date")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filterDate}
                onSelect={setFilterDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          {filterDate && (
            <Button variant="ghost" size="sm" onClick={() => setFilterDate(undefined)} className="gap-1 text-muted-foreground">
              <X className="h-3.5 w-3.5" />
              {t("shishaMaster.orders.clearFilter") || "Clear"}
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredHistoryOrders.length} {t("shishaMaster.orders.ordersCount") || "orders"}
          </span>
        </div>

        {filteredHistoryOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Wind className="h-12 w-12 mb-3 opacity-30" />
            <p>{t("shishaMaster.orders.noOrdersForDate") || "No orders for this date"}</p>
          </div>
        ) : (
        <div className="grid gap-3">
        {filteredHistoryOrders.map((order) => {
          const isDelivered = order.delivery_status === "delivered";
          const isPaid = order.payment_status?.toLowerCase() === "paid";
          
          return (
            <Card key={order.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${isDelivered ? "bg-primary/10" : "bg-destructive/10"}`}>
                      {order.customer_photo_url ? (
                        <img src={order.customer_photo_url} alt="" className="h-5 w-5 rounded-full object-cover cursor-pointer" onClick={() => setLightboxPhoto(order.customer_photo_url)} />
                      ) : isDelivered ? (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {order.hookah_count}x Hookah
                        {order.amount && <span className="text-muted-foreground ml-2">• Rp {order.amount.toLocaleString()}</span>}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {order.profile?.full_name || order.profile?.email || order.customer_name || (t("admin.guest") || "Guest")}
                        {order.profile?.room_number && <span> • Room {order.profile.room_number}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="flex gap-1.5 justify-end mb-1">
                        <Badge variant={isPaid ? "default" : "secondary"} className="text-xs">
                          {isPaid ? (t("admin.paid") || "Paid") : (t("admin.pending") || "Pending")}
                        </Badge>
                        <Badge variant={isDelivered ? "default" : "destructive"} className="text-xs">
                          {isDelivered ? (t("history.delivered") || "Delivered") : (t("history.cancelled") || "Cancelled")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {order.paid_at && format(new Date(order.paid_at), "dd.MM.yyyy HH:mm")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => openEditSheet(order)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        </div>
        )}
      </div>
    );
  }

  // Active orders view - detailed cards
  return (
    <>
      <div className="grid gap-4">
        <AnimatePresence>
          {activeOrders.map((order) => {
            const { isOverdue, percentRemaining } = getTimeRemaining(order.created_at);
            const { colorClass, bgClass } = getTimerStyle(percentRemaining, isOverdue);
            const orderTime = format(new Date(order.created_at), "HH:mm");
            const loyaltyLevel = order.profile?.loyalty_level || 1;
            const isPaid = order.payment_status?.toLowerCase() === "paid";
            const isPreparing = order.delivery_status === "preparing";
            const isJustUpdated = recentlyUpdated.has(order.id);
            
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: 1, 
                  y: 0,
                  scale: isJustUpdated ? [1, 1.02, 1] : 1,
                }}
                exit={{ opacity: 0, x: -100 }}
                layout
                transition={{ scale: { duration: 0.3 } }}
              >
                <Card className={`overflow-hidden transition-all duration-300 ${
                  isJustUpdated 
                    ? "ring-2 ring-primary shadow-lg shadow-primary/30" 
                    : ""
                }`}>
                  <CardContent className="p-4 space-y-4">
                    {/* Header row: Timer, Order info, Status badges */}
                    <div className="flex items-start gap-4">
                      {/* Timer */}
                      <div className={`w-14 h-14 rounded-xl ${bgClass} flex items-center justify-center shrink-0`}>
                        <span className={`text-sm font-mono font-bold ${colorClass}`}>
                          {formatTimer(order.created_at)}
                        </span>
                      </div>
                      
                      {/* Order details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Wind className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-semibold">{order.hookah_count}x Hookah</span>
                          {order.amount && (
                            <span className="text-muted-foreground text-sm">• Rp {order.amount.toLocaleString()}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {orderTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <Crown className="h-3 w-3 text-primary" />
                            Lvl {loyaltyLevel}
                          </span>
                        </div>
                      </div>
                      
                      {/* Status badges */}
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <Badge 
                          variant={isPaid ? "default" : "secondary"}
                          className="text-xs justify-center"
                        >
                          {isPaid ? (t("admin.paid") || "Paid") : (t("admin.pending") || "Pending")}
                        </Badge>
                        <Badge 
                          variant="outline"
                          className={`text-xs justify-center ${isPreparing ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : ""}`}
                        >
                          {isPreparing ? (t("shishaMaster.orders.preparing") || "Preparing") : (t("shishaMaster.orders.waiting") || "Waiting")}
                        </Badge>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          isOverdue ? "bg-destructive w-full" : 
                          percentRemaining > 50 ? "bg-primary" : 
                          percentRemaining > 25 ? "bg-accent" : "bg-destructive"
                        }`}
                        style={{ width: isOverdue ? "100%" : `${percentRemaining}%` }}
                      />
                    </div>

                    {/* Customer info */}
                    <div className="flex items-center gap-2 text-sm">
                      {order.customer_photo_url ? (
                        <div className="relative group shrink-0">
                          <img src={order.customer_photo_url} alt="" className="h-8 w-8 rounded-full object-cover border border-border cursor-pointer" onClick={() => setLightboxPhoto(order.customer_photo_url)} />
                          <button
                            className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              setReplacingPhotoOrderId(order.id);
                              photoInputRef.current?.click();
                            }}
                          >
                            {replacingPhotoOrderId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                          </button>
                          <button
                            className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setDeletePhotoOrderId(order.id)}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors"
                          onClick={() => {
                            setReplacingPhotoOrderId(order.id);
                            photoInputRef.current?.click();
                          }}
                        >
                          {replacingPhotoOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4 text-muted-foreground" />}
                        </button>
                      )}
                      <span>{order.profile?.full_name || order.profile?.email || order.customer_name || (t("admin.guest") || "Guest")}</span>
                    </div>
                    
                    {/* Room - highlighted */}
                    {order.profile?.room_number && (
                      <div className="flex items-center gap-2 p-2.5 bg-primary/10 rounded-lg border border-primary/20">
                        <Home className="h-4 w-4 text-primary" />
                        <span className="font-medium text-primary">{t("admin.room") || "Room"}: {order.profile.room_number}</span>
                      </div>
                    )}
                    
                    {/* Notes */}
                    {order.notes && (
                      <div className="flex items-start gap-2 p-2.5 bg-muted rounded-lg">
                        <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-sm">{order.notes}</span>
                      </div>
                    )}

                    {/* Action buttons - compact layout */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {!isPaid && (
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkPaid(order.id)}
                        >
                          <CreditCard className="h-4 w-4 mr-1.5" />
                          {t("shishaMaster.orders.markPaid") || "Mark Paid"}
                        </Button>
                      )}
                      
                      {!isPreparing && (
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkPreparing(order.id)}
                        >
                          <ChefHat className="h-4 w-4 mr-1.5" />
                          {t("shishaMaster.orders.startPreparing") || "Start Preparing"}
                        </Button>
                      )}
                      
                      <Button 
                        size="sm"
                        className="flex-1"
                        onClick={() => handleMarkDelivered(order.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1.5" />
                        {t("shishaMaster.orders.markDelivered") || "Mark Delivered"}
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => openEditSheet(order)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button 
                        variant="outline" 
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => openCancelDialog(order.id)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("shishaMaster.orders.cancelOrderTitle") || "Cancel Order"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("shishaMaster.orders.cancelOrderDesc") || "Please provide a reason for cancelling this order."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder={t("shishaMaster.orders.cancelReasonPlaceholder") || "Enter cancellation reason..."}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel") || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelOrder} className="bg-destructive hover:bg-destructive/90">
              {t("shishaMaster.orders.confirmCancel") || "Confirm Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Photo Confirmation */}
      <AlertDialog open={!!deletePhotoOrderId} onOpenChange={(open) => !open && setDeletePhotoOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("shishaMaster.orders.deletePhotoTitle") || "Delete photo?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("shishaMaster.orders.deletePhotoDesc") || "The customer photo will be permanently removed from this order."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel") || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deletePhotoOrderId) handleDeletePhoto(deletePhotoOrderId);
                setDeletePhotoOrderId(null);
              }}
            >
              {t("shishaMaster.orders.confirmDelete") || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("shishaMaster.form.editOrder") || "Edit Order"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <ManualOrderForm
              editOrder={editingOrder}
              onEditComplete={() => {
                setEditSheetOpen(false);
                setEditingOrder(null);
                fetchOrders();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <PhotoLightbox src={lightboxPhoto} open={!!lightboxPhoto} onOpenChange={(open) => !open && setLightboxPhoto(null)} />

      {/* Hidden file input for photo replacement */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleReplacePhoto}
      />
    </>
  );
}

// Export active orders count hook for parent component
export function useActiveOrdersCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      const { count: orderCount } = await supabase
        .from("purchases")
        .select("*", { count: "exact", head: true })
        .not("delivery_status", "in", '("delivered","cancelled")');
      
      setCount(orderCount || 0);
    };

    fetchCount();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('orders-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchases' },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return count;
}
