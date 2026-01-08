import { motion } from "framer-motion";
import { 
  Crown, Building2, Users, Plus, Hash, Calendar,
  Coffee, Cookie, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Profile } from "@/hooks/useProfile";
import type { PurchaseWithProfile } from "@/hooks/useAdmin";

interface UserDetailsProps {
  user: Profile | null;
  purchases: PurchaseWithProfile[];
  isAdmin: boolean;
  onAddPurchase: () => void;
}

const UserDetails = ({ user, purchases, isAdmin, onAddPurchase }: UserDetailsProps) => {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!user) {
    return (
      <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-6 flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
        <Users className="w-12 h-12 mb-4 opacity-50" />
        <p>Выберите пользователя</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-6"
    >
      {/* User Info */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl">{user.email}</h2>
            {isAdmin && (
              <Badge variant="outline" className="border-red-400 text-red-400">
                <Shield className="w-3 h-3 mr-1" />
                Админ
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {user.full_name || "Без имени"} • 
            {user.guest_type === "special" 
              ? ` Комната ${user.room_number}` 
              : " Гость"}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 text-golden">
            <Crown className="w-5 h-5" />
            <span className="text-2xl font-bold">Ур. {user.loyalty_level}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {user.total_hookahs_ordered} кальянов
          </p>
        </div>
      </div>

      {/* Add Purchase Button */}
      <Button
        onClick={onAddPurchase}
        className="w-full mb-6 bg-gradient-to-r from-golden to-sunset hover:from-sunset hover:to-golden"
      >
        <Plus className="w-4 h-4 mr-2" />
        Добавить покупку
      </Button>

      {/* Purchases List */}
      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
        <h3 className="font-medium text-sm text-muted-foreground mb-3">
          История заказов ({purchases.length})
        </h3>
        
        {purchases.map((purchase) => (
          <div
            key={purchase.id}
            className="p-4 rounded-xl bg-muted/30"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{purchase.hookah_count} кальян(ов)</span>
              </div>
              {purchase.amount && (
                <span className="text-golden font-medium">
                  IDR {purchase.amount.toLocaleString('id-ID')}
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
                  Напиток
                </div>
              )}
              {purchase.free_snack_used && (
                <div className="flex items-center gap-1 text-golden">
                  <Cookie className="w-3 h-3" />
                  Снек
                </div>
              )}
            </div>
            {purchase.notes && (
              <p className="text-xs text-muted-foreground mt-2">
                {purchase.notes}
              </p>
            )}
          </div>
        ))}

        {purchases.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Нет заказов
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default UserDetails;
