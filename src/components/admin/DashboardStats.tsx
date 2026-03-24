import { useState } from "react";
import { motion } from "framer-motion";
import { 
  TrendingUp, Clock, CheckCircle, Calendar,
  DollarSign, Users, Wind, MessageSquare, Star
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DashboardStats as StatsType, PurchaseWithProfile } from "@/hooks/useAdmin";

interface FeedbackItem {
  id: string;
  rating: number;
  message: string | null;
  created_at: string;
  user_name?: string;
  name?: string | null;
}

interface DashboardStatsProps {
  stats: StatsType;
  feedbackCount?: number;
  avgRating?: number;
  allPurchases?: PurchaseWithProfile[];
  allFeedbacks?: FeedbackItem[];
  profiles?: { id: string; full_name: string | null; email: string | null }[];
}

type StatFilter = "total" | "pending" | "paid" | "today" | "totalRevenue" | "todayRevenue" | "hookahs" | "users" | "feedbacks" | "avgRating";

const DashboardStats = ({ stats, feedbackCount = 0, avgRating = 0, allPurchases = [], allFeedbacks = [], profiles = [] }: DashboardStatsProps) => {
  const [activeFilter, setActiveFilter] = useState<StatFilter | null>(null);

  const statCards: {
    label: string;
    value: string | number;
    icon: typeof TrendingUp;
    color: string;
    bgColor: string;
    tooltip: string;
    filter: StatFilter;
  }[] = [
    {
      label: "Total Orders",
      value: stats.totalOrders,
      icon: TrendingUp,
      color: "text-golden",
      bgColor: "bg-golden/10",
      tooltip: "Total number of all orders ever placed",
      filter: "total",
    },
    {
      label: "Pending Payment",
      value: stats.pendingOrders,
      icon: Clock,
      color: "text-orange-400",
      bgColor: "bg-orange-400/10",
      tooltip: "Orders that haven't been paid yet",
      filter: "pending",
    },
    {
      label: "Paid",
      value: stats.completedOrders,
      icon: CheckCircle,
      color: "text-green-400",
      bgColor: "bg-green-400/10",
      tooltip: "Orders with confirmed payment",
      filter: "paid",
    },
    {
      label: "Today",
      value: stats.todayOrders,
      icon: Calendar,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
      tooltip: "Orders placed today",
      filter: "today",
    },
    {
      label: "Total Revenue",
      value: `IDR ${stats.totalRevenue.toLocaleString('id-ID')}`,
      icon: DollarSign,
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
      tooltip: "Sum of all paid orders (all time)",
      filter: "totalRevenue",
    },
    {
      label: "Today Revenue",
      value: `IDR ${stats.todayRevenue.toLocaleString('id-ID')}`,
      icon: DollarSign,
      color: "text-cyan-400",
      bgColor: "bg-cyan-400/10",
      tooltip: "Revenue from today's paid orders",
      filter: "todayRevenue",
    },
    {
      label: "Total Hookahs",
      value: stats.totalHookahs,
      icon: Wind,
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
      tooltip: "Total hookahs ordered across all orders",
      filter: "hookahs",
    },
    {
      label: "Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-pink-400",
      bgColor: "bg-pink-400/10",
      tooltip: "Total registered users",
      filter: "users",
    },
    {
      label: "Feedbacks",
      value: feedbackCount,
      icon: MessageSquare,
      color: "text-amber-400",
      bgColor: "bg-amber-400/10",
      tooltip: "Total feedback/reviews submitted",
      filter: "feedbacks",
    },
    {
      label: "Avg Rating",
      value: avgRating > 0 ? `${avgRating.toFixed(1)} ★` : "—",
      icon: Star,
      color: "text-yellow-400",
      bgColor: "bg-yellow-400/10",
      tooltip: "Average rating across all feedbacks",
      filter: "avgRating",
    },
  ];

  const getFilteredData = (filter: StatFilter) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (filter) {
      case "total":
        return { type: "orders" as const, data: allPurchases, title: "All Orders" };
      case "pending":
        return { type: "orders" as const, data: allPurchases.filter(p => p.payment_status === "pending"), title: "Pending Payment Orders" };
      case "paid":
        return { type: "orders" as const, data: allPurchases.filter(p => p.payment_status?.toLowerCase() === "paid"), title: "Paid Orders" };
      case "today":
        return { type: "orders" as const, data: allPurchases.filter(p => new Date(p.created_at) >= today), title: "Today's Orders" };
      case "totalRevenue":
        return { type: "orders" as const, data: allPurchases.filter(p => p.payment_status?.toLowerCase() === "paid"), title: "Revenue Breakdown (Paid Orders)" };
      case "todayRevenue":
        return { type: "orders" as const, data: allPurchases.filter(p => p.payment_status?.toLowerCase() === "paid" && new Date(p.created_at) >= today), title: "Today's Revenue Breakdown" };
      case "hookahs":
        return { type: "orders" as const, data: allPurchases.filter(p => p.hookah_count > 0), title: "Orders with Hookahs" };
      case "users":
        return { type: "users" as const, data: profiles, title: "Registered Users" };
      case "feedbacks":
        return { type: "feedbacks" as const, data: allFeedbacks, title: "All Feedbacks" };
      case "avgRating":
        return { type: "feedbacks" as const, data: allFeedbacks, title: "Feedback Ratings" };
      default:
        return { type: "orders" as const, data: [], title: "" };
    }
  };

  const activeData = activeFilter ? getFilteredData(activeFilter) : null;

  const getPaymentBadge = (method: string | null) => {
    const map: Record<string, { label: string; className: string }> = {
      cash: { label: "💵 Cash", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
      qris: { label: "📱 QRIS", className: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
      edc: { label: "💳 EDC", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
      bank_transfer: { label: "🏦 Transfer", className: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
      doku: { label: "🔗 DOKU", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
      room_deposit: { label: "🛏️ Deposit", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    };
    const info = map[method || ""] || { label: method || "—", className: "bg-muted text-muted-foreground" };
    return <Badge variant="outline" className={`text-[10px] ${info.className}`}>{info.label}</Badge>;
  };

  const getStatusBadge = (status: string | null) => {
    if (status === "paid") return <Badge variant="outline" className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">Paid</Badge>;
    if (status === "pending") return <Badge variant="outline" className="text-[10px] bg-orange-500/20 text-orange-400 border-orange-500/30">Pending</Badge>;
    return <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">{status || "—"}</Badge>;
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) + " " + date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {statCards.map((stat, index) => (
          <Tooltip key={stat.label}>
            <TooltipTrigger asChild>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-card/60 backdrop-blur-xl rounded-xl border border-border/50 p-3 sm:p-4 cursor-pointer hover:border-primary/40 hover:bg-card/80 transition-all active:scale-[0.97]"
                onClick={() => setActiveFilter(stat.filter)}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-lg sm:text-2xl font-bold truncate">{stat.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</p>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{stat.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Breakdown Sheet */}
      <Sheet open={!!activeFilter} onOpenChange={(open) => !open && setActiveFilter(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0">
          <SheetHeader className="p-4 pb-2 border-b border-border/50">
            <SheetTitle className="text-base">{activeData?.title}</SheetTitle>
            <p className="text-xs text-muted-foreground">
              {activeData?.type === "orders" && `${(activeData.data as PurchaseWithProfile[]).length} orders`}
              {activeData?.type === "users" && `${activeData.data.length} users`}
              {activeData?.type === "feedbacks" && `${activeData.data.length} feedbacks`}
              {activeData?.type === "orders" && (activeFilter === "totalRevenue" || activeFilter === "todayRevenue") && (
                <> · Total: IDR {(activeData.data as PurchaseWithProfile[]).reduce((s, p) => s + (p.amount || 0), 0).toLocaleString("id-ID")}</>
              )}
            </p>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-80px)]">
            <div className="p-3 space-y-2">
              {activeData?.type === "orders" && (activeData.data as PurchaseWithProfile[]).map((order) => (
                <div key={order.id} className="bg-card/60 rounded-lg border border-border/50 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">
                      {order.customer_name || order.profile?.full_name || order.profile?.email || "Walk-in"}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(order.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(order.payment_status)}
                    {getPaymentBadge(order.payment_method)}
                    <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30">
                      {order.hookah_count} hookah{order.hookah_count !== 1 ? "s" : ""}
                    </Badge>
                    {order.delivery_status !== "pending" && (
                      <Badge variant="outline" className={`text-[10px] ${
                        order.delivery_status === "delivered" ? "bg-green-500/10 text-green-400 border-green-500/30" :
                        order.delivery_status === "preparing" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" :
                        order.delivery_status === "cancelled" ? "bg-red-500/10 text-red-400 border-red-500/30" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {order.delivery_status}
                      </Badge>
                    )}
                  </div>
                  {order.amount != null && (
                    <p className="text-sm font-semibold text-golden">
                      IDR {order.amount.toLocaleString("id-ID")}
                    </p>
                  )}
                  {order.notes && (
                    <p className="text-[11px] text-muted-foreground truncate">{order.notes.split("\n---\n")[0]}</p>
                  )}
                </div>
              ))}

              {activeData?.type === "users" && (activeData.data as typeof profiles).map((user) => (
                <div key={user.id} className="bg-card/60 rounded-lg border border-border/50 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{user.full_name || "No name"}</p>
                    <p className="text-xs text-muted-foreground">{user.email || "—"}</p>
                  </div>
                </div>
              ))}

              {activeData?.type === "feedbacks" && (activeData.data as FeedbackItem[]).map((fb) => (
                <div key={fb.id} className="bg-card/60 rounded-lg border border-border/50 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{fb.user_name || fb.name || "Anonymous"}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(fb.created_at)}</span>
                  </div>
                  <p className="text-sm text-yellow-400">{"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}</p>
                  {fb.message && <p className="text-xs text-muted-foreground">{fb.message}</p>}
                </div>
              ))}

              {activeData && activeData.data.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No data</p>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
};

export default DashboardStats;
