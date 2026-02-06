import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Clock, CheckCircle, XCircle, User, MessageSquare, Home, Wind, History, Crown, CreditCard, ChefHat, Truck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

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
  profile: {
    full_name: string | null;
    email: string | null;
    room_number: string | null;
    loyalty_level: number;
  } | null;
}

export default function OrdersList() {
  const { t } = useLanguage();
  const [activeOrders, setActiveOrders] = useState<OrderWithProfile[]>([]);
  const [historyOrders, setHistoryOrders] = useState<OrderWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [now, setNow] = useState(new Date());
  const [deliveryTimeMinutes, setDeliveryTimeMinutes] = useState(15);

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
    // Use theme colors: primary (golden) -> destructive (red)
    if (isOverdue) return { colorClass: "text-destructive", bgClass: "bg-destructive/20", borderClass: "border-destructive" };
    if (percentRemaining > 50) return { colorClass: "text-primary", bgClass: "bg-primary/20", borderClass: "border-primary" };
    if (percentRemaining > 25) return { colorClass: "text-accent", bgClass: "bg-accent/20", borderClass: "border-accent" };
    return { colorClass: "text-destructive", bgClass: "bg-destructive/20", borderClass: "border-destructive" };
  };

  const formatTimer = (createdAt: string) => {
    const { minutes, seconds, isOverdue } = getTimeRemaining(createdAt);
    
    if (isOverdue) {
      return t("shishaMaster.orders.overdue");
    }
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleMarkDelivered = async (orderId: string) => {
    const { error } = await supabase
      .from("purchases")
      .update({ delivery_status: "delivered", paid_at: new Date().toISOString() })
      .eq("id", orderId);

    if (error) {
      toast.error(t("shishaMaster.orders.error"));
      return;
    }

    // Broadcast to Telegram
    supabase.functions.invoke('update-telegram-status', {
      body: { orderId, statusType: 'delivery', newStatus: 'delivered' },
    }).catch(err => console.error('Telegram broadcast failed:', err));

    toast.success(t("shishaMaster.orders.delivered"));
    fetchOrders();
  };

  const handleMarkPreparing = async (orderId: string) => {
    const { error } = await supabase
      .from("purchases")
      .update({ delivery_status: "preparing" })
      .eq("id", orderId);

    if (error) {
      toast.error(t("shishaMaster.orders.error"));
      return;
    }

    // Broadcast to Telegram
    supabase.functions.invoke('update-telegram-status', {
      body: { orderId, statusType: 'delivery', newStatus: 'preparing' },
    }).catch(err => console.error('Telegram broadcast failed:', err));

    toast.success(t("shishaMaster.orders.preparing") || "Order is being prepared");
    fetchOrders();
  };

  const handleMarkPaid = async (orderId: string) => {
    const { error } = await supabase
      .from("purchases")
      .update({ payment_status: "paid" })
      .eq("id", orderId);

    if (error) {
      toast.error(t("shishaMaster.orders.error"));
      return;
    }

    // Broadcast to Telegram
    supabase.functions.invoke('update-telegram-status', {
      body: { orderId, statusType: 'payment', newStatus: 'paid' },
    }).catch(err => console.error('Telegram broadcast failed:', err));

    toast.success(t("shishaMaster.orders.paid") || "Order marked as paid");
    fetchOrders();
  };

  const handleCancelOrder = async () => {
    if (!selectedOrderId) return;

    const { error } = await supabase
      .from("purchases")
      .update({ 
        delivery_status: "cancelled", 
        paid_at: new Date().toISOString(),
        notes: cancelReason ? `${t("shishaMaster.orders.cancelReason")}: ${cancelReason}` : null
      })
      .eq("id", selectedOrderId);

    if (error) {
      toast.error(t("shishaMaster.orders.error"));
      return;
    }

    // Broadcast to Telegram
    supabase.functions.invoke('update-telegram-status', {
      body: { orderId: selectedOrderId, statusType: 'delivery', newStatus: 'cancelled' },
    }).catch(err => console.error('Telegram broadcast failed:', err));

    toast.success(t("shishaMaster.orders.cancelled"));
    setCancelDialogOpen(false);
    setSelectedOrderId(null);
    setCancelReason("");
    fetchOrders();
  };

  const openCancelDialog = (orderId: string) => {
    setSelectedOrderId(orderId);
    setCancelDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const renderActiveOrder = (order: OrderWithProfile) => {
    const { isOverdue, percentRemaining } = getTimeRemaining(order.created_at);
    const { colorClass, bgClass, borderClass } = getTimerStyle(percentRemaining, isOverdue);
    const isUrgent = percentRemaining < 25;
    const orderTime = format(new Date(order.created_at), "HH:mm");
    const loyaltyLevel = order.profile?.loyalty_level || 1;
    const isPaid = order.payment_status?.toLowerCase() === "paid";
    const isPreparing = order.delivery_status === "preparing";
    
    return (
      <motion.div
        key={order.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -100 }}
        layout
      >
        <Card className={`overflow-hidden border-2 ${borderClass} ${isOverdue || isUrgent ? "animate-pulse" : ""}`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              {/* Timer circle */}
              <div className={`w-16 h-16 rounded-full ${bgClass} flex items-center justify-center shrink-0`}>
                <span className={`text-lg font-mono font-bold ${colorClass}`}>
                  {formatTimer(order.created_at)}
                </span>
              </div>
              
              {/* Order info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Wind className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-semibold text-lg">{order.hookah_count}x Hookah</span>
                </div>
                {order.amount && (
                  <p className="text-muted-foreground">Rp {order.amount.toLocaleString()}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{orderTime}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Crown className="h-3.5 w-3.5 text-primary" />
                    <span>Lvl {loyaltyLevel}</span>
                  </div>
                </div>
              </div>
              
              {/* Status badges */}
              <div className="flex flex-col gap-1.5">
                <Badge 
                  variant={isPaid ? "default" : "secondary"}
                  className="flex items-center gap-1"
                >
                  <CreditCard className="h-3 w-3" />
                  {isPaid ? t("admin.paid") : t("admin.pending")}
                </Badge>
                <Badge 
                  variant={isPreparing ? "default" : "outline"}
                  className={`flex items-center gap-1 ${isPreparing ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : ""}`}
                >
                  {isPreparing ? <ChefHat className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                  {isPreparing ? t("shishaMaster.orders.preparing") || "Preparing" : t("shishaMaster.orders.waiting") || "Waiting"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-3">
            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${isOverdue ? "bg-destructive w-full" : percentRemaining > 50 ? "bg-primary" : percentRemaining > 25 ? "bg-accent" : "bg-destructive"}`}
                style={{ width: isOverdue ? "100%" : `${percentRemaining}%` }}
              />
            </div>

            {/* Customer info */}
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{order.profile?.full_name || order.profile?.email || t("admin.guest")}</span>
            </div>
            
            {order.profile?.room_number && (
              <div className="flex items-center gap-2 text-sm p-2 bg-primary/10 rounded-lg border border-primary/20">
                <Home className="h-4 w-4 text-primary" />
                <span className="font-medium text-primary">{t("admin.room")}: {order.profile.room_number}</span>
              </div>
            )}
            
            {order.notes && (
              <div className="flex items-start gap-2 text-sm p-2 bg-muted rounded-lg">
                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-foreground">{order.notes}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              {/* Payment button */}
              {!isPaid && (
                <Button 
                  variant="outline"
                  size="sm"
                  className="h-10"
                  onClick={() => handleMarkPaid(order.id)}
                >
                  <CreditCard className="h-4 w-4 mr-1.5" />
                  {t("shishaMaster.orders.markPaid") || "Mark Paid"}
                </Button>
              )}
              
              {/* Preparing button */}
              {!isPreparing && (
                <Button 
                  variant="outline"
                  size="sm"
                  className="h-10"
                  onClick={() => handleMarkPreparing(order.id)}
                >
                  <ChefHat className="h-4 w-4 mr-1.5" />
                  {t("shishaMaster.orders.startPreparing") || "Start Preparing"}
                </Button>
              )}
              
              {/* Delivered button */}
              <Button 
                className="flex-1 h-10" 
                onClick={() => handleMarkDelivered(order.id)}
              >
                <CheckCircle className="h-4 w-4 mr-1.5" />
                {t("shishaMaster.orders.markDelivered")}
              </Button>
              
              {/* Cancel button */}
              <Button 
                variant="outline" 
                size="icon"
                className="h-10 w-10"
                onClick={() => openCancelDialog(order.id)}
              >
                <XCircle className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const renderHistoryOrder = (order: OrderWithProfile) => {
    const isDelivered = order.delivery_status === "delivered";
    const isPaid = order.payment_status?.toLowerCase() === "paid";
    
    return (
      <Card key={order.id} className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isDelivered ? "bg-primary/10" : "bg-destructive/10"}`}>
                {isDelivered ? (
                  <CheckCircle className="h-5 w-5 text-primary" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
              </div>
              <div>
                <p className="font-medium">
                  {order.profile?.full_name || order.profile?.email || t("admin.guest")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {order.paid_at && format(new Date(order.paid_at), "dd.MM.yyyy HH:mm")}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Badge variant={isPaid ? "default" : "secondary"} className="flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                {isPaid ? t("admin.paid") : t("admin.pending")}
              </Badge>
              <Badge variant={isDelivered ? "default" : "destructive"} className="flex items-center gap-1">
                {isDelivered ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {isDelivered ? t("shishaMaster.orders.statusDelivered") : t("shishaMaster.orders.statusCancelled")}
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t("admin.hookahCount")}: </span>
              <span className="font-medium">{order.hookah_count}</span>
            </div>
            {order.amount && (
              <div>
                <span className="text-muted-foreground">{t("admin.amount")}: </span>
                <span className="font-medium">Rp {order.amount.toLocaleString()}</span>
              </div>
            )}
          </div>
          
          {order.profile?.room_number && (
            <div className="flex items-center gap-2 text-sm">
              <Home className="h-4 w-4 text-muted-foreground" />
              <span>{t("admin.room")}: {order.profile.room_number}</span>
            </div>
          )}
          
          {order.notes && (
            <div className="flex items-start gap-2 text-sm p-2 bg-muted/50 rounded">
              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span>{order.notes}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Wind className="h-4 w-4" />
            {t("shishaMaster.orders.activeOrders")}
            {activeOrders.length > 0 && (
              <Badge variant="secondary" className="ml-1">{activeOrders.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {t("shishaMaster.orders.history")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Wind className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t("shishaMaster.orders.noOrders")}</p>
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence>
              {activeOrders.map(renderActiveOrder)}
            </AnimatePresence>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {historyOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t("shishaMaster.orders.noHistory")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {historyOrders.map(renderHistoryOrder)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("shishaMaster.orders.cancelOrderTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("shishaMaster.orders.cancelOrderDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder={t("shishaMaster.orders.cancelReasonPlaceholder")}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelOrder} className="bg-destructive hover:bg-destructive/90">
              {t("shishaMaster.orders.confirmCancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}