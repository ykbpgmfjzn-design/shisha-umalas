import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, Shield, Users, Plus, Search, 
  Crown, Building2, Coffee, Cookie, Gift,
  Calendar, Hash, LogOut
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAdmin } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import OrderNotifications from "@/components/OrderNotifications";
import type { Profile } from "@/hooks/useProfile";
import type { Purchase } from "@/hooks/usePurchases";

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    isAdmin, 
    loading, 
    profiles, 
    allPurchases,
    fetchAllProfiles, 
    fetchUserPurchases,
    addPurchase 
  } = useAdmin();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    hookahCount: 1,
    amount: "",
    notes: "",
    freeDrink: false,
    freeSnack: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast({
        variant: "destructive",
        title: "Доступ запрещён",
        description: "У вас нет прав администратора",
      });
      navigate("/");
    }
  }, [isAdmin, loading, navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      fetchAllProfiles();
    }
  }, [isAdmin, fetchAllProfiles]);

  useEffect(() => {
    if (selectedUser) {
      fetchUserPurchases(selectedUser.id);
    }
  }, [selectedUser, fetchUserPurchases]);

  const filteredProfiles = profiles.filter(p => 
    p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.room_number?.includes(searchQuery)
  );

  const handleAddPurchase = async () => {
    if (!selectedUser) return;

    setSaving(true);
    const { error } = await addPurchase(
      selectedUser.id,
      purchaseForm.hookahCount,
      purchaseForm.amount ? parseFloat(purchaseForm.amount) : undefined,
      0,
      purchaseForm.freeDrink,
      purchaseForm.freeSnack,
      purchaseForm.notes || undefined
    );
    setSaving(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось добавить покупку",
      });
    } else {
      toast({
        title: "Покупка добавлена!",
        description: `Добавлено ${purchaseForm.hookahCount} кальян(ов)`,
      });
      setShowAddPurchase(false);
      setPurchaseForm({ hookahCount: 1, amount: "", notes: "", freeDrink: false, freeSnack: false });
      fetchUserPurchases(selectedUser.id);
      fetchAllProfiles(); // Refresh to get updated loyalty level
    }
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

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-golden/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-sunset/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            На главную
          </Button>
          <div className="flex items-center gap-4">
            <div className="relative">
              <OrderNotifications />
            </div>
            <div className="flex items-center gap-2 text-golden">
              <Shield className="w-5 h-5" />
              <span className="font-medium">Админ панель</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/");
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Выйти
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Users List */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-golden" />
              <h2 className="font-display text-xl">Пользователи</h2>
              <span className="ml-auto text-sm text-muted-foreground">
                {profiles.length} всего
              </span>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по email, имени или комнате..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50"
              />
            </div>

            {/* User List */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
              {filteredProfiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => setSelectedUser(profile)}
                  className={`w-full text-left p-4 rounded-xl transition-all ${
                    selectedUser?.id === profile.id
                      ? "bg-golden/20 border border-golden/30"
                      : "bg-muted/30 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        profile.guest_type === "special" 
                          ? "bg-golden/20" 
                          : "bg-muted"
                      }`}>
                        {profile.guest_type === "special" 
                          ? <Building2 className="w-4 h-4 text-golden" />
                          : <Users className="w-4 h-4 text-muted-foreground" />
                        }
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {profile.email || "Без email"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {profile.room_number ? `Комната ${profile.room_number}` : "Гость"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-golden" />
                      <span className="text-sm font-bold">{profile.loyalty_level}</span>
                    </div>
                  </div>
                </button>
              ))}

              {filteredProfiles.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Пользователи не найдены
                </p>
              )}
            </div>
          </motion.div>

          {/* User Details & Purchases */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-6"
          >
            {selectedUser ? (
              <>
                {/* User Info */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-display text-xl">{selectedUser.email}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedUser.full_name || "Без имени"} • 
                      {selectedUser.guest_type === "special" 
                        ? ` Комната ${selectedUser.room_number}` 
                        : " Гость"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-golden">
                      <Crown className="w-5 h-5" />
                      <span className="text-2xl font-bold">Ур. {selectedUser.loyalty_level}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedUser.total_hookahs_ordered} кальянов
                    </p>
                  </div>
                </div>

                {/* Add Purchase Button */}
                <Button
                  onClick={() => setShowAddPurchase(true)}
                  className="w-full mb-6 bg-gradient-to-r from-golden to-sunset hover:from-sunset hover:to-golden"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить покупку
                </Button>

                {/* Purchases List */}
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                  <h3 className="font-medium text-sm text-muted-foreground mb-3">
                    История заказов ({allPurchases.length})
                  </h3>
                  
                  {allPurchases.map((purchase) => (
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
                            {purchase.amount.toLocaleString()} ₽
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

                  {allPurchases.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Нет заказов
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
                <Users className="w-12 h-12 mb-4 opacity-50" />
                <p>Выберите пользователя</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Add Purchase Dialog */}
      <Dialog open={showAddPurchase} onOpenChange={setShowAddPurchase}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Добавить покупку
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Количество кальянов</label>
              <Input
                type="number"
                min={1}
                value={purchaseForm.hookahCount}
                onChange={(e) => setPurchaseForm(f => ({ ...f, hookahCount: parseInt(e.target.value) || 1 }))}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Сумма (₽)</label>
              <Input
                type="number"
                placeholder="Необязательно"
                value={purchaseForm.amount}
                onChange={(e) => setPurchaseForm(f => ({ ...f, amount: e.target.value }))}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Заметка</label>
              <Input
                placeholder="Необязательно"
                value={purchaseForm.notes}
                onChange={(e) => setPurchaseForm(f => ({ ...f, notes: e.target.value }))}
                className="bg-background/50"
              />
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={purchaseForm.freeDrink}
                  onChange={(e) => setPurchaseForm(f => ({ ...f, freeDrink: e.target.checked }))}
                  className="rounded"
                />
                <Coffee className="w-4 h-4 text-golden" />
                <span className="text-sm">Бесплатный напиток</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={purchaseForm.freeSnack}
                  onChange={(e) => setPurchaseForm(f => ({ ...f, freeSnack: e.target.checked }))}
                  className="rounded"
                />
                <Cookie className="w-4 h-4 text-golden" />
                <span className="text-sm">Бесплатный снек</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddPurchase(false)}>
              Отмена
            </Button>
            <Button 
              onClick={handleAddPurchase}
              disabled={saving}
              className="bg-golden hover:bg-golden/90"
            >
              {saving ? "Сохранение..." : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
