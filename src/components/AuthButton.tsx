import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, Crown, Shield } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useLanguage } from "@/contexts/LanguageContext";

const AuthButton = () => {
  const { user, profile, loading } = useProfile();
  const { isAdmin } = useIsAdmin();
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (loading) return null;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin")}
            className="text-golden hover:text-golden hover:bg-golden/10"
          >
            <Shield className="w-4 h-4 mr-2" />
            {t("auth.admin")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/profile")}
          className="text-foreground/80 hover:text-foreground hover:bg-foreground/10"
        >
          <Crown className="w-4 h-4 mr-2 text-golden" />
          {profile?.loyalty_level ? `${t("auth.level")} ${profile.loyalty_level}` : t("auth.profile")}
        </Button>
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
      {t("auth.login")}
    </Button>
  );
};

export default AuthButton;
