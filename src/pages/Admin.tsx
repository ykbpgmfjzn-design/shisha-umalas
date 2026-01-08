import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, Shield, Plus, LogOut,
  LayoutDashboard, ClipboardList, Users, Coffee, Cookie, MessageSquare
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAdmin } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";
import OrderNotifications from "@/components/OrderNotifications";
import DashboardStats from "@/components/admin/DashboardStats";
import OrdersTable from "@/components/admin/OrdersTable";
import UsersTable from "@/components/admin/UsersTable";
import UserDetails from "@/components/admin/UserDetails";
import DeliverySettings from "@/components/admin/DeliverySettings";
import FeedbackList from "@/components/admin/FeedbackList";
import type { Profile } from "@/hooks/useProfile";

const AdminContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const {
    isAdmin, 
    loading, 
    profiles, 
    allPurchases,
    userPurchases,
    allUserRoles,
    stats,
    fetchAllProfiles, 
    fetchAllPurchases,
    fetchUserPurchases,
    fetchAllUserRoles,
    addUserRole,
    removeUserRole,
    updatePurchaseStatus,
    addPurchase 
  } = useAdmin();

  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [feedbackStats, setFeedbackStats] = useState({ count: 0, avgRating: 0 });
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
      fetchAllPurchases();
      fetchAllUserRoles();
    }
  }, [isAdmin, fetchAllProfiles, fetchAllPurchases, fetchAllUserRoles]);

  useEffect(() => {
    if (selectedUser) {
      fetchUserPurchases(selectedUser.id);
    }
  }, [selectedUser, fetchUserPurchases]);

  // Auto-refresh orders every 30 seconds
  useEffect(() => {
    if (!isAdmin) return;
    
    const interval = setInterval(() => {
      fetchAllPurchases();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAdmin, fetchAllPurchases]);

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
      fetchAllPurchases();
      fetchAllProfiles();
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await updatePurchaseStatus(orderId, status);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить статус",
      });
    } else {
      toast({
        title: "Статус обновлён",
        description: status === "PAID" ? "Заказ отмечен как оплаченный" : "Заказ отменён",
      });
      fetchAllPurchases();
    }
  };

  const handleToggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    if (isCurrentlyAdmin) {
      const { error } = await removeUserRole(userId, "admin");
      if (error) {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Не удалось убрать роль администратора",
        });
      } else {
        toast({
          title: "Роль удалена",
          description: "Пользователь больше не администратор",
        });
        fetchAllUserRoles();
      }
    } else {
      const { error } = await addUserRole(userId, "admin");
      if (error) {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Не удалось добавить роль администратора",
        });
      } else {
        toast({
          title: "Роль добавлена",
          description: "Пользователь теперь администратор",
        });
        fetchAllUserRoles();
      }
    }
  };

  const isUserAdmin = (userId: string) => {
    return allUserRoles.some(r => r.user_id === userId && r.role === "admin");
  };

  // Get pending orders for "Current Orders" view
  const pendingOrders = allPurchases.filter(p => p.payment_status === "pending");

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

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            На главную
          </Button>
          <div className="flex items-center gap-4">
            <OrderNotifications />
            <div className="flex items-center gap-2 text-golden">
              <Shield className="w-5 h-5" />
              <span className="font-medium hidden sm:inline">Админ панель</span>
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
              <span className="hidden sm:inline">Выйти</span>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-4 bg-card/60 backdrop-blur-xl">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Обзор</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2 relative">
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">Заказы</span>
              {pendingOrders.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full text-xs flex items-center justify-center text-white">
                  {pendingOrders.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Пользователи</span>
            </TabsTrigger>
            <TabsTrigger value="feedback" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Отзывы</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <DashboardStats 
              stats={stats} 
              feedbackCount={feedbackStats.count} 
              avgRating={feedbackStats.avgRating} 
            />
            
            {/* Current Orders + Settings */}
            <div className="grid lg:grid-cols-2 gap-6">
              <OrdersTable
                orders={pendingOrders}
                onUpdateStatus={handleUpdateOrderStatus}
                showFilters={false}
                title="Текущие заказы"
              />
              
              <div className="space-y-6">
                {/* Delivery Settings */}
                <DeliverySettings t={t} />
                
                {/* Recent Activity */}
                <OrdersTable
                  orders={allPurchases.slice(0, 5)}
                  onUpdateStatus={handleUpdateOrderStatus}
                  showFilters={false}
                  title="Последние заказы"
                />
              </div>
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <OrdersTable
              orders={allPurchases}
              onUpdateStatus={handleUpdateOrderStatus}
              title="Все заказы"
            />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <div className="grid lg:grid-cols-2 gap-6">
              <UsersTable
                profiles={profiles}
                userRoles={allUserRoles}
                onSelectUser={setSelectedUser}
                selectedUserId={selectedUser?.id}
                onToggleAdmin={handleToggleAdmin}
                t={t}
                onAddRole={async (userId, role) => {
                  const { error } = await addUserRole(userId, role);
                  if (error) {
                    toast({
                      variant: "destructive",
                      title: t("auth.error"),
                      description: t("admin.roleAdded") + " failed",
                    });
                  } else {
                    toast({ title: t("admin.roleAdded") });
                    fetchAllUserRoles();
                  }
                }}
                onRemoveRole={async (userId, role) => {
                  const { error } = await removeUserRole(userId, role);
                  if (error) {
                    toast({
                      variant: "destructive",
                      title: t("auth.error"),
                      description: t("admin.roleRemoved") + " failed",
                    });
                  } else {
                    toast({ title: t("admin.roleRemoved") });
                    fetchAllUserRoles();
                  }
                }}
              />
              
              <UserDetails
                user={selectedUser}
                purchases={userPurchases}
                isAdmin={selectedUser ? isUserAdmin(selectedUser.id) : false}
                onAddPurchase={() => setShowAddPurchase(true)}
              />
            </div>
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback">
            <FeedbackList 
              onStatsUpdate={(count, avgRating) => setFeedbackStats({ count, avgRating })}
            />
          </TabsContent>
        </Tabs>
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
              <label className="text-sm text-muted-foreground">Сумма (IDR)</label>
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

const Admin = () => {
  return (
    <LanguageProvider>
      <AdminContent />
    </LanguageProvider>
  );
};

export default Admin;
