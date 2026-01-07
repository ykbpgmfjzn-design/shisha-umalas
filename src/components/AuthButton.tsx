import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, Crown } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";

const AuthButton = () => {
  const { user, profile, loading } = useProfile();
  const navigate = useNavigate();

  if (loading) return null;

  if (user) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/profile")}
        className="text-foreground/80 hover:text-foreground hover:bg-foreground/10"
      >
        <Crown className="w-4 h-4 mr-2 text-golden" />
        {profile?.loyalty_level ? `Ур. ${profile.loyalty_level}` : "Профиль"}
      </Button>
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
