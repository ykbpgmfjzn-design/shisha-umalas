import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Mail, Lock, ArrowLeft } from "lucide-react";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";
import { logActivity } from "@/hooks/useActivityLog";

const AuthContent = () => {
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  const authSchema = z.object({
    email: z.string().trim().email({ message: t("auth.invalidEmail") }),
    password: z.string().min(6, { message: t("auth.passwordMinLength") }),
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          navigate("/");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const validateForm = () => {
    try {
      authSchema.parse({ email, password });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0] === "email") fieldErrors.email = err.message;
          if (err.path[0] === "password") fieldErrors.password = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              variant: "destructive",
              title: t("auth.loginError"),
              description: t("auth.invalidCredentials"),
            });
          } else {
            toast({
              variant: "destructive",
              title: t("auth.error"),
              description: error.message,
            });
          }
          return;
        }

        // Log successful login
        logActivity('auth', 'Вход в систему', { email: email.trim() });

        toast({
          title: t("auth.welcome"),
          description: t("auth.loginSuccess"),
        });
      } else {
        const redirectUrl = `${window.location.origin}/`;
        
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              variant: "destructive",
              title: t("auth.signupError"),
              description: t("auth.userExists"),
            });
          } else {
            toast({
              variant: "destructive",
              title: t("auth.error"),
              description: error.message,
            });
          }
          return;
        }

        // Log signup
        logActivity('auth', 'Регистрация', { email: email.trim() });

        toast({
          title: t("auth.signupSuccess"),
          description: t("auth.checkEmail"),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("auth.error"),
        description: t("auth.somethingWrong"),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-golden/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-sunset/10 rounded-full blur-3xl" />
      </div>

      {/* Language Selector */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("auth.backToHome")}
        </Button>

        <div className="bg-card/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl text-foreground mb-2">
              {isLogin ? t("auth.loginTitle") : t("auth.signupTitle")}
            </h1>
            <p className="text-muted-foreground">
              {isLogin
                ? t("auth.loginSubtitle")
                : t("auth.signupSubtitle")}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {t("auth.email")}
              </label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/50 border-border/50"
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground flex items-center gap-2">
                <Lock className="w-4 h-4" />
                {t("auth.password")}
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background/50 border-border/50"
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-golden to-sunset hover:from-sunset hover:to-golden"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : isLogin ? (
                t("auth.loginButton")
              ) : (
                t("auth.signupButton")
              )}
            </Button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isLogin ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                }}
                className="text-golden hover:text-sunset transition-colors font-medium"
              >
                {isLogin ? t("auth.signupButton") : t("auth.loginButton")}
              </button>
            </p>
          </div>
        </div>

        {/* Note */}
        <p className="text-xs text-center text-muted-foreground mt-4">
          {t("auth.terms")}
        </p>
      </motion.div>
    </div>
  );
};

const Auth = () => {
  return (
    <LanguageProvider>
      <AuthContent />
    </LanguageProvider>
  );
};

export default Auth;