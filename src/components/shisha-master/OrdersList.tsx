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
import { Clock, CheckCircle, XCircle, User, MessageSquare, Home, Wind, History } from "lucide-react";
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
  created_at: string;
  paid_at: string | null;
  user_id: string;
  profile: {
    full_name: string | null;
    email: string | null;
    room_number: string | null;
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
    // Fetch active orders
    const { data: active, error: activeError } = await supabase
      .from("purchases")
      .select("*")
      .in("payment_status", ["pending", "paid"])
      .order("created_at", { ascending: true });

    // Fetch history (delivered/cancelled) - last 50
    const { data: history, error: historyError } = await supabase
      .from("purchases")
      .select("*")
      .in("payment_status", ["delivered", "cancelled"])
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
          .select("full_name, email, room_number")
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
          .select("full_name, email, room_number")
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

  const getTimerColor = (percentRemaining: number): string => {
    // Green -> Yellow -> Orange -> Red gradient based on time remaining
    if (percentRemaining > 66) return "hsl(142, 76%, 45%)"; // Green
    if (percentRemaining > 33) return "hsl(45, 100%, 50%)"; // Yellow/Orange
    if (percentRemaining > 15) return "hsl(25, 100%, 50%)"; // Orange
    return "hsl(0, 90%, 55%)"; // Red
  };

  const getTimerBgColor = (percentRemaining: number): string => {
    if (percentRemaining > 66) return "hsl(142, 76%, 45%, 0.15)";
    if (percentRemaining > 33) return "hsl(45, 100%, 50%, 0.15)";
    if (percentRemaining > 15) return "hsl(25, 100%, 50%, 0.15)";
    return "hsl(0, 90%, 55%, 0.15)";
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
      .update({ payment_status: "delivered", paid_at: new Date().toISOString() })
      .eq("id", orderId);

    if (error) {
      toast.error(t("shishaMaster.orders.error"));
      return;
    }

    toast.success(t("shishaMaster.orders.delivered"));
    fetchOrders();
  };

  const handleCancelOrder = async () => {
    if (!selectedOrderId) return;

    const { error } = await supabase
      .from("purchases")
      .update({ 
        payment_status: "cancelled", 
        paid_at: new Date().toISOString(),
        notes: cancelReason ? `${t("shishaMaster.orders.cancelReason")}: ${cancelReason}` : null
      })
      .eq("id", selectedOrderId);

    if (error) {
      toast.error(t("shishaMaster.orders.error"));
      return;
    }

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
    const timerColor = isOverdue ? "hsl(0, 90%, 55%)" : getTimerColor(percentRemaining);
    const timerBgColor = isOverdue ? "hsl(0, 90%, 55%, 0.15)" : getTimerBgColor(percentRemaining);
    const isUrgent = percentRemaining < 33;
    
    return (
      <motion.div
        key={order.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -100 }}
        layout
      >
        <Card 
          className={`overflow-hidden transition-all duration-300 ${isOverdue ? "ring-2 ring-destructive" : isUrgent ? "ring-2" : ""}`}
          style={{ 
            borderColor: timerColor,
            ...(isUrgent && !isOverdue ? { ringColor: timerColor } : {})
          }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {/* Animated circular progress timer */}
                <div className="relative">
                  <motion.div
                    className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: timerBgColor }}
                    animate={isUrgent || isOverdue ? { 
                      scale: [1, 1.05, 1],
                    } : {}}
                    transition={{ 
                      duration: isOverdue ? 0.5 : 1,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <svg className="absolute w-20 h-20 -rotate-90">
                      <circle
                        cx="40"
                        cy="40"
                        r="36"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="text-muted/20"
                      />
                      <motion.circle
                        cx="40"
                        cy="40"
                        r="36"
                        fill="none"
                        stroke={timerColor}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={226}
                        strokeDashoffset={226 - (226 * (isOverdue ? 0 : percentRemaining)) / 100}
                        style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
                      />
                    </svg>
                    <div className="text-center z-10">
                      <motion.span 
                        className="text-xl font-mono font-bold block"
                        style={{ color: timerColor }}
                        animate={isUrgent || isOverdue ? { opacity: [1, 0.6, 1] } : {}}
                        transition={{ duration: isOverdue ? 0.5 : 1, repeat: Infinity }}
                      >
                        {formatTimer(order.created_at)}
                      </motion.span>
                    </div>
                  </motion.div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {t("shishaMaster.orders.timeRemaining")}
                  </p>
                  <div className="flex items-center gap-2">
                    <Wind className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-lg">{order.hookah_count}x Hookah</span>
                  </div>
                  {order.amount && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Rp {order.amount.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <Badge variant={order.payment_status === "paid" ? "default" : "secondary"}>
                {order.payment_status === "paid" ? t("admin.paid") : t("admin.pending")}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-muted/30 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ 
                  backgroundColor: timerColor,
                  width: `${isOverdue ? 100 : percentRemaining}%`
                }}
                animate={isUrgent || isOverdue ? { opacity: [1, 0.7, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{order.profile?.full_name || order.profile?.email || t("admin.guest")}</span>
              </div>
              
              {order.profile?.room_number && (
                <div className="flex items-center gap-2 text-sm p-2 bg-primary/10 rounded-lg">
                  <Home className="h-4 w-4 text-primary" />
                  <span className="font-bold text-primary">{t("admin.room")}: {order.profile.room_number}</span>
                </div>
              )}
              
              {order.notes && (
                <div className="flex items-start gap-2 text-sm p-3 bg-accent/50 rounded-lg">
                  <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span>{order.notes}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                className="flex-1 h-12 text-base font-semibold" 
                onClick={() => handleMarkDelivered(order.id)}
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                {t("shishaMaster.orders.markDelivered")}
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                className="h-12 w-12"
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
    const isDelivered = order.payment_status === "delivered";
    
    return (
      <Card key={order.id} className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isDelivered ? "bg-green-500/10" : "bg-destructive/10"}`}>
                {isDelivered ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
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
            <Badge variant={isDelivered ? "default" : "destructive"}>
              {isDelivered ? t("shishaMaster.orders.statusDelivered") : t("shishaMaster.orders.statusCancelled")}
            </Badge>
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