import { forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, Crown, Shield, Calculator, Flame } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useLanguage } from "@/contexts/LanguageContext";

const AuthButton = forwardRef<HTMLDivElement>((_, ref) => {
  const { user, profile, loading } = useProfile();
  const { isAdmin, isAccounting, isShishaMaster, loading: rolesLoading } = useUserRoles();
  const languageContext = useLanguage();
  const navigate = useNavigate();

  // Fallback translations if context is not available
  const t = languageContext?.t || ((key: string) => {
    const fallbacks: Record<string, string> = {
      "auth.admin": "Admin",
      "auth.accounting": "Accounting",
      "auth.shishaMaster": "Shisha Master",
      "auth.level": "Lvl.",
      "auth.profile": "Profile",
      "auth.login": "Login",
    };
    return fallbacks[key] || key;
  });

  if (loading || rolesLoading) return null;

  if (user) {
    return (
      <div ref={ref} className="flex items-center gap-2">
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
        {isAccounting && !isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/accounting")}
            className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
          >
            <Calculator className="w-4 h-4 mr-2" />
            {t("auth.accounting")}
          </Button>
        )}
        {isShishaMaster && !isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/shisha-master")}
            className="text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
          >
            <Flame className="w-4 h-4 mr-2" />
            {t("auth.shishaMaster")}
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
    <div ref={ref}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/auth")}
        className="text-foreground/80 hover:text-foreground hover:bg-foreground/10"
      >
        <User className="w-4 h-4 mr-2" />
        {t("auth.login")}
      </Button>
    </div>
  );
});

AuthButton.displayName = "AuthButton";

export default AuthButton;
