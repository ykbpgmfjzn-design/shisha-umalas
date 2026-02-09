import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  TrendingUp, Users, Calendar, Globe, RefreshCw, 
  ArrowUp, ArrowDown, Minus, ExternalLink 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

interface GAReport {
  dailyVisits: { date: string; visits: number }[];
  weeklyTotal: number;
  monthlyTotal: number;
  trafficSources: { source: string; visits: number; percentage: number }[];
  todayVisits: number;
}

const chartConfig = {
  visits: {
    label: "Visits",
    color: "hsl(var(--golden))",
  },
};

const sourceColors = [
  "hsl(var(--golden))",
  "hsl(var(--sunset))",
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--muted-foreground))",
];

export default function AnalyticsDashboard() {
  const { toast } = useToast();
  const [data, setData] = useState<GAReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async (showToast = false) => {
    try {
      if (showToast) setIsRefreshing(true);
      
      const { data: response, error } = await supabase.functions.invoke('google-analytics');
      
      if (error) throw error;
      
      setData(response);
      setLastUpdated(new Date());
      
      if (showToast) {
        toast({
          title: "Data refreshed",
          description: "Google Analytics data loaded",
        });
      }
    } catch (error: any) {
      console.error("Error fetching analytics:", error);
      toast({
        variant: "destructive",
        title: "Loading error",
        description: error.message || "Failed to load analytics data",
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(() => fetchAnalytics(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  const formatDate = (dateStr: string) => {
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return `${month}/${day}`;
  };

  const getDayName = (dateStr: string) => {
    const year = parseInt(dateStr.slice(0, 4));
    const month = parseInt(dateStr.slice(4, 6)) - 1;
    const day = parseInt(dateStr.slice(6, 8));
    const date = new Date(year, month, day);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[date.getDay()];
  };

  const chartData = data?.dailyVisits.map(d => ({
    ...d,
    dateFormatted: formatDate(d.date),
    dayName: getDayName(d.date),
  })) || [];

  const getTrend = () => {
    if (!data || data.dailyVisits.length < 2) return { icon: Minus, color: "text-muted-foreground", label: "No data" };
    const last = data.dailyVisits[data.dailyVisits.length - 1]?.visits || 0;
    const prev = data.dailyVisits[data.dailyVisits.length - 2]?.visits || 0;
    if (last > prev) return { icon: ArrowUp, color: "text-green-500", label: `+${last - prev}` };
    if (last < prev) return { icon: ArrowDown, color: "text-red-500", label: `${last - prev}` };
    return { icon: Minus, color: "text-muted-foreground", label: "0" };
  };

  const trend = getTrend();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-2 border-golden/30 border-t-golden rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display text-foreground">Google Analytics</h2>
          {lastUpdated && (
            <p className="text-sm text-muted-foreground">
              Updated: {lastUpdated.toLocaleTimeString("en-US")}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAnalytics(true)}
            disabled={isRefreshing}
            className="border-golden/30 text-golden hover:bg-golden/10"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild className="border-border/50">
            <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Google Analytics
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-golden/10">
                  <Users className="w-5 h-5 text-golden" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{data?.todayVisits || 0}</p>
                  <p className="text-sm text-muted-foreground">Today</p>
                </div>
              </div>
              <div className={`flex items-center gap-1 mt-2 text-sm ${trend.color}`}>
                <trend.icon className="w-4 h-4" />
                <span>{trend.label} vs yesterday</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-sunset/10">
                  <Calendar className="w-5 h-5 text-sunset" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{data?.weeklyTotal || 0}</p>
                  <p className="text-sm text-muted-foreground">This week</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                ~{Math.round((data?.weeklyTotal || 0) / 7)}/day
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{data?.monthlyTotal || 0}</p>
                  <p className="text-sm text-muted-foreground">This month</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                ~{Math.round((data?.monthlyTotal || 0) / 30)}/day
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Globe className="w-5 h-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{data?.trafficSources.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Sources</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Traffic channels</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-display">Weekly Visits</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="visitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--golden))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--golden))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="dayName" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      labelFormatter={(_, payload) => {
                        if (payload && payload[0]) {
                          return payload[0].payload.dateFormatted;
                        }
                        return '';
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="visits"
                      stroke="hsl(var(--golden))"
                      strokeWidth={2}
                      fill="url(#visitGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="bg-card/60 backdrop-blur-xl border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-display">Traffic Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data?.trafficSources.slice(0, 6).map((source, index) => (
                  <div key={source.source} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground capitalize">
                        {source.source === "(direct)" ? "Direct" : 
                         source.source === "(not set)" ? "Unknown" : 
                         source.source}
                      </span>
                      <span className="text-muted-foreground">
                        {source.visits} ({source.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${source.percentage}%` }}
                        transition={{ delay: 0.7 + index * 0.1, duration: 0.5 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: sourceColors[index % sourceColors.length] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              {(!data?.trafficSources || data.trafficSources.length === 0) && (
                <p className="text-muted-foreground text-center py-8">No source data</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <Card className="bg-card/60 backdrop-blur-xl border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-display">Daily Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                    <th className="text-left py-2 text-muted-foreground font-medium">Day</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Visits</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">% of week</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((day) => {
                    const percentage = data?.weeklyTotal 
                      ? Math.round((day.visits / data.weeklyTotal) * 100) 
                      : 0;
                    return (
                      <tr key={day.date} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                        <td className="py-3 text-foreground">{day.dateFormatted}</td>
                        <td className="py-3 text-muted-foreground">{day.dayName}</td>
                        <td className="py-3 text-right font-medium text-foreground">{day.visits}</td>
                        <td className="py-3 text-right text-muted-foreground">{percentage}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {chartData.length === 0 && (
              <p className="text-muted-foreground text-center py-8">No data for the last week</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
