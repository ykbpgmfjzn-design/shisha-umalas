import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User, LogOut, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";
import ProfileModal from "@/components/ProfileModal";

const AuthButton = () => {
  const { user, profile, loading } = useProfile();
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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
    }
  };

  if (loading) return null;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setProfileOpen(true)}
          className="text-foreground/80 hover:text-foreground hover:bg-foreground/10"
        >
          <Crown className="w-4 h-4 mr-2 text-golden" />
          {profile?.loyalty_level ? `Ур. ${profile.loyalty_level}` : "Профиль"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-foreground/80 hover:text-foreground hover:bg-foreground/10"
        >
          <LogOut className="w-4 h-4" />
        </Button>
        <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate("/auth")}
      className="text-foreground/80 hover:text-foreground hover:bg-foreground/10"
    >
      <User className="w-4 h-4 mr-2" />
      Войти
    </Button>
  );
};

export default AuthButton;
