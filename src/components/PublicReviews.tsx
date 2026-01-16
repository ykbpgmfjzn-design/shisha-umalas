import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, Quote, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface Review {
  id: string;
  name: string;
  message: string;
  created_at: string;
}

const PublicReviews = () => {
  const { t } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      const { data, error } = await supabase
        .from("feedback")
        .select("id, name, message, created_at")
        .eq("rating", 5)
        .not("message", "is", null)
        .not("name", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        setReviews(data as Review[]);
      }
      setLoading(false);
    };

    fetchReviews();
  }, []);

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
            {t("reviews.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((review, index) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
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
        </div>
      </div>
    </section>
  );
};

export default PublicReviews;
