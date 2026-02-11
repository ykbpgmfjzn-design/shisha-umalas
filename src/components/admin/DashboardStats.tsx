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
import type { DashboardStats as StatsType } from "@/hooks/useAdmin";

interface DashboardStatsProps {
  stats: StatsType;
  feedbackCount?: number;
  avgRating?: number;
}

const DashboardStats = ({ stats, feedbackCount = 0, avgRating = 0 }: DashboardStatsProps) => {
  const statCards = [
    {
      label: "Total Orders",
      value: stats.totalOrders,
      icon: TrendingUp,
      color: "text-golden",
      bgColor: "bg-golden/10",
      tooltip: "Total number of all orders ever placed",
    },
    {
      label: "Pending Payment",
      value: stats.pendingOrders,
      icon: Clock,
      color: "text-orange-400",
      bgColor: "bg-orange-400/10",
      tooltip: "Orders that haven't been paid yet",
    },
    {
      label: "Paid",
      value: stats.completedOrders,
      icon: CheckCircle,
      color: "text-green-400",
      bgColor: "bg-green-400/10",
      tooltip: "Orders with confirmed payment",
    },
    {
      label: "Today",
      value: stats.todayOrders,
      icon: Calendar,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
      tooltip: "Orders placed today",
    },
    {
      label: "Total Revenue",
      value: `IDR ${stats.totalRevenue.toLocaleString('id-ID')}`,
      icon: DollarSign,
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
      tooltip: "Sum of all paid orders (all time)",
    },
    {
      label: "Today Revenue",
      value: `IDR ${stats.todayRevenue.toLocaleString('id-ID')}`,
      icon: DollarSign,
      color: "text-cyan-400",
      bgColor: "bg-cyan-400/10",
      tooltip: "Revenue from today's paid orders",
    },
    {
      label: "Total Hookahs",
      value: stats.totalHookahs,
      icon: Wind,
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
      tooltip: "Total hookahs ordered across all orders",
    },
    {
      label: "Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-pink-400",
      bgColor: "bg-pink-400/10",
      tooltip: "Total registered users",
    },
    {
      label: "Feedbacks",
      value: feedbackCount,
      icon: MessageSquare,
      color: "text-amber-400",
      bgColor: "bg-amber-400/10",
      tooltip: "Total feedback/reviews submitted",
    },
    {
      label: "Avg Rating",
      value: avgRating > 0 ? `${avgRating.toFixed(1)} ★` : "—",
      icon: Star,
      color: "text-yellow-400",
      bgColor: "bg-yellow-400/10",
      tooltip: "Average rating across all feedbacks",
    },
  ];

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
                className="bg-card/60 backdrop-blur-xl rounded-xl border border-border/50 p-3 sm:p-4 cursor-help"
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
    </TooltipProvider>
  );
};

export default DashboardStats;
