import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Flame, Crown, Medal } from "lucide-react";
import { motion } from "framer-motion";

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Get all shisha_master and admin roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("role", "shisha_master");

      if (!roles || roles.length === 0) {
        setLoading(false);
        return;
      }

      const masterUserIds = [...new Set(roles.map(r => r.user_id))];

      // Get profiles for these users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", masterUserIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.id, p])
      );

      // Get orders grouped by created_by for these masters
      const { data: purchases } = await supabase
        .from("purchases")
        .select("created_by, amount, payment_status")
        .in("created_by", masterUserIds);

      // Aggregate stats
      const statsMap = new Map<string, { count: number; revenue: number }>();
      for (const p of purchases || []) {
        if (!p.created_by) continue;
        const existing = statsMap.get(p.created_by) || { count: 0, revenue: 0 };
        existing.count += 1;
        if (p.payment_status?.toLowerCase() === "paid") {
          existing.revenue += Number(p.amount) || 0;
        }
        statsMap.set(p.created_by, existing);
      }

      // Build leaderboard - include all masters, even with 0 orders
      const leaderboard: MasterStats[] = masterUserIds.map(uid => {
        const profile = profileMap.get(uid);
        const stats = statsMap.get(uid) || { count: 0, revenue: 0 };
        return {
          userId: uid,
          name: profile?.full_name || profile?.email || "Unknown",
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
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Trophy className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-display font-bold">Leaderboard</h2>
        </div>
        <p className="text-sm text-muted-foreground">Total orders created by each master</p>
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
                <Card className={`border transition-all ${getRankBg(index, isCurrentUser)}`}>
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

                    {/* Orders Count */}
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1">
                        <Flame className={`w-4 h-4 ${index === 0 ? "text-yellow-400" : "text-muted-foreground"}`} />
                        <span className="text-xl font-bold">{master.orderCount}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">orders</p>
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
