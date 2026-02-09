import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, Calculator, LogOut, Download,
  TrendingUp, DollarSign, Clock, CheckCircle, XCircle,
  Calendar, Hash, Building2, User, ExternalLink, Filter,
  ChevronDown, ChevronUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReservationsList from "@/components/admin/ReservationsList";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { useLogout } from "@/hooks/useLogout";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";
import type { PurchaseWithProfile, DashboardStats } from "@/hooks/useAdmin";

type StatusFilter = "all" | "pending" | "paid" | "cancelled";

const AccountingContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { logout } = useLogout();
  
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PurchaseWithProfile[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    todayOrders: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    totalHookahs: 0,
    totalUsers: 0,
  });
  
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [updating, setUpdating] = useState<string | null>(null);
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    orderId: string;
    action: "paid" | "cancelled";
  }>({ open: false, orderId: "", action: "paid" });

  // Check access for accounting role
  const checkAccess = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setHasAccess(false);
      setLoading(false);
      return;
    }

    // Check if user has accounting or admin role
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["accounting", "admin"]);

    setHasAccess(!!data && data.length > 0);
    setLoading(false);
  }, []);

  // Fetch all orders
  const fetchOrders = useCallback(async () => {
    const { data: purchases, error } = await supabase
      .from("purchases")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && purchases) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email, full_name, room_number, guest_type");

      const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      const purchasesWithProfiles = purchases.map(p => ({
        ...p,
        profile: profileMap.get(p.user_id) || undefined,
      })) as PurchaseWithProfile[];

      setOrders(purchasesWithProfiles);

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayPurchases = purchasesWithProfiles.filter(
        p => new Date(p.created_at) >= today
      );

      setStats({
        totalOrders: purchasesWithProfiles.length,
        pendingOrders: purchasesWithProfiles.filter(p => p.payment_status === "pending").length,
        completedOrders: purchasesWithProfiles.filter(p => p.payment_status?.toLowerCase() === "paid").length,
        todayOrders: todayPurchases.length,
        totalRevenue: purchasesWithProfiles
          .filter(p => p.payment_status?.toLowerCase() === "paid")
          .reduce((sum, p) => sum + (p.amount || 0), 0),
        todayRevenue: todayPurchases
          .filter(p => p.payment_status?.toLowerCase() === "paid")
          .reduce((sum, p) => sum + (p.amount || 0), 0),
        totalHookahs: purchasesWithProfiles.reduce((sum, p) => sum + p.hookah_count, 0),
        totalUsers: profilesData?.length || 0,
      });
    }
  }, []);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  useEffect(() => {
    if (hasAccess) {
      fetchOrders();
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchOrders, 30000);
      return () => clearInterval(interval);
    }
  }, [hasAccess, fetchOrders]);

  useEffect(() => {
    if (!loading && !hasAccess) {
      toast({
        variant: "destructive",
        title: t("admin.accessDenied"),
        description: t("admin.noPermission"),
      });
      navigate("/");
    }
  }, [hasAccess, loading, navigate, toast, t]);

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
    return new Date(dateStr).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            {t("admin.paid")}
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            {t("admin.cancel")}
          </Badge>
        );
      default:
        return (
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
            <Clock className="w-3 h-3 mr-1" />
            {t("admin.pending")}
          </Badge>
        );
    }
  };

  const handleStatusChange = async () => {
    const { orderId, action } = confirmDialog;
    setConfirmDialog({ ...confirmDialog, open: false });
    setUpdating(orderId);

    const { error } = await supabase
      .from("purchases")
      .update({
        payment_status: action,
        paid_at: action === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", orderId);

    setUpdating(null);

    if (error) {
      toast({
        variant: "destructive",
        title: t("auth.error"),
        description: error.message,
      });
    } else {
      toast({
        title: t("admin.statusUpdated"),
        description: action === "paid" ? t("admin.orderPaid") : t("admin.orderCancelled"),
      });
      fetchOrders();
    }
  };

  const exportToCsv = () => {
    const headers = ["Date", "Order ID", "Customer", "Room", "Hookahs", "Amount (IDR)", "Status"];
    const rows = filteredOrders.map(order => [
      formatDate(order.created_at),
      order.id.slice(0, 8),
      order.profile?.email || "Unknown",
      order.profile?.room_number || "-",
      order.hookah_count,
      order.amount?.toLocaleString('id-ID') || "-",
      order.payment_status || "pending",
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: t("admin.exportCsv"),
      description: `${filteredOrders.length} orders exported`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-2 border-golden/30 border-t-golden rounded-full"
        />
      </div>
    );
  }

  if (!hasAccess) return null;

  const statCards = [
    {
      label: t("admin.totalRevenue"),
      value: `IDR ${stats.totalRevenue.toLocaleString('id-ID')}`,
      icon: DollarSign,
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
    },
    {
      label: t("admin.todayRevenue"),
      value: `IDR ${stats.todayRevenue.toLocaleString('id-ID')}`,
      icon: TrendingUp,
      color: "text-golden",
      bgColor: "bg-golden/10",
    },
    {
      label: t("admin.paid"),
      value: stats.completedOrders,
      icon: CheckCircle,
      color: "text-green-400",
      bgColor: "bg-green-400/10",
    },
    {
      label: t("admin.pending"),
      value: stats.pendingOrders,
      icon: Clock,
      color: "text-orange-400",
      bgColor: "bg-orange-400/10",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("admin.backToHome")}
          </Button>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <div className="flex items-center gap-2 text-blue-400">
              <Calculator className="w-5 h-5" />
              <span className="font-medium hidden sm:inline">{t("admin.accounting")}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{t("admin.logout")}</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-card/60 backdrop-blur-xl rounded-xl border border-border/50 p-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Main Content with Tabs */}
        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-card/60 backdrop-blur-xl">
            <TabsTrigger value="orders" className="gap-2">
              <Hash className="w-4 h-4" />
              {t("admin.allOrders")}
            </TabsTrigger>
            <TabsTrigger value="reservations" className="gap-2">
              <Calendar className="w-4 h-4" />
              {t("admin.reservations")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            {/* Orders Table */}
            <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-6">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <h2 className="font-display text-xl">{t("admin.allOrders")}</h2>
            
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className="w-[140px] bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.filterAll")}</SelectItem>
                    <SelectItem value="pending">{t("admin.filterPending")}</SelectItem>
                    <SelectItem value="paid">{t("admin.filterPaid")}</SelectItem>
                    <SelectItem value="cancelled">{t("admin.filterCancelled")}</SelectItem>
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
                    {t("admin.sortNewest")}
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    {t("admin.sortOldest")}
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={exportToCsv}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                {t("admin.exportCsv")}
              </Button>
            </div>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("admin.noOrders")}</p>
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
                        <span className="font-medium">{order.hookah_count} {t("admin.hookahs")}</span>
                        {order.amount && (
                          <span className="text-golden font-medium">
                            IDR {order.amount.toLocaleString('id-ID')}
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
                          <span>{order.profile.email || "No email"}</span>
                          {order.profile.room_number && (
                            <Badge variant="outline" className="text-xs">
                              {t("admin.room")} {order.profile.room_number}
                            </Badge>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(order.created_at)}
                        </div>
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
                        {order.payment_status?.toLowerCase() !== "paid" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-400 border-green-400/30 hover:bg-green-400/10"
                            disabled={updating === order.id}
                            onClick={() => setConfirmDialog({ open: true, orderId: order.id, action: "paid" })}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {t("admin.markAsPaid")}
                          </Button>
                        )}
                        {order.payment_status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                            disabled={updating === order.id}
                            onClick={() => setConfirmDialog({ open: true, orderId: order.id, action: "cancelled" })}
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            {t("admin.cancel")}
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
          </TabsContent>

          <TabsContent value="reservations">
            <ReservationsList />
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.confirmAction")}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "paid" 
                ? t("admin.confirmPaidMessage")
                : t("admin.confirmCancelMessage")
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleStatusChange}
              className={confirmDialog.action === "paid" 
                ? "bg-green-500 hover:bg-green-600" 
                : "bg-red-500 hover:bg-red-600"
              }
            >
              {t("admin.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Accounting = () => {
  return (
    <LanguageProvider>
      <AccountingContent />
    </LanguageProvider>
  );
};

export default Accounting;