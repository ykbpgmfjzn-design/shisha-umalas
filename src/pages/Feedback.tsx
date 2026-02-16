import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Star, Send, User, Camera, X, Loader2 } from "lucide-react";
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
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t("feedback.photoTooLarge"));
        return;
      }
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photo || !userId) return null;

    setIsUploading(true);
    const fileExt = photo.name.split(".").pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("feedback-photos")
      .upload(fileName, photo);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      setIsUploading(false);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("feedback-photos")
      .getPublicUrl(fileName);

    setIsUploading(false);
    return publicUrl;
  };

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

    let photoUrl: string | null = null;
    if (photo && userId) {
      photoUrl = await uploadPhoto();
    }

    // For anonymous users, skip .select() since RLS won't allow reading back the row
    let insertedFeedbackId: string | null = null;
    let insertError: any = null;

    if (userId) {
      const { data, error: err } = await supabase.from("feedback").insert({
        user_id: userId,
        rating,
        message: feedback || null,
        name: name.trim(),
        photo_url: photoUrl,
      }).select('id').single();
      insertedFeedbackId = data?.id ?? null;
      insertError = err;
    } else {
      const { error: err } = await supabase.from("feedback").insert({
        user_id: null,
        rating,
        message: feedback || null,
        name: name.trim(),
        photo_url: photoUrl,
      });
      insertError = err;
    }
    
    const error = insertError;
    if (error) {
      toast.error("Error submitting feedback");
      console.error(error);
    } else {
      // Send Telegram notification
      try {
        await supabase.functions.invoke('send-telegram-notification', {
          body: {
            type: 'feedback',
            feedbackId: insertedFeedbackId,
            feedbackName: name.trim(),
            feedbackRating: rating,
            feedbackMessage: feedback || null,
            feedbackPhotoUrl: photoUrl,
          }
        });
      } catch (telegramError) {
        console.error('Failed to send Telegram notification:', telegramError);
      }

      // Only log activity if user is logged in (activity_logs requires auth)
      if (userId) {
        await logActivity('feedback', 'Feedback submitted', {
          rating,
          has_message: !!feedback,
          has_photo: !!photoUrl,
        });
      }
      
      if (rating === 5) {
        toast.success(t("feedback.thankYouRedirect"));
        setTimeout(() => {
          window.location.href = "https://g.page/r/CWUVTUf3-kd2EBM/review";
        }, 1500);
      } else {
        toast.success(t("feedback.thankYou"));
      }
      
      setRating(0);
      setFeedback("");
      setName("");
      removePhoto();
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
                  className="p-3"
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
              className="bg-card/50 border-golden/30 focus:border-golden min-h-[120px]"
            />
          </section>

          {/* Photo Upload */}
          <section className="space-y-4">
            <h2 className="font-display text-xl text-foreground flex items-center gap-2">
              <Camera className="w-5 h-5 text-golden" />
              {t("feedback.addPhoto")}
            </h2>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {!photoPreview ? (
              <motion.button
                onClick={() => fileInputRef.current?.click()}
                whileTap={{ scale: 0.98 }}
                className="w-full h-32 border-2 border-dashed border-golden/30 rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-golden/50 hover:bg-golden/5 transition-colors"
                disabled={!userId}
              >
                <Camera className="w-8 h-8" />
                <span className="text-sm">
                  {userId ? t("feedback.tapToAddPhoto") : t("feedback.loginToAddPhoto")}
                </span>
              </motion.button>
            ) : (
              <div className="relative">
                <img
                  loading="lazy" src={photoPreview}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-xl"
                />
                <button
                  onClick={removePhoto}
                  className="absolute top-2 right-2 p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
                >
                  <X className="w-5 h-5 text-foreground" />
                </button>
              </div>
            )}
          </section>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isUploading}
            className="w-full h-14 bg-golden hover:bg-golden/90 text-primary-foreground font-semibold text-lg rounded-xl shadow-lg"
          >
            {(isSubmitting || isUploading) ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Send className="w-5 h-5 mr-2" />
            )}
            {isUploading ? t("feedback.uploading") : isSubmitting ? t("feedback.submitting") : t("feedback.submit")}
          </Button>
        </motion.div>
      </div>

      <BottomNavigation />
    </main>
  );
};

export default Feedback;
