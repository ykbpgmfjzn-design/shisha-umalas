import { motion } from "framer-motion";
import { Star, MessageSquare, User } from "lucide-react";
import { format } from "date-fns";

interface Feedback {
  id: string;
  rating: number;
  message: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

interface RecentFeedbackProps {
  feedbacks: Feedback[];
  maxItems?: number;
}

const RecentFeedback = ({ feedbacks, maxItems = 5 }: RecentFeedbackProps) => {
  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3 h-3 ${star <= rating ? "fill-golden text-golden" : "text-muted-foreground/40"}`}
        />
      ))}
    </div>
  );

  const recentFeedbacks = feedbacks.slice(0, maxItems);

  return (
    <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-golden" />
        <h3 className="font-medium text-sm">Recent Feedback</h3>
      </div>
      
      {recentFeedbacks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No feedback yet</p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {recentFeedbacks.map((fb, index) => (
            <motion.div
              key={fb.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-start gap-3 p-2 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
            >
              <div className="p-1.5 rounded-full bg-golden/20 shrink-0">
                <User className="w-3 h-3 text-golden" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-medium truncate">
                    {fb.user_email || fb.user_name || "Guest"}
                  </span>
                  {renderStars(fb.rating)}
                </div>
                
                {fb.message && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{fb.message}</p>
                )}
                
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {format(new Date(fb.created_at), "MMM d, HH:mm")}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentFeedback;
