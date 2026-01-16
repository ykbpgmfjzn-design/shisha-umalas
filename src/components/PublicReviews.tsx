import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Quote, User, ChevronDown, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface Review {
  id: string;
  name: string;
  message: string;
  photo_url: string | null;
  created_at: string;
}

const REVIEWS_PER_PAGE = 6;

const PublicReviews = () => {
  const { t } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(REVIEWS_PER_PAGE);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      // Get total count
      const { count } = await supabase
        .from("feedback")
        .select("*", { count: "exact", head: true })
        .eq("rating", 5)
        .not("message", "is", null)
        .not("name", "is", null);

      setTotalCount(count || 0);

      // Get reviews
      const { data, error } = await supabase
        .from("feedback")
        .select("id, name, message, photo_url, created_at")
        .eq("rating", 5)
        .not("message", "is", null)
        .not("name", "is", null)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setReviews(data as Review[]);
      }
      setLoading(false);
    };

    fetchReviews();
  }, []);

  const handleShowMore = () => {
    setVisibleCount((prev) => prev + REVIEWS_PER_PAGE);
  };

  if (loading) {
    return null;
  }

  if (reviews.length === 0) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const visibleReviews = reviews.slice(0, visibleCount);
  const hasMore = visibleCount < reviews.length;

  return (
    <section className="py-16 px-4 bg-gradient-to-b from-card/50 to-background">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-3xl md:text-4xl text-golden mb-3">
            {t("reviews.title")}
          </h2>
          <p className="text-muted-foreground">
            {t("reviews.subtitle")} ({totalCount} {t("reviews.reviewsCount")})
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {visibleReviews.map((review, index) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index < REVIEWS_PER_PAGE ? index * 0.1 : 0 }}
                layout
                className="relative bg-card/80 backdrop-blur-sm border border-golden/20 rounded-2xl p-6 shadow-lg hover:border-golden/40 transition-colors"
              >
                {/* Quote icon */}
                <Quote className="absolute top-4 right-4 w-8 h-8 text-golden/20" />
                
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className="w-4 h-4 fill-golden text-golden"
                    />
                  ))}
                </div>

                {/* Photo */}
                {review.photo_url && (
                  <div 
                    className="mb-4 cursor-pointer overflow-hidden rounded-xl"
                    onClick={() => setSelectedImage(review.photo_url)}
                  >
                    <img
                      src={review.photo_url}
                      alt="Review photo"
                      className="w-full h-40 object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}

                {/* Message */}
                <p className="text-foreground/90 text-sm leading-relaxed mb-6 line-clamp-4">
                  "{review.message}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4 border-t border-golden/10">
                  <div className="w-10 h-10 rounded-full bg-golden/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-golden" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{review.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(review.created_at)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Show More Button */}
        {hasMore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center mt-10"
          >
            <Button
              onClick={handleShowMore}
              variant="outline"
              className="border-golden/30 text-golden hover:bg-golden/10 hover:border-golden/50 px-8 py-6 text-base"
            >
              <ChevronDown className="w-5 h-5 mr-2" />
              {t("reviews.showMore")} ({reviews.length - visibleCount} {t("reviews.remaining")})
            </Button>
          </motion.div>
        )}
      </div>

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl p-0 bg-transparent border-none">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Review photo"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default PublicReviews;
