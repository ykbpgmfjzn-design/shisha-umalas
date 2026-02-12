import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

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
import { Clock, CheckCircle, XCircle, User, MessageSquare, Home, Wind, Crown, CreditCard, ChefHat, Pencil, Camera, Loader2, X, UserPlus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import ManualOrderForm, { type EditOrderData } from "./ManualOrderForm";
import PhotoLightbox from "@/components/PhotoLightbox";
import OrdersTable from "@/components/admin/OrdersTable";
import type { PurchaseWithProfile } from "@/hooks/useAdmin";

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
  shisha_master_name: string | null;
  created_by: string | null;
  created_by_name: string | null;
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
  const [deletePhotoOrderId, setDeletePhotoOrderId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch current user and role
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const userRoles = roles?.map(r => r.role) || [];
      setIsAdmin(userRoles.includes("admin") || userRoles.includes("owner"));
    };
    fetchCurrentUser();
  }, []);
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
    // Fetch active and history orders in parallel
    const [activeRes, historyRes] = await Promise.all([
      supabase
        .from("purchases")
        .select("*")
        .not("delivery_status", "in", '("delivered","cancelled")')
        .order("created_at", { ascending: true }),
      supabase
        .from("purchases")
        .select("*")
        .in("delivery_status", ["delivered", "cancelled"])
        .order("paid_at", { ascending: false })
        .limit(50),
    ]);

    if (activeRes.error || historyRes.error) {
      console.error("Error fetching orders:", activeRes.error || historyRes.error);
      setLoading(false);
      return;
    }

    const allOrders = [...(activeRes.data || []), ...(historyRes.data || [])];

    // Batch fetch all needed profiles in one query (including shisha masters)
    const userIds = [...new Set(allOrders.map(o => o.user_id).filter(Boolean))];
    const masterIds = [...new Set(allOrders.map(o => o.shisha_master_id).filter(Boolean))];
    const creatorIds = [...new Set(allOrders.map(o => o.created_by).filter(Boolean))];
    const allProfileIds = [...new Set([...userIds, ...masterIds, ...creatorIds])];
    let profileMap = new Map<string, { full_name: string | null; email: string | null; room_number: string | null; loyalty_level: number }>();
    
    if (allProfileIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, room_number, loyalty_level")
        .in("id", allProfileIds);
      if (profiles) {
        profiles.forEach(p => profileMap.set(p.id, p));
      }
    }

    // Fetch display names from user_roles for staff
    const staffIds = [...new Set([...masterIds, ...creatorIds])];
    let displayNameMap = new Map<string, string>();
    if (staffIds.length > 0) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, display_name")
        .in("user_id", staffIds);
      if (roles) {
        roles.forEach(r => {
          if (r.display_name) displayNameMap.set(r.user_id, r.display_name);
        });
      }
    }

    const getStaffName = (id: string | null) => {
      if (!id) return null;
      return displayNameMap.get(id) || profileMap.get(id)?.full_name || profileMap.get(id)?.email || null;
    };

    const mapOrder = (order: any): OrderWithProfile => ({
      ...order,
      profile: order.user_id ? profileMap.get(order.user_id) || null : null,
      shisha_master_name: getStaffName(order.shisha_master_id),
      created_by_name: getStaffName(order.created_by),
    });

    const activeWithProfiles = (activeRes.data || []).map(mapOrder);
    const historyWithProfiles = (historyRes.data || []).map(mapOrder);

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
      payment_method: (order as any).payment_method || "cash",
      shisha_master_id: (order as any).shisha_master_id || null,
      delivery_status: order.delivery_status,
      created_at: order.created_at,
    });
    setEditSheetOpen(true);
  };

  // Convert history orders to PurchaseWithProfile format for OrdersTable
  const historyAsPurchases: PurchaseWithProfile[] = useMemo(() => {
    return historyOrders.map(order => ({
      ...order,
      discount_applied: null,
      free_drink_used: null,
      free_snack_used: null,
      created_by: null,
      doku_invoice_url: null,
      profile: order.profile ? {
        email: order.profile.email,
        full_name: order.profile.full_name,
        room_number: order.profile.room_number,
        guest_type: "guest" as string,
      } : undefined,
    }));
  }, [historyOrders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const orders = showHistory ? historyOrders : activeOrders;

  // Empty state (only for active orders, history handles its own)
  if (!showHistory && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Wind className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg">{t("shishaMaster.orders.noOrders") || "No active orders"}</p>
      </div>
    );
  }

  // Shared modals/dialogs (must always render)
  const sharedModals = (
    <>
      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("shishaMaster.orders.cancelTitle") || "Cancel order?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("shishaMaster.orders.cancelDesc") || "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder={t("shishaMaster.orders.cancelReasonPlaceholder") || "Reason (optional)"}
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
              isAdmin={isAdmin}
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

  // History view - use shared OrdersTable component (same as admin)
  if (showHistory) {
    const handleHistoryPaymentUpdate = async (id: string, status: string) => {
      await handleMarkPaid(id);
    };
    const handleHistoryDeliveryUpdate = async (id: string, status: string) => {
      if (status === "delivered") await handleMarkDelivered(id);
      else if (status === "preparing") await handleMarkPreparing(id);
      else if (status === "cancelled") {
        setSelectedOrderId(id);
        setCancelDialogOpen(true);
      }
    };
    return (
      <>
        <OrdersTable
          orders={historyAsPurchases}
          onUpdatePaymentStatus={handleHistoryPaymentUpdate}
          onUpdateDeliveryStatus={handleHistoryDeliveryUpdate}
          onOrderEdited={fetchOrders}
          title="All Orders"
        />
        {sharedModals}
      </>
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
                  <CardContent className="p-4 space-y-3">
                    {/* Header row: Timer + Order info + Status */}
                    <div className="flex items-center gap-3">
                      {/* Timer */}
                      <div className={`w-12 h-12 rounded-lg ${bgClass} flex items-center justify-center shrink-0`}>
                        <span className={`text-xs font-mono font-bold ${colorClass}`}>
                          {formatTimer(order.created_at)}
                        </span>
                      </div>
                      
                      {/* Order details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Wind className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-semibold text-sm">{order.hookah_count}x</span>
                          {order.amount && (
                            <span className="text-muted-foreground text-sm">Rp {order.amount.toLocaleString()}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
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
                      <div className="flex flex-col gap-1 shrink-0">
                        <Badge 
                          variant={isPaid ? "default" : "secondary"}
                          className="text-[10px] px-1.5 py-0.5 justify-center"
                        >
                          {isPaid ? (t("admin.paid") || "Paid") : (t("admin.pending") || "Unpaid")}
                        </Badge>
                        <Badge 
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0.5 justify-center ${isPreparing ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : ""}`}
                        >
                          {isPreparing ? (t("shishaMaster.orders.preparing") || "Preparing") : (t("shishaMaster.orders.waiting") || "Waiting")}
                        </Badge>
                        {(order as any).payment_method && !["cash", undefined, null].includes((order as any).payment_method) && (
                          <Badge 
                            variant="outline"
                            className="text-[10px] px-1.5 py-0.5 justify-center"
                          >
                            {(order as any).payment_method === "edc_machine" ? "💳 EDC" 
                              : (order as any).payment_method === "bank_transfer" ? "🏦 Bank"
                              : (order as any).payment_method === "doku" ? "🔗 DOKU"
                              : (order as any).payment_method}
                          </Badge>
                        )}
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
                    <div className="flex items-center gap-2 text-sm truncate">
                      {order.customer_photo_url ? (
                        <div className="relative group shrink-0">
                          <img loading="lazy" src={order.customer_photo_url} alt="" className="h-7 w-7 rounded-full object-cover border border-border cursor-pointer" onClick={() => setLightboxPhoto(order.customer_photo_url)} />
                          <button
                            className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              setReplacingPhotoOrderId(order.id);
                              photoInputRef.current?.click();
                            }}
                          >
                            {replacingPhotoOrderId === order.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Camera className="h-2.5 w-2.5" />}
                          </button>
                          <button
                            className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setDeletePhotoOrderId(order.id)}
                          >
                            <X className="h-2 w-2" />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors"
                          onClick={() => {
                            setReplacingPhotoOrderId(order.id);
                            photoInputRef.current?.click();
                          }}
                        >
                          {replacingPhotoOrderId === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                      )}
                      <span className="truncate text-sm">{order.profile?.full_name || order.profile?.email || order.customer_name || (t("admin.guest") || "Guest")}</span>
                      {order.profile?.room_number && (
                        <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                          <Home className="h-3 w-3 mr-0.5" />
                          {order.profile.room_number}
                        </Badge>
                      )}
                      {order.shisha_master_name && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <ChefHat className="h-3 w-3 text-primary" />
                          {order.shisha_master_name}
                        </span>
                      )}
                      {order.created_by_name && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <UserPlus className="h-3 w-3 text-accent" />
                          {order.created_by_name}
                        </span>
                      )}
                    </div>
                    
                    {/* Notes */}
                    {order.notes && (
                      <div className="flex items-start gap-2 p-2 bg-muted rounded-lg">
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-xs break-all">{order.notes}</span>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-1.5 pt-1">
                      {!isPaid ? (
                        <Button variant="outline" size="sm" className="text-xs px-2" onClick={() => handleMarkPaid(order.id)}>
                          <CreditCard className="h-3.5 w-3.5 mr-1" />
                          Paid
                        </Button>
                      ) : <div />}
                      
                      {!isPreparing ? (
                        <Button variant="outline" size="sm" className="text-xs px-2" onClick={() => handleMarkPreparing(order.id)}>
                          <ChefHat className="h-3.5 w-3.5 mr-1" />
                          Prepare
                        </Button>
                      ) : (
                        <Button size="sm" className="text-xs px-2 col-span-1" onClick={() => handleMarkDelivered(order.id)}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Delivered
                        </Button>
                      )}
                      
                      {(isAdmin || order.created_by === currentUserId) && (
                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => openEditSheet(order)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {(isAdmin || order.created_by === currentUserId) && (
                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => openCancelDialog(order.id)}>
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    {!isPreparing && (
                      <Button size="sm" className="w-full text-xs" onClick={() => handleMarkDelivered(order.id)}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        {t("shishaMaster.orders.markDelivered") || "Mark Delivered"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {sharedModals}
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
