import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, Clock, Users, Wind, Phone, User, Check, X, MoreVertical, Loader2, MapPin } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { format } from "date-fns";
import { toast } from "sonner";

interface Reservation {
  id: string;
  user_id: string | null;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  hookah_count: number;
  phone: string;
  location: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  profile?: {
    full_name: string | null;
    email: string | null;
  };
}

export default function ReservationsList() {
  const { isAdmin } = useUserRoles();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchReservations();

    const channel = supabase
      .channel('reservations-changes')
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
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .order("reservation_date", { ascending: true })
      .order("reservation_time", { ascending: true });

    if (!error && data) {
      const reservationsWithProfiles = await Promise.all(
        data.map(async (res) => {
          if (res.user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", res.user_id)
              .maybeSingle();
            
            return { ...res, profile: profile || undefined };
          }
          return res;
        })
      );

      setReservations(reservationsWithProfiles);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    
    const reservation = reservations.find(r => r.id === id);
    
    const { error } = await supabase
      .from("reservations")
      .update({ status })
      .eq("id", id);

    if (error) {
      setUpdating(null);
      toast.error("Failed to update status");
      console.error("Update error:", error);
      return;
    }

    if (reservation?.profile?.email) {
      try {
        await supabase.functions.invoke("send-reservation-notification", {
          body: {
            reservation_id: id,
            new_status: status,
            user_email: reservation.profile.email,
            user_name: reservation.profile.full_name || undefined,
            reservation_date: format(new Date(reservation.reservation_date), "MMMM d, yyyy"),
            reservation_time: reservation.reservation_time,
            party_size: reservation.party_size,
            hookah_count: reservation.hookah_count,
          },
        });
      } catch (notifError) {
        console.error("Notification error:", notifError);
      }
    }

    setUpdating(null);
    toast.success(
      status === "confirmed" ? "Reservation confirmed" :
      status === "cancelled" ? "Reservation cancelled" :
      "Status updated"
    );
    fetchReservations();
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Confirmed</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Cancelled</Badge>;
      default:
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const upcomingReservations = reservations.filter(r => isUpcoming(r.reservation_date));
  const pastReservations = reservations.filter(r => isPast(r.reservation_date));

  const renderReservation = (res: Reservation, showActions: boolean = true) => (
    <div
      key={res.id}
      className={`p-4 rounded-lg border ${
        isToday(res.reservation_date)
          ? "bg-primary/10 border-primary/30"
          : res.status === "cancelled"
          ? "bg-muted/20 border-border/30 opacity-60"
          : res.status === "confirmed"
          ? "bg-green-500/5 border-green-500/20"
          : "bg-muted/30 border-border/50"
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={isToday(res.reservation_date) ? "default" : "secondary"}>
              <Calendar className="h-3 w-3 mr-1" />
              {format(new Date(res.reservation_date), "MMMM d, yyyy")}
            </Badge>
            <Badge variant="outline">
              <Clock className="h-3 w-3 mr-1" />
              {res.reservation_time}
            </Badge>
            {getStatusBadge(res.status)}
            {isToday(res.reservation_date) && res.status !== "cancelled" && (
              <Badge className="bg-primary">Today</Badge>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{res.party_size} guests</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Wind className="h-4 w-4 text-muted-foreground" />
              <span>{res.hookah_count} hookahs</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              <span>{res.phone}</span>
            </div>
            {res.profile && (
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span>{res.profile.full_name || res.profile.email}</span>
              </div>
            )}
          </div>

          {res.location && (
            <div className="flex items-center gap-1.5 text-sm text-primary">
              <MapPin className="h-3.5 w-3.5" />
              <span>{res.location}</span>
            </div>
          )}

          {res.notes && (
            <p className="text-sm text-muted-foreground italic">{res.notes}</p>
          )}
        </div>

        {showActions && isAdmin && res.status === "pending" && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-green-500 border-green-500/30 hover:bg-green-500/10"
              onClick={() => updateStatus(res.id, "confirmed")}
              disabled={updating === res.id}
            >
              {updating === res.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Confirm
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-500 border-red-500/30 hover:bg-red-500/10"
              onClick={() => updateStatus(res.id, "cancelled")}
              disabled={updating === res.id}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        )}

        {showActions && isAdmin && res.status !== "pending" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {res.status !== "pending" && (
                <DropdownMenuItem onClick={() => updateStatus(res.id, "pending")}>
                  Mark as Pending
                </DropdownMenuItem>
              )}
              {res.status !== "confirmed" && (
                <DropdownMenuItem onClick={() => updateStatus(res.id, "confirmed")}>
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  Confirm
                </DropdownMenuItem>
              )}
              {res.status !== "cancelled" && (
                <DropdownMenuItem onClick={() => updateStatus(res.id, "cancelled")}>
                  <X className="h-4 w-4 mr-2 text-red-500" />
                  Cancel
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Reservations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reservations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No reservations</p>
          </div>
        ) : (
          <div className="space-y-6">
            {upcomingReservations.length > 0 && (
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-3 uppercase tracking-wide">
                  Upcoming ({upcomingReservations.length})
                </h3>
                <div className="space-y-3">
                  {upcomingReservations.map((res) => renderReservation(res))}
                </div>
              </div>
            )}

            {pastReservations.length > 0 && (
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-3 uppercase tracking-wide">
                  Past ({pastReservations.length})
                </h3>
                <div className="space-y-2">
                  {pastReservations.slice(0, 10).map((res) => renderReservation(res, false))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
