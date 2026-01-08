import { motion } from "framer-motion";
import { 
  TrendingUp, Clock, CheckCircle, Calendar,
  DollarSign, Users, Wind, MessageSquare, Star
} from "lucide-react";
import type { DashboardStats as StatsType } from "@/hooks/useAdmin";

interface DashboardStatsProps {
  stats: StatsType;
  feedbackCount?: number;
  avgRating?: number;
}

const DashboardStats = ({ stats, feedbackCount = 0, avgRating = 0 }: DashboardStatsProps) => {
  const statCards = [
    {
      label: "Всего заказов",
      value: stats.totalOrders,
      icon: TrendingUp,
      color: "text-golden",
      bgColor: "bg-golden/10",
    },
    {
      label: "Ожидают оплаты",
      value: stats.pendingOrders,
      icon: Clock,
      color: "text-orange-400",
      bgColor: "bg-orange-400/10",
    },
    {
      label: "Оплачено",
      value: stats.completedOrders,
      icon: CheckCircle,
      color: "text-green-400",
      bgColor: "bg-green-400/10",
    },
    {
      label: "Сегодня",
      value: stats.todayOrders,
      icon: Calendar,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
    },
    {
      label: "Общая выручка",
      value: `IDR ${stats.totalRevenue.toLocaleString('id-ID')}`,
      icon: DollarSign,
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
    },
    {
      label: "Выручка сегодня",
      value: `IDR ${stats.todayRevenue.toLocaleString('id-ID')}`,
      icon: DollarSign,
      color: "text-cyan-400",
      bgColor: "bg-cyan-400/10",
    },
    {
      label: "Всего кальянов",
      value: stats.totalHookahs,
      icon: Wind,
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
    },
    {
      label: "Пользователей",
      value: stats.totalUsers,
      icon: Users,
      color: "text-pink-400",
      bgColor: "bg-pink-400/10",
    },
    {
      label: "Отзывов",
      value: feedbackCount,
      icon: MessageSquare,
      color: "text-amber-400",
      bgColor: "bg-amber-400/10",
    },
    {
      label: "Средний рейтинг",
      value: avgRating > 0 ? `${avgRating.toFixed(1)} ★` : "—",
      icon: Star,
      color: "text-yellow-400",
      bgColor: "bg-yellow-400/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
  );
};

export default DashboardStats;
