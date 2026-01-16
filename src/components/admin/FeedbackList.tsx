import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, MessageSquare, User, Calendar, Trash2, Check, X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface Feedback {
  id: string;
  user_id: string | null;
  rating: number;
  message: string | null;
  name: string | null;
  photo_url: string | null;
  is_approved: boolean;
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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pending");

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
            .maybeSingle();
          
          return {
            ...fb,
            user_email: profile?.email || undefined,
            user_name: profile?.full_name || undefined,
          };
        }
        return fb;
      })
    );

    setFeedbacks(feedbacksWithUsers as Feedback[]);
    
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

  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from("feedback")
      .update({ is_approved: true })
      .eq("id", id);

    if (error) {
      toast.error("Не удалось одобрить отзыв");
    } else {
      toast.success("Отзыв одобрен и опубликован");
      fetchFeedbacks();
    }
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from("feedback")
      .update({ is_approved: false })
      .eq("id", id);

    if (error) {
      toast.error("Не удалось отклонить отзыв");
    } else {
      toast.success("Отзыв скрыт из публикации");
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

  // Filter feedbacks for moderation
  const pendingReviews = feedbacks.filter(fb => 
    fb.rating === 5 && fb.message && fb.name && !fb.is_approved
  );
  const approvedReviews = feedbacks.filter(fb => fb.is_approved);
  const allReviews = feedbacks;

  const renderFeedbackItem = (fb: Feedback, showModeration: boolean = false) => (
    <motion.div
      key={fb.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-muted/30 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-golden/20">
            <User className="w-4 h-4 text-golden" />
          </div>
          <div>
            <p className="font-medium text-sm">
              {fb.name || fb.user_name || fb.user_email || "Гость"}
            </p>
            {fb.user_email && (
              <p className="text-xs text-muted-foreground">{fb.user_email}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {renderStars(fb.rating)}
          {fb.is_approved && (
            <Badge variant="outline" className="border-green-500/50 text-green-500 text-xs">
              Опубликован
            </Badge>
          )}
        </div>
      </div>

      {fb.photo_url && (
        <div 
          className="cursor-pointer"
          onClick={() => setSelectedImage(fb.photo_url)}
        >
          <img
            src={fb.photo_url}
            alt="Фото отзыва"
            className="w-full max-w-xs h-32 object-cover rounded-lg hover:opacity-90 transition-opacity"
          />
        </div>
      )}

      {fb.message && (
        <p className="text-sm text-foreground/80 bg-background/30 rounded-lg p-3">
          {fb.message}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          <span>
            {format(new Date(fb.created_at), "d MMMM yyyy, HH:mm", { locale: ru })}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {showModeration && fb.rating === 5 && fb.message && fb.name && (
            <>
              {!fb.is_approved ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleApprove(fb.id)}
                  className="border-green-500/50 text-green-500 hover:bg-green-500/10"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Опубликовать
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReject(fb.id)}
                  className="border-orange-500/50 text-orange-500 hover:bg-orange-500/10"
                >
                  <X className="w-4 h-4 mr-1" />
                  Скрыть
                </Button>
              )}
            </>
          )}
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
    </motion.div>
  );

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
          <h2 className="font-display text-xl">Отзывы и модерация</h2>
        </div>
        <Badge variant="secondary">{feedbacks.length} отзывов</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50">
          <TabsTrigger value="pending" className="relative">
            На модерации
            {pendingReviews.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                {pendingReviews.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">
            Опубликованы ({approvedReviews.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            Все ({allReviews.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {pendingReviews.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Нет отзывов на модерации
            </p>
          ) : (
            pendingReviews.map((fb) => renderFeedbackItem(fb, true))
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {approvedReviews.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Нет опубликованных отзывов
            </p>
          ) : (
            approvedReviews.map((fb) => renderFeedbackItem(fb, true))
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {allReviews.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Пока нет отзывов
            </p>
          ) : (
            allReviews.map((fb) => renderFeedbackItem(fb, true))
          )}
        </TabsContent>
      </Tabs>

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl p-0 bg-transparent border-none">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Фото отзыва"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FeedbackList;