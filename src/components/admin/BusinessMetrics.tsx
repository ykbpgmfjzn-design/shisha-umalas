import { useMemo, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart,
  Star, Percent, Heart, BarChart3, ArrowUpRight, ArrowDownRight, Minus,
  Plus, Trash2, Settings2, Save, X, CalendarDays
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type Period = "week" | "month" | "quarter" | "year";

interface BusinessMetricsProps {
  purchases: PurchaseWithProfile[];
  feedbacks: FeedbackItem[];
  totalUsers: number;
}

function getPeriodRange(period: Period): { start: Date; prevStart: Date; prevEnd: Date; label: string } {
  const now = new Date();
  const start = new Date(now);
  const prevStart = new Date(now);
  const prevEnd = new Date(now);

  switch (period) {
    case "week":
      start.setDate(now.getDate() - 7);
      prevEnd.setTime(start.getTime());
      prevStart.setDate(start.getDate() - 7);
      return { start, prevStart, prevEnd, label: "Last 7 days" };
    case "month":
      start.setMonth(now.getMonth() - 1);
      prevEnd.setTime(start.getTime());
      prevStart.setMonth(start.getMonth() - 1);
      return { start, prevStart, prevEnd, label: "Last 30 days" };
    case "quarter":
      start.setMonth(now.getMonth() - 3);
      prevEnd.setTime(start.getTime());
      prevStart.setMonth(start.getMonth() - 3);
      return { start, prevStart, prevEnd, label: "Last 3 months" };
    case "year":
      start.setFullYear(now.getFullYear() - 1);
      prevEnd.setTime(start.getTime());
      prevStart.setFullYear(start.getFullYear() - 1);
      return { start, prevStart, prevEnd, label: "Last 12 months" };
  }
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
  const [period, setPeriod] = useState<Period>("month");
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
    const now = new Date();
    const range = getPeriodRange(period);
    const { start: periodStart, prevStart, prevEnd } = range;

    // Filter by period
    const periodPurchases = purchases.filter(p => new Date(p.created_at) >= periodStart);
    const prevPurchases = purchases.filter(p => {
      const d = new Date(p.created_at);
      return d >= prevStart && d < prevEnd;
    });
    const periodFeedbacks = feedbacks.filter(f => new Date(f.created_at) >= periodStart);
    const prevFeedbacks = feedbacks.filter(f => {
      const d = new Date(f.created_at);
      return d >= prevStart && d < prevEnd;
    });

    const paid = paidOnly(periodPurchases);
    const prevPaid = paidOnly(prevPurchases);

    // --- Revenue Growth Rate ---
    const periodRev = paid.reduce((s, p) => s + (p.amount || 0), 0);
    const prevRev = prevPaid.reduce((s, p) => s + (p.amount || 0), 0);
    const revenueGrowth = prevRev > 0
      ? ((periodRev - prevRev) / prevRev) * 100
      : periodRev > 0 ? 100 : 0;

    // --- Average Revenue Per Customer ---
    const uniquePaidCustomers = new Set(paid.map(p => p.user_id)).size;
    const avgRevenuePerCustomer = uniquePaidCustomers > 0 ? periodRev / uniquePaidCustomers : 0;

    // --- Avg check (per order) ---
    const avgCheck = paid.length > 0 ? periodRev / paid.length : 0;

    // --- Repeat Customer Rate (within period) ---
    const customerOrderCount = new Map<string, number>();
    for (const p of periodPurchases) {
      customerOrderCount.set(p.user_id, (customerOrderCount.get(p.user_id) || 0) + 1);
    }
    const totalCustomers = customerOrderCount.size;
    const repeatCustomers = [...customerOrderCount.values()].filter(c => c > 1).length;
    const repeatRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

    // --- Orders count ---
    const periodOrders = periodPurchases.length;
    const prevOrders = prevPurchases.length;
    const ordersGrowth = prevOrders > 0
      ? ((periodOrders - prevOrders) / prevOrders) * 100
      : periodOrders > 0 ? 100 : 0;

    // --- Avg orders per day in period ---
    const periodDays = Math.max(1, Math.ceil((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
    const avgOrdersPerDay = periodOrders / periodDays;

    // --- Customer Satisfaction / Avg Rating ---
    const avgRating = periodFeedbacks.length > 0
      ? periodFeedbacks.reduce((s, f) => s + f.rating, 0) / periodFeedbacks.length
      : 0;
    const prevAvgRating = prevFeedbacks.length > 0
      ? prevFeedbacks.reduce((s, f) => s + f.rating, 0) / prevFeedbacks.length
      : 0;

    // Rating trend (split period into segments)
    const segments = period === "week" ? 7 : period === "month" ? 4 : period === "quarter" ? 12 : 12;
    const segmentMs = (now.getTime() - periodStart.getTime()) / segments;
    const ratingTrend: { label: string; avg: number; count: number }[] = [];
    for (let i = 0; i < segments; i++) {
      const segStart = new Date(periodStart.getTime() + i * segmentMs);
      const segEnd = new Date(periodStart.getTime() + (i + 1) * segmentMs);
      const segFb = periodFeedbacks.filter(f => {
        const d = new Date(f.created_at);
        return d >= segStart && d < segEnd;
      });
      const avg = segFb.length > 0 ? segFb.reduce((s, f) => s + f.rating, 0) / segFb.length : 0;
      const label = period === "week"
        ? segStart.toLocaleDateString("en-US", { weekday: "short" })
        : period === "month"
          ? `W${i + 1}`
          : segStart.toLocaleDateString("en-US", { month: "short" });
      ratingTrend.push({ label, avg: Math.round(avg * 10) / 10, count: segFb.length });
    }

    // --- Gross Profit Margin ---
    // Scale monthly expenses to the period length
    const periodMonths = periodDays / 30;
    const scaledExpenses = totalMonthlyExpenses * periodMonths;
    const grossProfit = periodRev - scaledExpenses;
    const grossMargin = periodRev > 0 ? (grossProfit / periodRev) * 100 : 0;

    // --- Customer Lifetime Value (all-time) ---
    const allPaid = paidOnly(purchases);
    const allCustomerCount = new Map<string, number>();
    for (const p of purchases) {
      allCustomerCount.set(p.user_id, (allCustomerCount.get(p.user_id) || 0) + 1);
    }
    const allTotalCustomers = allCustomerCount.size;
    const allAvgCheck = allPaid.length > 0 ? allPaid.reduce((s, p) => s + (p.amount || 0), 0) / allPaid.length : 0;
    const avgOrdersPerCustomer = allTotalCustomers > 0 ? purchases.length / allTotalCustomers : 0;
    const clv = allAvgCheck * avgOrdersPerCustomer;

    // --- Revenue trend (segmented by period) ---
    const revenueTrend: { label: string; revenue: number; orders: number }[] = [];
    for (let i = 0; i < segments; i++) {
      const segStart = new Date(periodStart.getTime() + i * segmentMs);
      const segEnd = new Date(periodStart.getTime() + (i + 1) * segmentMs);
      const segPaid = paid.filter(p => {
        const pd = new Date(p.created_at);
        return pd >= segStart && pd < segEnd;
      });
      const segAll = periodPurchases.filter(p => {
        const pd = new Date(p.created_at);
        return pd >= segStart && pd < segEnd;
      });
      const label = period === "week"
        ? segStart.toLocaleDateString("en-US", { weekday: "short" })
        : period === "month"
          ? `W${i + 1}`
          : segStart.toLocaleDateString("en-US", { month: "short" });
      revenueTrend.push({
        label,
        revenue: segPaid.reduce((s, p) => s + (p.amount || 0), 0),
        orders: segAll.length,
      });
    }

    return {
      revenueGrowth,
      periodRev, prevRev,
      avgRevenuePerCustomer, avgCheck,
      repeatRate, repeatCustomers, totalCustomers,
      periodOrders, prevOrders, ordersGrowth, avgOrdersPerDay,
      avgRating, prevAvgRating, ratingTrend,
      grossMargin, grossProfit, periodLabel: range.label,
      clv, avgOrdersPerCustomer,
      revenueTrend,
      totalUsers,
      periodFeedbackCount: periodFeedbacks.length,
    };
  }, [purchases, feedbacks, totalUsers, totalMonthlyExpenses, period]);

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
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{metrics.periodLabel}</span>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="bg-card/60 backdrop-blur-xl">
            <TabsTrigger value="week" className="text-xs px-3">Week</TabsTrigger>
            <TabsTrigger value="month" className="text-xs px-3">Month</TabsTrigger>
            <TabsTrigger value="quarter" className="text-xs px-3">Quarter</TabsTrigger>
            <TabsTrigger value="year" className="text-xs px-3">Year</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

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
              <p className="text-xl font-bold">{formatIDR(metrics.periodRev)}</p>
              <div className="flex items-center gap-2 mt-1">
                <TrendBadge value={metrics.revenueGrowth} />
                <span className="text-xs text-muted-foreground">vs prev period</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Prev: {formatIDR(metrics.prevRev)}</p>
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
              <p className="text-xl font-bold">{metrics.periodOrders}</p>
              <div className="flex items-center gap-2 mt-1">
                <TrendBadge value={metrics.ordersGrowth} />
                <span className="text-xs text-muted-foreground">vs prev</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">~{metrics.avgOrdersPerDay.toFixed(1)}/day</p>
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
              <p className="text-xs text-muted-foreground mt-1">{metrics.periodFeedbackCount} reviews in period</p>
              {metrics.prevAvgRating > 0 && (
                <TrendBadge value={metrics.avgRating - metrics.prevAvgRating} suffix=" pts" />
              )}
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
        {/* Revenue Trend */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display">Revenue Trend</CardTitle>
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
                      dataKey="label"
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

        {/* Orders Trend */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display">Orders Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueChartConfig} className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.revenueTrend}>
                    <XAxis
                      dataKey="label"
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
              <CardTitle className="text-lg font-display">Rating Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={ratingChartConfig} className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.ratingTrend}>
                    <XAxis
                      dataKey="label"
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
