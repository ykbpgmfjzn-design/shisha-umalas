import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, Wind, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Reservation {
  id: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  hookah_count: number;
  status: string;
  created_at: string;
}

export default function UserReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReservations();

    // Realtime subscription for updates
    const channel = supabase
      .channel('my-reservations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        () => fetchReservations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchReservations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("user_id", user.id)
      .order("reservation_date", { ascending: false });

    if (!error && data) {
      setReservations(data);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            ✓ Подтверждено
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            ✕ Отменено
          </Badge>
        );
      default:
        return (
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse">
            ⏳ Ожидает подтверждения
          </Badge>
        );
    }
  };

  const isUpcoming = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  };

  if (loading) {
    return (
      <Card className="bg-card/80 backdrop-blur-xl border-border/50">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (reservations.length === 0) {
    return null;
  }

  const upcomingReservations = reservations.filter(r => isUpcoming(r.reservation_date) && r.status !== "cancelled");
  const pastReservations = reservations.filter(r => !isUpcoming(r.reservation_date) || r.status === "cancelled");

  return (
    <Card className="bg-card/80 backdrop-blur-xl border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-primary" />
          Мои бронирования
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upcoming/Active Reservations */}
        {upcomingReservations.length > 0 && (
          <div className="space-y-3">
            {upcomingReservations.map((res) => (
              <div
                key={res.id}
                className={`p-4 rounded-xl border ${
                  res.status === "pending"
                    ? "bg-orange-500/5 border-orange-500/20"
                    : "bg-green-500/5 border-green-500/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="font-medium">
                      {format(new Date(res.reservation_date), "d MMMM yyyy", { locale: ru })}
                    </span>
                  </div>
                  {getStatusBadge(res.status)}
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{res.reservation_time}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    <span>{res.party_size} гостей</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Wind className="h-3.5 w-3.5" />
                    <span>{res.hookah_count} кальян(ов)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Past Reservations (collapsed) */}
        {pastReservations.length > 0 && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
              Прошедшие ({pastReservations.length})
            </p>
            <div className="space-y-2">
              {pastReservations.slice(0, 3).map((res) => (
                <div
                  key={res.id}
                  className="p-3 rounded-lg bg-muted/20 text-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      {format(new Date(res.reservation_date), "d MMM", { locale: ru })}
                    </span>
                    <span>
                      {res.party_size} гостей • {res.hookah_count} кальян(ов)
                    </span>
                  </div>
                  {getStatusBadge(res.status)}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
