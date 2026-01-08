import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { CalendarIcon, Clock, Phone, Sparkles, MapPin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LanguageSelector from "@/components/LanguageSelector";
import BottomNavigation from "@/components/BottomNavigation";
import { LanguageProvider, LanguageContext } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import heroBackground from "@/assets/rooftop-shisha-bg.jpg";
import { logActivity } from "@/hooks/useActivityLog";
import { LocationPicker } from "@/components/LocationPicker";

const timeSlots = [
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"
];

const ReservationContent = () => {
  const context = useContext(LanguageContext);
  const navigate = useNavigate();
  const { user } = useProfile();
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState<string>();
  const [partySize, setPartySize] = useState<number>(2);
  const [hookahCount, setHookahCount] = useState<number>(1);
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!context) return null;

  const { t } = context;

  const handleSubmit = async () => {
    if (!date || !time || !phone) {
      toast.error(t("reservation.fillRequired"));
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Insert into reservations table
      const { error } = await supabase
        .from("reservations")
        .insert({
          user_id: user?.id || null,
          reservation_date: format(date, 'yyyy-MM-dd'),
          reservation_time: time,
          party_size: partySize,
          hookah_count: hookahCount,
          phone,
          location: location || null,
          notes: notes || specialRequests || null,
          status: 'pending',
        });

      if (error) throw error;

      // Also log activity for backwards compatibility
      await logActivity('reservation', 'Бронирование создано', {
        date: format(date, 'yyyy-MM-dd'),
        time,
        party_size: partySize,
        hookah_count: hookahCount,
        phone,
      });

      toast.success(t("reservation.success"));
      
      // Navigate to profile to show reservation status
      navigate("/profile");
    } catch (error) {
      console.error("Reservation error:", error);
      toast.error(t("reservation.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main 
      className="min-h-screen bg-background pb-24 relative"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(20, 15, 10, 0.85), rgba(20, 15, 10, 0.95)), url(${heroBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <LanguageSelector />
      
      <div className="pt-24 px-4 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl text-golden mb-2">
              {t("reservation.title")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("reservation.subtitle")}
            </p>
          </div>

          {/* Date & Time Section */}
          <section className="space-y-4">
            <h2 className="font-display text-xl text-foreground">
              {t("reservation.selectDateTime")}
            </h2>

            {/* Date Picker */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                {t("reservation.date")}
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-between text-left font-normal bg-card/50 border-golden/30 hover:border-golden/60",
                      !date && "text-muted-foreground"
                    )}
                  >
                    {date ? format(date, "MMMM d, yyyy") : t("reservation.selectDate")}
                    <CalendarIcon className="h-4 w-4 text-golden" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time Picker */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                {t("reservation.time")}
              </label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger className="bg-card/50 border-golden/30 hover:border-golden/60">
                  <Clock className="h-4 w-4 text-muted-foreground mr-2" />
                  <SelectValue placeholder={t("reservation.selectTime")} />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* Party Size Section */}
          <section className="space-y-4">
            <h2 className="font-display text-xl text-foreground">
              {t("reservation.partySize")}
            </h2>
            <div className="grid grid-cols-8 gap-2">
              {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                <motion.button
                  key={num}
                  onClick={() => setPartySize(num)}
                  className={cn(
                    "w-10 h-10 rounded-lg font-medium transition-all",
                    partySize === num
                      ? "bg-golden text-primary-foreground shadow-lg"
                      : "bg-card/50 text-foreground border border-border/50 hover:border-golden/50"
                  )}
                  whileTap={{ scale: 0.95 }}
                >
                  {num}
                </motion.button>
              ))}
            </div>
          </section>

          {/* Hookah Count Section */}
          <section className="space-y-4">
            <h2 className="font-display text-xl text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-golden" />
              {t("reservation.hookahCount")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("reservation.hookahCountDesc")}
            </p>
            <div className="grid grid-cols-8 gap-2">
              {Array.from({ length: 15 }, (_, i) => i + 1).map((num) => (
                <motion.button
                  key={num}
                  onClick={() => setHookahCount(num)}
                  className={cn(
                    "w-10 h-10 rounded-lg font-medium transition-all",
                    hookahCount === num
                      ? "bg-golden text-primary-foreground shadow-lg"
                      : "bg-card/50 text-foreground border border-border/50 hover:border-golden/50"
                  )}
                  whileTap={{ scale: 0.95 }}
                >
                  {num}
                </motion.button>
              ))}
            </div>
          </section>

          {/* Additional Information */}
          <section className="space-y-4">
            <h2 className="font-display text-xl text-foreground">
              {t("reservation.additionalInfo")}
            </h2>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                {t("reservation.phone")}
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+62..."
                  className="pl-10 bg-card/50 border-golden/30 focus:border-golden"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4 text-golden" />
                {t("reservation.location")}
              </label>
              <LocationPicker
                value={location}
                onChange={(loc) => setLocation(loc)}
                placeholder={t("reservation.selectOnMap")}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                {t("reservation.notes")}
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("reservation.notesPlaceholder")}
                className="bg-card/50 border-golden/30 focus:border-golden min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                {t("reservation.specialRequests")}
              </label>
              <Textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder={t("reservation.specialRequestsPlaceholder")}
                className="bg-card/50 border-golden/30 focus:border-golden min-h-[80px]"
              />
            </div>
          </section>

          {/* Submit Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full h-14 bg-golden hover:bg-golden/90 text-primary-foreground font-semibold text-lg rounded-xl shadow-lg"
            >
              {isSubmitting ? t("reservation.submitting") : t("reservation.submit")}
            </Button>
          </motion.div>
        </motion.div>
      </div>

      <BottomNavigation />
    </main>
  );
};

const Reservation = () => {
  return (
    <LanguageProvider>
      <ReservationContent />
    </LanguageProvider>
  );
};

export default Reservation;
