import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, Send, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import LanguageSelector from "@/components/LanguageSelector";
import BottomNavigation from "@/components/BottomNavigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import heroBackground from "@/assets/rooftop-shisha-bg.jpg";
import { logActivity } from "@/hooks/useActivityLog";

const Feedback = () => {
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error(t("feedback.ratingRequired"));
      return;
    }

    if (!name.trim()) {
      toast.error(t("feedback.nameRequired"));
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.from("feedback").insert({
      user_id: userId,
      rating,
      message: feedback || null,
      name: name.trim(),
    });
    
    if (error) {
      toast.error("Ошибка при отправке отзыва");
      console.error(error);
    } else {
      // Log feedback submission
      await logActivity('feedback', 'Отзыв отправлен', {
        rating,
        has_message: !!feedback,
      });
      
      // If 5 stars, redirect to Google Reviews
      if (rating === 5) {
        toast.success(t("feedback.thankYouRedirect"));
        setTimeout(() => {
          window.open("https://g.page/r/CWUVTUf3-kd2EAI/review", "_blank");
        }, 1000);
      } else {
        // Less than 5 stars - just thank them
        toast.success(t("feedback.thankYou"));
      }
      
      setRating(0);
      setFeedback("");
      setName("");
    }
    
    setIsSubmitting(false);
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
          className="space-y-8"
        >
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl text-golden mb-2">
              {t("feedback.title")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("feedback.subtitle")}
            </p>
          </div>

          {/* Name Input */}
          <section className="space-y-3">
            <h2 className="font-display text-xl text-foreground flex items-center gap-2">
              <User className="w-5 h-5 text-golden" />
              {t("feedback.yourName")}
            </h2>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("feedback.namePlaceholder")}
              className="bg-card/50 border-golden/30 focus:border-golden"
              maxLength={50}
            />
          </section>

          {/* Star Rating */}
          <section className="space-y-4">
            <h2 className="font-display text-xl text-foreground text-center">
              {t("feedback.rateExperience")}
            </h2>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.1 }}
                  className="p-1"
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      star <= (hoverRating || rating)
                        ? "fill-golden text-golden"
                        : "text-muted-foreground"
                    }`}
                  />
                </motion.button>
              ))}
            </div>
          </section>

          {/* Feedback Text */}
          <section className="space-y-4">
            <h2 className="font-display text-xl text-foreground">
              {t("feedback.tellUsMore")}
            </h2>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={t("feedback.placeholder")}
              className="bg-card/50 border-golden/30 focus:border-golden min-h-[150px]"
            />
            <p className="text-xs text-muted-foreground">
              {t("feedback.publicNote")}
            </p>
          </section>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full h-14 bg-golden hover:bg-golden/90 text-primary-foreground font-semibold text-lg rounded-xl shadow-lg"
          >
            <Send className="w-5 h-5 mr-2" />
            {isSubmitting ? t("feedback.submitting") : t("feedback.submit")}
          </Button>
        </motion.div>
      </div>

      <BottomNavigation />
    </main>
  );
};

export default Feedback;
