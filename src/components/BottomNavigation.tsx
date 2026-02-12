import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, CalendarDays, Star, Clock, User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useContext } from "react";
import { LanguageContext } from "@/contexts/LanguageContext";
import { useUserRoles } from "@/hooks/useUserRoles";

const BottomNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const context = useContext(LanguageContext);
  const { isAdmin, isAccounting, isShishaMaster } = useUserRoles();

  if (!context) return null;

  const { t } = context;

  const isStaff = isAdmin || isAccounting || isShishaMaster;

  const navItems = [
    { icon: Home, label: t("nav.home"), path: "/" },
    { icon: CalendarDays, label: t("nav.reservation"), path: "/reservation" },
    { icon: Star, label: t("nav.feedback"), path: "/feedback" },
    { icon: Clock, label: t("nav.history"), path: "/order-history" },
    ...(!isStaff ? [{ icon: User, label: t("nav.profile"), path: "/profile" }] : []),
  ];

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border/30 safe-area-bottom"
    >
      <div className="flex items-center justify-around py-2 px-4 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <motion.button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
                isActive
                  ? "text-golden"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                animate={{
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Icon className="w-5 h-5" />
              </motion.div>
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -bottom-0 w-8 h-0.5 bg-golden rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
};

export default BottomNavigation;
