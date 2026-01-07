import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, Crown, Gift, Coffee, Cookie, Star, 
  Building2, Users, Sparkles, X, LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    user,
    profile, 
    loyaltyLevels,
    loading,
    updateRoomNumber, 
    getCurrentLevelInfo,
    getNextLevelInfo,
    getHookahsToNextLevel 
  } = useProfile();
  
  const [roomInput, setRoomInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile?.room_number) {
      setRoomInput(profile.room_number);
    }
  }, [profile]);

  const currentLevel = getCurrentLevelInfo();
  const nextLevel = getNextLevelInfo();
  const hookahsToNext = getHookahsToNextLevel();

  const handleSaveRoom = async () => {
    setSaving(true);
    const { error } = await updateRoomNumber(roomInput.trim() || null);
    setSaving(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось сохранить номер комнаты",
      });
    } else {
      toast({
        title: roomInput.trim() ? "Статус обновлён!" : "Статус изменён",
        description: roomInput.trim() 
          ? "Вы получили статус Special гостя отеля!" 
          : "Вы теперь обычный гость",
      });
      setIsEditing(false);
    }
  };

  const handleClearRoom = async () => {
    setSaving(true);
    const { error } = await updateRoomNumber(null);
    setSaving(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить статус",
      });
    } else {
      setRoomInput("");
      toast({
        title: "Статус изменён",
        description: "Вы теперь обычный гость",
      });
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось выйти из системы",
      });
    } else {
      toast({
        title: "До свидания!",
        description: "Вы вышли из системы",
      });
      navigate("/");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-2 border-golden/30 border-t-golden rounded-full"
        />
      </div>
    );
  }

  if (!profile) return null;

  const progressPercent = nextLevel 
    ? Math.min(100, ((profile.total_hookahs_ordered - (currentLevel?.hookahs_required || 0)) / 
        ((nextLevel.hookahs_required) - (currentLevel?.hookahs_required || 0))) * 100)
    : 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-golden/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-sunset/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Выйти
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Title */}
          <div className="text-center mb-8">
            <Crown className="w-12 h-12 text-golden mx-auto mb-4" />
            <h1 className="font-display text-3xl text-foreground mb-2">Мой профиль</h1>
            <p className="text-muted-foreground">{profile.email}</p>
          </div>

          {/* Guest Type Badge */}
          <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {profile.guest_type === "special" ? (
                  <div className="p-3 rounded-full bg-golden/20">
                    <Building2 className="w-6 h-6 text-golden" />
                  </div>
                ) : (
                  <div className="p-3 rounded-full bg-muted-foreground/20">
                    <Users className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-lg">
                    {profile.guest_type === "special" ? "Гость отеля" : "Гость"}
                  </p>
                  {profile.room_number && (
                    <p className="text-sm text-muted-foreground">
                      Комната {profile.room_number}
                    </p>
                  )}
                </div>
              </div>
              {profile.guest_type === "special" && (
                <span className="px-4 py-2 rounded-full bg-golden/20 text-golden text-sm font-medium">
                  Special
                </span>
              )}
            </div>
          </div>

          {/* Room Number Editor */}
          <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-6 space-y-4">
            <label className="text-sm text-muted-foreground font-medium">Номер комнаты в отеле</label>
            {isEditing ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Например: 205"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  className="bg-background/50"
                />
                <Button
                  onClick={handleSaveRoom}
                  disabled={saving}
                  className="bg-golden hover:bg-golden/90"
                >
                  {saving ? "..." : "Сохранить"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false);
                    setRoomInput(profile.room_number || "");
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 justify-start h-12"
                  onClick={() => setIsEditing(true)}
                >
                  {profile.room_number || "Указать номер комнаты"}
                </Button>
                {profile.room_number && (
                  <Button
                    variant="ghost"
                    onClick={handleClearRoom}
                    disabled={saving}
                    className="text-muted-foreground"
                  >
                    Я не гость отеля
                  </Button>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {profile.guest_type === "special" 
                ? "✨ Как гость отеля вы получаете дополнительные угощения!" 
                : "Укажите номер комнаты для получения статуса Special и дополнительных бонусов"}
            </p>
          </div>

          {/* Loyalty Level */}
          <div className="bg-gradient-to-br from-golden/10 to-sunset/10 rounded-2xl border border-golden/20 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Star className="w-6 h-6 text-golden" />
                <span className="font-display text-xl">{currentLevel?.name_ru || "Новичок"}</span>
              </div>
              <span className="text-3xl font-bold text-golden">Ур. {profile.loyalty_level}</span>
            </div>

            {/* Progress Bar */}
            {nextLevel && (
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-gradient-to-r from-golden to-sunset rounded-full"
                  />
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{profile.total_hookahs_ordered} кальянов</span>
                  <span>До {nextLevel.name_ru}: {hookahsToNext}</span>
                </div>
              </div>
            )}

            {/* Current Benefits */}
            <div className="space-y-3">
              <p className="font-medium">Ваши привилегии:</p>
              <div className="grid gap-3">
                {currentLevel && currentLevel.discount_percent > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-background/50">
                    <Gift className="w-5 h-5 text-golden" />
                    <span>Скидка {currentLevel.discount_percent}% на заказы</span>
                  </div>
                )}
                {currentLevel?.free_drink && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-background/50">
                    <Coffee className="w-5 h-5 text-golden" />
                    <span>Бесплатный напиток</span>
                  </div>
                )}
                {currentLevel?.free_snack && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-background/50">
                    <Cookie className="w-5 h-5 text-golden" />
                    <span>Бесплатный снек</span>
                  </div>
                )}
                {currentLevel?.special_bonus && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-background/50">
                    <Sparkles className="w-5 h-5 text-golden" />
                    <span>{currentLevel.special_bonus}</span>
                  </div>
                )}
                {profile.guest_type === "special" && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-sunset/10 text-sunset">
                    <Building2 className="w-5 h-5" />
                    <span>Дополнительные угощения для гостей отеля</span>
                  </div>
                )}
                {(!currentLevel || currentLevel.discount_percent === 0) && profile.guest_type !== "special" && (
                  <p className="text-sm text-muted-foreground p-3">
                    Закажите 30 кальянов для получения скидки
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* All Levels Preview */}
          <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-6 space-y-4">
            <p className="font-medium">Все уровни:</p>
            <div className="space-y-2">
              {loyaltyLevels.map((level) => (
                <div
                  key={level.level}
                  className={`flex items-center justify-between p-3 rounded-xl text-sm transition-all ${
                    level.level === profile.loyalty_level
                      ? "bg-golden/20 border border-golden/30 scale-[1.02]"
                      : level.level < profile.loyalty_level
                      ? "bg-muted/50 text-muted-foreground"
                      : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 flex items-center justify-center rounded-full bg-background/50 font-bold">
                      {level.level}
                    </span>
                    <span>{level.name_ru}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {level.discount_percent > 0 && (
                      <span className="text-golden font-medium">-{level.discount_percent}%</span>
                    )}
                    {level.free_drink && <Coffee className="w-4 h-4" />}
                    {level.free_snack && <Cookie className="w-4 h-4" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
