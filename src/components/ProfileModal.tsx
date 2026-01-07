import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, X, Crown, Gift, Coffee, Cookie, Star, 
  Building2, Users, Sparkles, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProfileModal = ({ open, onOpenChange }: ProfileModalProps) => {
  const { 
    profile, 
    loyaltyLevels,
    updateRoomNumber, 
    getCurrentLevelInfo,
    getNextLevelInfo,
    getHookahsToNextLevel 
  } = useProfile();
  const { toast } = useToast();
  const [roomInput, setRoomInput] = useState(profile?.room_number || "");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

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

  if (!profile) return null;

  const progressPercent = nextLevel 
    ? Math.min(100, ((profile.total_hookahs_ordered - (currentLevel?.hookahs_required || 0)) / 
        ((nextLevel.hookahs_required) - (currentLevel?.hookahs_required || 0))) * 100)
    : 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border/50 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Crown className="w-6 h-6 text-golden" />
            Мой профиль
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Guest Type Badge */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-muted to-muted/50">
            <div className="flex items-center gap-3">
              {profile.guest_type === "special" ? (
                <div className="p-2 rounded-full bg-golden/20">
                  <Building2 className="w-5 h-5 text-golden" />
                </div>
              ) : (
                <div className="p-2 rounded-full bg-muted-foreground/20">
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-medium">
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
              <span className="px-3 py-1 rounded-full bg-golden/20 text-golden text-xs font-medium">
                Special
              </span>
            )}
          </div>

          {/* Room Number Editor */}
          <div className="space-y-3">
            <label className="text-sm text-muted-foreground">Номер комнаты в отеле</label>
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
                  size="sm"
                  className="bg-golden hover:bg-golden/90"
                >
                  {saving ? "..." : "Сохранить"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
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
                  className="flex-1 justify-start"
                  onClick={() => setIsEditing(true)}
                >
                  {profile.room_number || "Указать номер комнаты"}
                </Button>
                {profile.room_number && (
                  <Button
                    variant="ghost"
                    size="sm"
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
          <div className="space-y-4 p-4 rounded-xl bg-gradient-to-br from-golden/10 to-sunset/10 border border-golden/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-golden" />
                <span className="font-display text-lg">{currentLevel?.name_ru || "Новичок"}</span>
              </div>
              <span className="text-2xl font-bold text-golden">Ур. {profile.loyalty_level}</span>
            </div>

            {/* Progress Bar */}
            {nextLevel && (
              <div className="space-y-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-gradient-to-r from-golden to-sunset rounded-full"
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{profile.total_hookahs_ordered} кальянов</span>
                  <span>До {nextLevel.name_ru}: {hookahsToNext} кальянов</span>
                </div>
              </div>
            )}

            {/* Current Benefits */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Ваши привилегии:</p>
              <div className="grid gap-2">
                {currentLevel && currentLevel.discount_percent > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Gift className="w-4 h-4 text-golden" />
                    <span>Скидка {currentLevel.discount_percent}% на заказы</span>
                  </div>
                )}
                {currentLevel?.free_drink && (
                  <div className="flex items-center gap-2 text-sm">
                    <Coffee className="w-4 h-4 text-golden" />
                    <span>Бесплатный напиток</span>
                  </div>
                )}
                {currentLevel?.free_snack && (
                  <div className="flex items-center gap-2 text-sm">
                    <Cookie className="w-4 h-4 text-golden" />
                    <span>Бесплатный снек</span>
                  </div>
                )}
                {currentLevel?.special_bonus && (
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-golden" />
                    <span>{currentLevel.special_bonus}</span>
                  </div>
                )}
                {profile.guest_type === "special" && (
                  <div className="flex items-center gap-2 text-sm text-sunset">
                    <Building2 className="w-4 h-4" />
                    <span>Дополнительные угощения для гостей отеля</span>
                  </div>
                )}
                {(!currentLevel || currentLevel.discount_percent === 0) && profile.guest_type !== "special" && (
                  <p className="text-sm text-muted-foreground">
                    Закажите 30 кальянов для получения скидки
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* All Levels Preview */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Все уровни:</p>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {loyaltyLevels.map((level) => (
                <div
                  key={level.level}
                  className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                    level.level === profile.loyalty_level
                      ? "bg-golden/20 border border-golden/30"
                      : level.level < profile.loyalty_level
                      ? "bg-muted/50 text-muted-foreground"
                      : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-center font-bold">{level.level}</span>
                    <span>{level.name_ru}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {level.discount_percent > 0 && (
                      <span className="text-golden">-{level.discount_percent}%</span>
                    )}
                    {level.free_drink && <Coffee className="w-3 h-3" />}
                    {level.free_snack && <Cookie className="w-3 h-3" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileModal;
