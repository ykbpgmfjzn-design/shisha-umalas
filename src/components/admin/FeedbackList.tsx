import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, MessageSquare, User, Calendar, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";

interface Feedback {
  id: string;
  user_id: string | null;
  rating: number;
  message: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

interface FeedbackListProps {
  onStatsUpdate?: (count: number, avgRating: number) => void;
}

const FeedbackList = ({ onStatsUpdate }: FeedbackListProps) => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeedbacks = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching feedback:", error);
      setLoading(false);
      return;
    }

    // Fetch user profiles for each feedback
    const feedbacksWithUsers = await Promise.all(
      (data || []).map(async (fb) => {
        if (fb.user_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", fb.user_id)
            .single();
          
          return {
            ...fb,
            user_email: profile?.email || undefined,
            user_name: profile?.full_name || undefined,
          };
        }
        return fb;
      })
    );

    setFeedbacks(feedbacksWithUsers);
    
    // Calculate stats
    const count = feedbacksWithUsers.length;
    const avgRating = count > 0 
      ? feedbacksWithUsers.reduce((sum, fb) => sum + fb.rating, 0) / count 
      : 0;
    
    onStatsUpdate?.(count, avgRating);
    setLoading(false);
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("feedback")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Не удалось удалить отзыв");
    } else {
      toast.success("Отзыв удалён");
      fetchFeedbacks();
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? "fill-golden text-golden" : "text-muted-foreground"
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-6">
        <div className="flex items-center gap-2 mb-6">
          <MessageSquare className="w-5 h-5 text-golden" />
          <h2 className="font-display text-xl">Отзывы</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-6 h-6 border-2 border-golden/30 border-t-golden rounded-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-golden" />
          <h2 className="font-display text-xl">Отзывы</h2>
        </div>
        <Badge variant="secondary">{feedbacks.length} отзывов</Badge>
      </div>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {feedbacks.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Пока нет отзывов
          </p>
        ) : (
          feedbacks.map((fb, index) => (
            <motion.div
              key={fb.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="bg-muted/30 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-golden/20">
                    <User className="w-4 h-4 text-golden" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {fb.user_name || fb.user_email || "Гость"}
                    </p>
                    {fb.user_email && fb.user_name && (
                      <p className="text-xs text-muted-foreground">{fb.user_email}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {renderStars(fb.rating)}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(fb.id)}
                    className="w-8 h-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {fb.message && (
                <p className="text-sm text-foreground/80 bg-background/30 rounded-lg p-3">
                  {fb.message}
                </p>
              )}

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>
                  {format(new Date(fb.created_at), "d MMMM yyyy, HH:mm", { locale: ru })}
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default FeedbackList;