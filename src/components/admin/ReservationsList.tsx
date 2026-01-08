import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, Wind, Phone, User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Reservation {
  id: string;
  user_id: string | null;
  created_at: string;
  details: {
    date: string;
    time: string;
    party_size: number;
    hookah_count: number;
    phone: string;
  };
  profile?: {
    full_name: string | null;
    email: string | null;
  };
}

export default function ReservationsList() {
  const { t } = useLanguage();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReservations();

    // Realtime subscription
    const channel = supabase
      .channel('reservations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_logs', filter: 'activity_type=eq.reservation' },
        () => fetchReservations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchReservations = async () => {
    const { data, error } = await supabase
      .from("activity_logs")
      .select("id, user_id, created_at, details")
      .eq("activity_type", "reservation")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      // Fetch user profiles
      const reservationsWithProfiles = await Promise.all(
        data.map(async (res) => {
          if (res.user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", res.user_id)
              .maybeSingle();
            
            return {
              ...res,
              details: res.details as Reservation["details"],
              profile: profile || undefined,
            };
          }
          return {
            ...res,
            details: res.details as Reservation["details"],
          };
        })
      );

      setReservations(reservationsWithProfiles);
    }
    setLoading(false);
  };

  const isUpcoming = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  };

  const isPast = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isToday = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const upcomingReservations = reservations.filter(r => r.details?.date && isUpcoming(r.details.date));
  const pastReservations = reservations.filter(r => r.details?.date && isPast(r.details.date));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          {t("admin.reservations")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reservations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t("admin.noReservations")}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Upcoming Reservations */}
            {upcomingReservations.length > 0 && (
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-3 uppercase tracking-wide">
                  {t("admin.upcomingReservations")} ({upcomingReservations.length})
                </h3>
                <div className="space-y-3">
                  {upcomingReservations.map((res) => (
                    <div
                      key={res.id}
                      className={`p-4 rounded-lg border ${
                        isToday(res.details.date)
                          ? "bg-primary/10 border-primary/30"
                          : "bg-muted/30 border-border/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge variant={isToday(res.details.date) ? "default" : "secondary"}>
                              <Calendar className="h-3 w-3 mr-1" />
                              {format(new Date(res.details.date), "d MMMM yyyy", { locale: ru })}
                            </Badge>
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              {res.details.time}
                            </Badge>
                            {isToday(res.details.date) && (
                              <Badge className="bg-primary">{t("admin.today")}</Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1.5">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span>{res.details.party_size} {t("admin.guests")}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Wind className="h-4 w-4 text-muted-foreground" />
                              <span>{res.details.hookah_count} {t("admin.hookahs")}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5" />
                              <span>{res.details.phone}</span>
                            </div>
                            {res.profile && (
                              <div className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" />
                                <span>{res.profile.full_name || res.profile.email}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past Reservations */}
            {pastReservations.length > 0 && (
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-3 uppercase tracking-wide">
                  {t("admin.pastReservations")} ({pastReservations.length})
                </h3>
                <div className="space-y-2">
                  {pastReservations.slice(0, 10).map((res) => (
                    <div
                      key={res.id}
                      className="p-3 rounded-lg bg-muted/20 border border-border/30 text-sm"
                    >
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">
                            {format(new Date(res.details.date), "d MMM", { locale: ru })} {res.details.time}
                          </span>
                          <span>
                            {res.details.party_size} {t("admin.guests")} • {res.details.hookah_count} {t("admin.hookahs")}
                          </span>
                        </div>
                        <span className="text-muted-foreground">
                          {res.profile?.full_name || res.details.phone}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
