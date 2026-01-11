import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, Crown, Gift, Coffee, Cookie, Star, 
  Building2, Users, Sparkles, X, LogOut, Calendar, Hash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/useProfile";
import { usePurchases } from "@/hooks/usePurchases";
import { useToast } from "@/hooks/use-toast";
import { useLogout } from "@/hooks/useLogout";
import { useLanguage } from "@/contexts/LanguageContext";
import UserReservations from "@/components/profile/UserReservations";
import LanguageSelector from "@/components/LanguageSelector";
import BottomNavigation from "@/components/BottomNavigation";

const Profile = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useLanguage();
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
  const { purchases, loading: purchasesLoading } = usePurchases(user?.id);
  const { logout } = useLogout();
  
  const [roomInput, setRoomInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const roomInputRef = useRef<HTMLInputElement>(null);

  const shouldReturnToCart = searchParams.get('returnToCart') === 'true';

  // Handle focus=room query param from cart redirect
  useEffect(() => {
    if (searchParams.get('focus') === 'room' && !loading && profile) {
      setIsEditing(true);
    }
  }, [searchParams, loading, profile]);

  // Auto-focus room input when editing starts
  useEffect(() => {
    if (isEditing && roomInputRef.current) {
      roomInputRef.current.focus();
    }
  }, [isEditing]);

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
        title: t("profile.error"),
        description: t("profile.saveError"),
      });
    } else {
      toast({
        title: roomInput.trim() ? t("profile.roomUpdated") : t("profile.statusChanged"),
        description: roomInput.trim() 
          ? shouldReturnToCart 
            ? t("profile.nowYouCanOrder") 
            : t("profile.roomUpdatedDesc") 
          : t("profile.nowRegularGuest"),
      });
      setIsEditing(false);
      
      // Return to cart if came from order flow
      if (shouldReturnToCart && roomInput.trim()) {
        navigate('/?openCart=true');
      }
    }
  };

  const handleClearRoom = async () => {
    setSaving(true);
    const { error } = await updateRoomNumber(null);
    setSaving(false);

    if (error) {
      toast({
        variant: "destructive",
        title: t("profile.error"),
        description: t("profile.saveError"),
      });
    } else {
      setRoomInput("");
      toast({
        title: t("profile.statusChanged"),
        description: t("profile.nowRegularGuest"),
      });
    }
  };

  const handleLogout = async () => {
    await logout();
    toast({
      title: t("profile.goodbye"),
      description: t("profile.loggedOut"),
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  if (!profile) {
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

  const progressPercent = nextLevel 
    ? Math.min(100, ((profile.total_hookahs_ordered - (currentLevel?.hookahs_required || 0)) / 
        ((nextLevel.hookahs_required) - (currentLevel?.hookahs_required || 0))) * 100)
    : 100;

  return (
    <div className="min-h-screen bg-background pb-20">
      <LanguageSelector />
      
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-golden/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-sunset/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-24 pb-8">
        {/* Header */}
        <div className="flex items-center justify-end mb-8">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {t("admin.logout")}
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
            <h1 className="font-display text-3xl text-foreground mb-2">{t("nav.profile")}</h1>
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
                    {profile.guest_type === "special" ? t("profile.hotelGuest") : t("profile.guest")}
                  </p>
                  {profile.room_number && (
                    <p className="text-sm text-muted-foreground">
                      {t("profile.room")} {profile.room_number}
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
            <label className="text-sm text-muted-foreground font-medium">{t("profile.roomNumber")}</label>
            {isEditing ? (
              <div className="flex gap-2">
                <Input
                  ref={roomInputRef}
                  placeholder={t("profile.roomPlaceholder")}
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  className="bg-background/50"
                />
                <Button
                  onClick={handleSaveRoom}
                  disabled={saving}
                  className="bg-golden hover:bg-golden/90"
                >
                  {saving ? "..." : t("profile.save")}
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
                  {profile.room_number || t("profile.specifyRoom")}
                </Button>
                {profile.room_number && (
                  <Button
                    variant="ghost"
                    onClick={handleClearRoom}
                    disabled={saving}
                    className="text-muted-foreground"
                  >
                    {t("profile.notHotelGuest")}
                  </Button>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {profile.guest_type === "special" 
                ? t("profile.specialBenefits") 
                : t("profile.specifyForBenefits")}
            </p>
          </div>

          {/* User Reservations */}
          <UserReservations />

          {/* Loyalty Level */}
          <div className="bg-gradient-to-br from-golden/10 to-sunset/10 rounded-2xl border border-golden/20 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Star className="w-6 h-6 text-golden" />
                <span className="font-display text-xl">{currentLevel?.name_en || "Beginner"}</span>
              </div>
              <span className="text-3xl font-bold text-golden">{t("profile.level")} {profile.loyalty_level}</span>
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
                  <span>{profile.total_hookahs_ordered} {t("profile.hookahs")}</span>
                  <span>{t("profile.toNextLevel")} {nextLevel.name_en}: {hookahsToNext}</span>
                </div>
              </div>
            )}

            {/* Current Benefits */}
            <div className="space-y-3">
              <p className="font-medium">{t("profile.yourPrivileges")}</p>
              <div className="grid gap-3">
                {currentLevel && currentLevel.discount_percent > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-background/50">
                    <Gift className="w-5 h-5 text-golden" />
                    <span>{currentLevel.discount_percent}% {t("profile.discount")}</span>
                  </div>
                )}
                {currentLevel?.free_drink && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-background/50">
                    <Coffee className="w-5 h-5 text-golden" />
                    <span>{t("profile.freeDrink")}</span>
                  </div>
                )}
                {currentLevel?.free_snack && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-background/50">
                    <Cookie className="w-5 h-5 text-golden" />
                    <span>{t("profile.freeSnack")}</span>
                  </div>
                )}
                {currentLevel?.special_bonus && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-background/50">
                    <Sparkles className="w-5 h-5 text-golden" />
                    <span>{currentLevel.special_bonus}</span>
                  </div>
                )}
                {(!currentLevel || currentLevel.discount_percent === 0) && (
                  <p className="text-sm text-muted-foreground p-3">
                    {t("profile.orderFor30")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Purchase History */}
          <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{t("profile.orderHistory")}</p>
              <span className="text-sm text-muted-foreground">{purchases.length} {t("profile.orders")}</span>
            </div>
            
            {purchasesLoading ? (
              <div className="flex justify-center py-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-6 h-6 border-2 border-golden/30 border-t-golden rounded-full"
                />
              </div>
            ) : purchases.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {purchases.map((purchase) => {
                  // Parse notes to get item names (first line before any invoice info)
                  const notesLines = (purchase.notes || "").split("\n");
                  const itemsLine = notesLines[0]?.includes("Invoice") ? null : notesLines[0];
                  
                  return (
                    <div
                      key={purchase.id}
                      className="p-4 rounded-xl bg-muted/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          {itemsLine ? (
                            <span className="font-medium text-foreground">{itemsLine}</span>
                          ) : purchase.hookah_count > 0 ? (
                            <div className="flex items-center gap-2">
                              <Hash className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{purchase.hookah_count} {t("profile.hookahCount")}</span>
                            </div>
                          ) : (
                            <span className="font-medium text-muted-foreground">{t("menu.extras")}</span>
                          )}
                        </div>
                        {purchase.amount && (
                          <span className="text-golden font-medium">
                            IDR {(purchase.amount / 1000).toFixed(0)}K
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(purchase.created_at)}
                        </div>
                        {purchase.free_drink_used && (
                          <div className="flex items-center gap-1 text-golden">
                            <Coffee className="w-3 h-3" />
                            {t("profile.freeDrink")}
                          </div>
                        )}
                        {purchase.free_snack_used && (
                          <div className="flex items-center gap-1 text-golden">
                            <Cookie className="w-3 h-3" />
                            {t("profile.freeSnack")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                {t("profile.noOrdersYet")}
              </p>
            )}
          </div>

          {/* All Levels Preview */}
          <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-6 space-y-4">
            <p className="font-medium">{t("profile.allLevels")}</p>
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
                    <span>{level.name_en}</span>
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
      <BottomNavigation />
    </div>
  );
};

export default Profile;
