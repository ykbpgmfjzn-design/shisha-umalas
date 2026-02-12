import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Flame, Crown, Medal, CalendarDays, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { startOfMonth, startOfDay, subMonths, format } from "date-fns";
import LeaderboardOrderDetails from "./LeaderboardOrderDetails";

type PeriodFilter = "today" | "current" | "previous";

interface MasterStats {
  userId: string;
  name: string;
  avatarUrl: string | null;
  orderCount: number;
  totalRevenue: number;
}

export default function Leaderboard() {
  const [masters, setMasters] = useState<MasterStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodFilter>("current");
  const [selectedMaster, setSelectedMaster] = useState<MasterStats | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Get all shisha_master roles with display_name
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role, display_name")
        .eq("role", "shisha_master");

      if (!roles || roles.length === 0) {
        setLoading(false);
        return;
      }

      const masterUserIds = [...new Set(roles.map(r => r.user_id))];
      const displayNameMap = new Map(roles.map(r => [r.user_id, r.display_name]));

      // Get profiles for these users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", masterUserIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.id, p])
      );

      // Date filter
      const now = new Date();
      let fromDate: Date;
      let toDate: Date;
      if (period === "today") {
        fromDate = startOfDay(now);
        toDate = now;
      } else if (period === "current") {
        fromDate = startOfMonth(now);
        toDate = now;
      } else {
        fromDate = startOfMonth(subMonths(now, 1));
        toDate = startOfMonth(now);
      }

      // Get orders where master is either created_by OR shisha_master_id
      const { data: purchases } = await supabase
        .from("purchases")
        .select("created_by, shisha_master_id, amount, payment_status, created_at")
        .or(`created_by.in.(${masterUserIds.join(",")}),shisha_master_id.in.(${masterUserIds.join(",")})`)
        .gte("created_at", fromDate.toISOString())
        .lt("created_at", toDate.toISOString());

      // Aggregate stats — count each order once per master
      const statsMap = new Map<string, { count: number; revenue: number }>();
      for (const p of purchases || []) {
        // Determine which master(s) this order belongs to
        const relevantIds = new Set<string>();
        if (p.created_by && masterUserIds.includes(p.created_by)) relevantIds.add(p.created_by);
        if (p.shisha_master_id && masterUserIds.includes(p.shisha_master_id)) relevantIds.add(p.shisha_master_id);

        for (const uid of relevantIds) {
          const existing = statsMap.get(uid) || { count: 0, revenue: 0 };
          existing.count += 1;
          if (p.payment_status?.toLowerCase() === "paid") {
            existing.revenue += Number(p.amount) || 0;
          }
          statsMap.set(uid, existing);
        }
      }

      // Build leaderboard - include all masters, even with 0 orders
      const leaderboard: MasterStats[] = masterUserIds.map(uid => {
        const profile = profileMap.get(uid);
        const stats = statsMap.get(uid) || { count: 0, revenue: 0 };
        return {
          userId: uid,
          name: displayNameMap.get(uid) || profile?.full_name || profile?.email || "Unknown",
          avatarUrl: profile?.avatar_url || null,
          orderCount: stats.count,
          totalRevenue: stats.revenue,
        };
      });

      leaderboard.sort((a, b) => b.orderCount - a.orderCount || b.totalRevenue - a.totalRevenue);
      setMasters(leaderboard);
      setLoading(false);
    };

    load();

    // Realtime updates
    const channel = supabase
      .channel("leaderboard-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [period]);

  const rankIcons = [
    <Crown className="w-5 h-5 text-yellow-400" />,
    <Medal className="w-5 h-5 text-gray-300" />,
    <Medal className="w-5 h-5 text-amber-600" />,
  ];

  const getRankBg = (index: number, isCurrentUser: boolean) => {
    if (isCurrentUser) return "ring-2 ring-primary/50 bg-primary/10";
    if (index === 0) return "bg-yellow-400/10 border-yellow-400/30";
    if (index === 1) return "bg-gray-300/5 border-gray-300/20";
    if (index === 2) return "bg-amber-600/10 border-amber-600/20";
    return "bg-muted/30";
  };

  // Compute date range for detail view
  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === "today") return { from: startOfDay(now), to: now };
    if (period === "current") return { from: startOfMonth(now), to: now };
    return { from: startOfMonth(subMonths(now, 1)), to: startOfMonth(now) };
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (selectedMaster) {
    return (
      <LeaderboardOrderDetails
        masterName={selectedMaster.name}
        masterUserId={selectedMaster.userId}
        fromDate={dateRange.from}
        toDate={dateRange.to}
        onBack={() => setSelectedMaster(null)}
      />
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-2">
          <Trophy className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-display font-bold">Leaderboard</h2>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => setPeriod("today")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              period === "today"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setPeriod("current")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              period === "current"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {format(new Date(), "MMMM yyyy")}
          </button>
          <button
            onClick={() => setPeriod("previous")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              period === "previous"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {format(startOfMonth(subMonths(new Date(), 1)), "MMMM yyyy")}
          </button>
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="space-y-2">
        {masters.length === 0 ? (
          <Card className="bg-card/60 backdrop-blur-xl border-border/50">
            <CardContent className="py-8 text-center text-muted-foreground">
              No data yet. Start creating orders!
            </CardContent>
          </Card>
        ) : (
          masters.map((master, index) => {
            const isCurrentUser = master.userId === currentUserId;
            return (
              <motion.div
                key={master.userId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <Card
                  className={`border transition-all cursor-pointer hover:scale-[1.01] ${getRankBg(index, isCurrentUser)}`}
                  onClick={() => setSelectedMaster(master)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    {/* Rank */}
                    <div className="w-8 flex items-center justify-center shrink-0">
                      {index < 3 ? (
                        rankIcons[index]
                      ) : (
                        <span className="text-lg font-bold text-muted-foreground">{index + 1}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={master.avatarUrl || undefined} />
                      <AvatarFallback className="bg-primary/20 text-primary font-bold">
                        {master.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {master.name}
                        {isCurrentUser && (
                          <span className="text-xs text-primary ml-2">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Revenue: IDR {master.totalRevenue.toLocaleString("id-ID")}
                      </p>
                    </div>

                    {/* Orders Count + Chevron */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <Flame className={`w-4 h-4 ${index === 0 ? "text-yellow-400" : "text-muted-foreground"}`} />
                          <span className="text-xl font-bold">{master.orderCount}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">orders</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
