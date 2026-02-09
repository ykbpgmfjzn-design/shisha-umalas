import { useMemo, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart,
  Star, Percent, Heart, BarChart3, ArrowUpRight, ArrowDownRight, Minus,
  Plus, Trash2, Settings2, Save, X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, LineChart, Line } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseWithProfile } from "@/hooks/useAdmin";

interface FeedbackItem {
  id: string;
  rating: number;
  created_at: string;
}

interface MonthlyExpense {
  id: string;
  name: string;
  amount: number;
}

interface BusinessMetricsProps {
  purchases: PurchaseWithProfile[];
  feedbacks: FeedbackItem[];
  totalUsers: number;
}

// Helper: group by period key
function groupByPeriod(items: { created_at: string }[], mode: "day" | "week" | "month") {
  const map = new Map<string, typeof items>();
  for (const item of items) {
    const d = new Date(item.created_at);
    let key: string;
    if (mode === "day") {
      key = d.toISOString().slice(0, 10);
    } else if (mode === "week") {
      const start = new Date(d);
      start.setDate(start.getDate() - start.getDay());
      key = start.toISOString().slice(0, 10);
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

function paidOnly(purchases: PurchaseWithProfile[]) {
  return purchases.filter(p => p.payment_status?.toLowerCase() === "paid");
}

export default function BusinessMetrics({ purchases, feedbacks, totalUsers }: BusinessMetricsProps) {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editExpenses, setEditExpenses] = useState<MonthlyExpense[]>([]);
  const [savingExpenses, setSavingExpenses] = useState(false);

  // Load expenses from app_settings
  const loadExpenses = useCallback(async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "monthly_expenses")
      .maybeSingle();
    if (data?.value) {
      try {
        setExpenses(JSON.parse(data.value));
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const totalMonthlyExpenses = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);

  const saveExpenses = async () => {
    setSavingExpenses(true);
    const value = JSON.stringify(editExpenses.filter(e => e.name.trim() && e.amount > 0));
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "monthly_expenses", value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSavingExpenses(false);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Expenses saved" });
      setExpenses(JSON.parse(value));
      setShowExpenseDialog(false);
    }
  };

  const addExpenseRow = () => {
    setEditExpenses([...editExpenses, { id: crypto.randomUUID(), name: "", amount: 0 }]);
  };

  const removeExpenseRow = (id: string) => {
    setEditExpenses(editExpenses.filter(e => e.id !== id));
  };
  const metrics = useMemo(() => {
    const paid = paidOnly(purchases);
    const now = new Date();

    // --- Revenue Growth Rate (week-over-week) ---
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeekRev = paid
      .filter(p => new Date(p.created_at) >= thisWeekStart)
      .reduce((s, p) => s + (p.amount || 0), 0);
    const lastWeekRev = paid
      .filter(p => {
        const d = new Date(p.created_at);
        return d >= lastWeekStart && d < thisWeekStart;
      })
      .reduce((s, p) => s + (p.amount || 0), 0);

    const weekGrowth = lastWeekRev > 0
      ? ((thisWeekRev - lastWeekRev) / lastWeekRev) * 100
      : thisWeekRev > 0 ? 100 : 0;

    // --- Month-over-month ---
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const thisMonthRev = paid
      .filter(p => new Date(p.created_at) >= thisMonthStart)
      .reduce((s, p) => s + (p.amount || 0), 0);
    const lastMonthRev = paid
      .filter(p => {
        const d = new Date(p.created_at);
        return d >= lastMonthStart && d < thisMonthStart;
      })
      .reduce((s, p) => s + (p.amount || 0), 0);

    const monthGrowth = lastMonthRev > 0
      ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100
      : thisMonthRev > 0 ? 100 : 0;

    // --- Average Revenue Per Customer ---
    const uniquePaidCustomers = new Set(paid.map(p => p.user_id)).size;
    const totalRevenue = paid.reduce((s, p) => s + (p.amount || 0), 0);
    const avgRevenuePerCustomer = uniquePaidCustomers > 0 ? totalRevenue / uniquePaidCustomers : 0;

    // --- Avg check (per order) ---
    const avgCheck = paid.length > 0 ? totalRevenue / paid.length : 0;

    // --- Repeat Customer Rate ---
    const customerOrderCount = new Map<string, number>();
    for (const p of purchases) {
      customerOrderCount.set(p.user_id, (customerOrderCount.get(p.user_id) || 0) + 1);
    }
    const totalCustomers = customerOrderCount.size;
    const repeatCustomers = [...customerOrderCount.values()].filter(c => c > 1).length;
    const repeatRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

    // --- Orders per Day/Week/Month ---
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = purchases.filter(p => new Date(p.created_at) >= today).length;
    const thisWeekOrders = purchases.filter(p => new Date(p.created_at) >= thisWeekStart).length;
    const thisMonthOrders = purchases.filter(p => new Date(p.created_at) >= thisMonthStart).length;

    // --- Customer Satisfaction / Avg Rating trend ---
    const avgRating = feedbacks.length > 0
      ? feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length
      : 0;

    // Rating trend (last 4 weeks)
    const ratingByWeek: { week: string; avg: number; count: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const wStart = new Date(now);
      wStart.setDate(now.getDate() - now.getDay() - i * 7);
      wStart.setHours(0, 0, 0, 0);
      const wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 7);
      const weekFb = feedbacks.filter(f => {
        const d = new Date(f.created_at);
        return d >= wStart && d < wEnd;
      });
      const avg = weekFb.length > 0 ? weekFb.reduce((s, f) => s + f.rating, 0) / weekFb.length : 0;
      ratingByWeek.push({
        week: `W${4 - i}`,
        avg: Math.round(avg * 10) / 10,
        count: weekFb.length,
      });
    }

    // --- Gross Profit Margin (based on configured monthly expenses) ---
    const grossProfit = thisMonthRev - totalMonthlyExpenses;
    const grossMargin = thisMonthRev > 0 ? (grossProfit / thisMonthRev) * 100 : 0;

    // --- Customer Lifetime Value ---
    const avgOrdersPerCustomer = totalCustomers > 0 ? purchases.length / totalCustomers : 0;
    const clv = avgCheck * avgOrdersPerCustomer;

    // --- Revenue trend (last 7 days) ---
    const revenueTrend: { day: string; revenue: number; orders: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dEnd = new Date(d);
      dEnd.setDate(dEnd.getDate() + 1);
      const dayPaid = paid.filter(p => {
        const pd = new Date(p.created_at);
        return pd >= d && pd < dEnd;
      });
      const dayAll = purchases.filter(p => {
        const pd = new Date(p.created_at);
        return pd >= d && pd < dEnd;
      });
      revenueTrend.push({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        revenue: dayPaid.reduce((s, p) => s + (p.amount || 0), 0),
        orders: dayAll.length,
      });
    }

    // --- Orders trend (last 4 weeks) ---
    const ordersTrend: { week: string; orders: number; revenue: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const wStart = new Date(now);
      wStart.setDate(now.getDate() - now.getDay() - i * 7);
      wStart.setHours(0, 0, 0, 0);
      const wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 7);
      const weekPurchases = purchases.filter(p => {
        const d = new Date(p.created_at);
        return d >= wStart && d < wEnd;
      });
      const weekPaid = paid.filter(p => {
        const d = new Date(p.created_at);
        return d >= wStart && d < wEnd;
      });
      ordersTrend.push({
        week: `W${4 - i}`,
        orders: weekPurchases.length,
        revenue: weekPaid.reduce((s, p) => s + (p.amount || 0), 0),
      });
    }

    return {
      weekGrowth, monthGrowth,
      thisWeekRev, lastWeekRev,
      thisMonthRev, lastMonthRev,
      avgRevenuePerCustomer, avgCheck,
      repeatRate, repeatCustomers, totalCustomers,
      todayOrders, thisWeekOrders, thisMonthOrders,
      avgRating, ratingByWeek,
      grossMargin, grossProfit, totalRevenue,
      clv, avgOrdersPerCustomer,
      revenueTrend, ordersTrend,
      totalUsers,
    };
  }, [purchases, feedbacks, totalUsers, totalMonthlyExpenses]);

  const formatIDR = (v: number) => `IDR ${Math.round(v).toLocaleString("id-ID")}`;

  const TrendBadge = ({ value, suffix = "%" }: { value: number; suffix?: string }) => {
    const isPositive = value > 0;
    const isZero = value === 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isZero ? "text-muted-foreground" : isPositive ? "text-emerald-400" : "text-red-400"}`}>
        {isZero ? <Minus className="w-3 h-3" /> : isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {isZero ? "0" : `${isPositive ? "+" : ""}${value.toFixed(1)}`}{suffix}
      </span>
    );
  };

  const revenueChartConfig = {
    revenue: { label: "Revenue", color: "hsl(var(--golden))" },
    orders: { label: "Orders", color: "hsl(var(--sunset))" },
  };

  const ratingChartConfig = {
    avg: { label: "Avg Rating", color: "hsl(var(--golden))" },
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue Growth */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50 h-full">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-emerald-400/10">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-xs text-muted-foreground">Revenue Growth</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Week</span>
                  <TrendBadge value={metrics.weekGrowth} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Month</span>
                  <TrendBadge value={metrics.monthGrowth} />
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-border/30">
                <p className="text-xs text-muted-foreground">This week: {formatIDR(metrics.thisWeekRev)}</p>
                <p className="text-xs text-muted-foreground">This month: {formatIDR(metrics.thisMonthRev)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Avg Revenue Per Customer */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50 h-full">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-golden/10">
                  <DollarSign className="w-4 h-4 text-golden" />
                </div>
                <p className="text-xs text-muted-foreground">Avg Revenue / Customer</p>
              </div>
              <p className="text-xl font-bold">{formatIDR(metrics.avgRevenuePerCustomer)}</p>
              <div className="mt-2 pt-2 border-t border-border/30">
                <p className="text-xs text-muted-foreground">Avg check: {formatIDR(metrics.avgCheck)}</p>
                <p className="text-xs text-muted-foreground">Total: {formatIDR(metrics.totalRevenue)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Repeat Customer Rate */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50 h-full">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-purple-400/10">
                  <Heart className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-xs text-muted-foreground">Repeat Customers</p>
              </div>
              <p className="text-xl font-bold">{metrics.repeatRate.toFixed(1)}%</p>
              <div className="mt-2 pt-2 border-t border-border/30">
                <p className="text-xs text-muted-foreground">{metrics.repeatCustomers} of {metrics.totalCustomers} customers</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Orders per Period */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50 h-full">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-blue-400/10">
                  <ShoppingCart className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-xs text-muted-foreground">Orders</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Today</span>
                  <span className="text-sm font-bold">{metrics.todayOrders}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">This week</span>
                  <span className="text-sm font-bold">{metrics.thisWeekOrders}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">This month</span>
                  <span className="text-sm font-bold">{metrics.thisMonthOrders}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Second Row: CSAT, Margin, CLV */}
      <div className="grid grid-cols-3 gap-4">
        {/* Customer Satisfaction */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50 h-full">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-yellow-400/10">
                  <Star className="w-4 h-4 text-yellow-400" />
                </div>
                <p className="text-xs text-muted-foreground">Avg Rating (CSAT)</p>
              </div>
              <p className="text-xl font-bold">{metrics.avgRating > 0 ? `${metrics.avgRating.toFixed(1)} ★` : "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">{feedbacks.length} reviews total</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Gross Profit Margin */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50 h-full">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-cyan-400/10">
                    <Percent className="w-4 h-4 text-cyan-400" />
                  </div>
                  <p className="text-xs text-muted-foreground">Gross Margin</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setEditExpenses(expenses.length > 0 ? [...expenses] : [{ id: crypto.randomUUID(), name: "", amount: 0 }]);
                    setShowExpenseDialog(true);
                  }}
                >
                  <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </div>
              <p className={`text-xl font-bold ${metrics.grossMargin < 0 ? "text-destructive" : ""}`}>
                {metrics.grossMargin.toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Profit: {formatIDR(metrics.grossProfit)}
              </p>
              {totalMonthlyExpenses > 0 && (
                <p className="text-xs text-muted-foreground">
                  Expenses: {formatIDR(totalMonthlyExpenses)}/mo ({expenses.length} items)
                </p>
              )}
              {totalMonthlyExpenses === 0 && (
                <p className="text-xs text-orange-400 mt-1">⚠ Set up expenses</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* CLV */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50 h-full">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-pink-400/10">
                  <Users className="w-4 h-4 text-pink-400" />
                </div>
                <p className="text-xs text-muted-foreground">Customer LTV</p>
              </div>
              <p className="text-xl font-bold">{formatIDR(metrics.clv)}</p>
              <p className="text-xs text-muted-foreground mt-1">~{metrics.avgOrdersPerCustomer.toFixed(1)} orders/customer</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue Trend (7 days) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display">Revenue (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueChartConfig} className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.revenueTrend}>
                    <defs>
                      <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--golden))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--golden))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      labelFormatter={(label) => label}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--golden))"
                      strokeWidth={2}
                      fill="url(#revGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Orders Trend (4 weeks) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display">Orders (Last 4 Weeks)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueChartConfig} className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.ordersTrend}>
                    <XAxis
                      dataKey="week"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      labelFormatter={(label) => label}
                    />
                    <Bar dataKey="orders" fill="hsl(var(--golden))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Rating Trend */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display">Rating Trend (4 Weeks)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={ratingChartConfig} className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.ratingByWeek}>
                    <XAxis
                      dataKey="week"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      domain={[0, 5]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      labelFormatter={(label) => label}
                    />
                    <Line
                      type="monotone"
                      dataKey="avg"
                      stroke="hsl(var(--golden))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--golden))", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Weekly Revenue Comparison */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display">Revenue by Week</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueChartConfig} className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.ordersTrend}>
                    <XAxis
                      dataKey="week"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      labelFormatter={(label) => label}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--sunset))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Monthly Expenses Dialog */}
      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Monthly Recurring Expenses</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {editExpenses.map((expense, idx) => (
              <div key={expense.id} className="flex items-center gap-2">
                <Input
                  placeholder="Expense name"
                  value={expense.name}
                  onChange={(e) => {
                    const updated = [...editExpenses];
                    updated[idx] = { ...updated[idx], name: e.target.value };
                    setEditExpenses(updated);
                  }}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={expense.amount || ""}
                  onChange={(e) => {
                    const updated = [...editExpenses];
                    updated[idx] = { ...updated[idx], amount: Number(e.target.value) || 0 };
                    setEditExpenses(updated);
                  }}
                  className="w-32"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removeExpenseRow(expense.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
            {editExpenses.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No expenses added yet</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={addExpenseRow} className="w-full gap-2">
            <Plus className="w-4 h-4" />
            Add Expense
          </Button>
          {editExpenses.length > 0 && (
            <div className="text-sm text-muted-foreground text-right">
              Total: IDR {editExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString("id-ID")}/month
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowExpenseDialog(false)}>Cancel</Button>
            <Button onClick={saveExpenses} disabled={savingExpenses} className="gap-2">
              <Save className="w-4 h-4" />
              {savingExpenses ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
