import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Shield, Plus, LogOut, PlusCircle,
  LayoutDashboard, ClipboardList, Users, Coffee, Cookie, MessageSquare, Activity, Calendar, BarChart3, UtensilsCrossed, BookOpen, Trophy, Wind
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import ManualOrderForm from "@/components/shisha-master/ManualOrderForm";
import Leaderboard from "@/components/shisha-master/Leaderboard";
import TrainingMaterials from "@/components/shisha-master/TrainingMaterials";
import { useAdmin } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import { useLogout } from "@/hooks/useLogout";
import { AdminLanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import OrderNotifications from "@/components/OrderNotifications";
import DashboardStats from "@/components/admin/DashboardStats";
import BusinessMetrics from "@/components/admin/BusinessMetrics";
import OrdersTable from "@/components/admin/OrdersTable";
import UsersTable from "@/components/admin/UsersTable";
import UserDetails from "@/components/admin/UserDetails";
import DeliverySettings from "@/components/admin/DeliverySettings";
import FeedbackList from "@/components/admin/FeedbackList";
import ReservationsList from "@/components/admin/ReservationsList";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import MenuEditor from "@/components/admin/MenuEditor";
import TopCustomers from "@/components/admin/TopCustomers";
import TopShishaFlavors from "@/components/admin/TopShishaFlavors";
import StrengthDistributionChart from "@/components/admin/StrengthDistributionChart";
import type { Profile } from "@/hooks/useProfile";

interface FeedbackWithUser {
  id: string;
  user_id: string | null;
  rating: number;
  message: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

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
    updatePaymentStatus,
    updateDeliveryStatus,
    addPurchase 
  } = useAdmin();
  const { logout } = useLogout();

  const isMobile = useIsMobile();
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [feedbackStats, setFeedbackStats] = useState({ count: 0, avgRating: 0 });
  const [allFeedbacks, setAllFeedbacks] = useState<FeedbackWithUser[]>([]);

  // Fetch feedback with user data
  const fetchFeedbacks = async () => {
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching feedback:", error);
      return;
    }

    // Fetch user profiles for each feedback
    const feedbacksWithUsers = await Promise.all(
      (data || []).map(async (fb) => {
        if (fb.user_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", fb.user_id)
            .maybeSingle();
          
          return {
            ...fb,
            user_email: profile?.email || undefined,
            user_name: profile?.full_name || undefined,
          };
        }
        return fb as FeedbackWithUser;
      })
    );

    setAllFeedbacks(feedbacksWithUsers);
    
    // Calculate stats
    const count = feedbacksWithUsers.length;
    const avgRating = count > 0 
      ? feedbacksWithUsers.reduce((sum, fb) => sum + fb.rating, 0) / count 
      : 0;
    setFeedbackStats({ count, avgRating });
  };

  // Fetch feedback on mount and setup realtime subscription
  useEffect(() => {
    if (!isAdmin) return;
    
    fetchFeedbacks();

    // Realtime subscription for feedback updates
    const channel = supabase
      .channel('feedback-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feedback' },
        () => {
          fetchFeedbacks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);
  const [purchaseForm, setPurchaseForm] = useState({
    hookahCount: 1,
    amount: "",
    notes: "",
    freeDrink: false,
    freeSnack: false,
  });
  const [saving, setSaving] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "You don't have admin permissions",
      });
      navigate("/");
    }
  }, [isAdmin, loading, navigate, toast]);

  useEffect(() => {
    const checkOwner = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const hasOwnerRole = roles?.some(r => r.role === "owner") || false;
        setIsOwner(hasOwnerRole);
      }
    };
    
    if (isAdmin) {
      fetchAllProfiles();
      fetchAllPurchases();
      fetchAllUserRoles();
      checkOwner();
    }
  }, [isAdmin, fetchAllProfiles, fetchAllPurchases, fetchAllUserRoles]);

  useEffect(() => {
    if (selectedUser) {
      fetchUserPurchases(selectedUser.id);
    }
  }, [selectedUser, fetchUserPurchases]);

  // Realtime subscription for orders
  useEffect(() => {
    if (!isAdmin) return;
    
    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchases' },
        () => {
          fetchAllPurchases();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        title: "Error",
        description: "Failed to add purchase",
      });
    } else {
      toast({
        title: "Purchase added!",
        description: `Added ${purchaseForm.hookahCount} hookah(s)`,
      });
      setShowAddPurchase(false);
      setPurchaseForm({ hookahCount: 1, amount: "", notes: "", freeDrink: false, freeSnack: false });
      fetchUserPurchases(selectedUser.id);
      fetchAllPurchases();
      fetchAllProfiles();
    }
  };

  const handleUpdatePaymentStatus = async (orderId: string, status: string) => {
    const { error } = await updatePaymentStatus(orderId, status);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update payment status",
      });
    } else {
      toast({
        title: "Status updated",
        description: status === "paid" ? "Order marked as paid" : "Payment status changed",
      });
      fetchAllPurchases();
    }
  };

  const handleUpdateDeliveryStatus = async (orderId: string, status: string) => {
    const { error } = await updateDeliveryStatus(orderId, status);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update delivery status",
      });
    } else {
      const statusLabels: Record<string, string> = {
        preparing: "Order is being prepared",
        delivered: "Order delivered",
        cancelled: "Order cancelled",
      };
      toast({
        title: "Status updated",
        description: statusLabels[status] || "Delivery status changed",
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
          title: "Error",
          description: "Failed to remove admin role",
        });
      } else {
        toast({
          title: "Role removed",
          description: "User is no longer an admin",
        });
        fetchAllUserRoles();
      }
    } else {
      const { error } = await addUserRole(userId, "admin");
      if (error) {
      toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to add admin role",
        });
      } else {
        toast({
          title: "Role added",
          description: "User is now an admin",
        });
        fetchAllUserRoles();
      }
    }
  };

  const isUserAdmin = (userId: string) => {
    return allUserRoles.some(r => r.user_id === userId && r.role === "admin");
  };

  // Get pending orders for "Current Orders" view (not delivered and not cancelled)
  const pendingOrders = allPurchases.filter(p => 
    p.delivery_status !== "delivered" && p.delivery_status !== "cancelled"
  );

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

      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Home
          </Button>
          <div className="flex items-center gap-4">
            <OrderNotifications />
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/activity-logs")}
                className="border-golden/30 text-golden hover:bg-golden/10"
              >
                <Activity className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Logs</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/shisha-master?from=admin")}
              className="border-primary/30 text-primary hover:bg-primary/10"
            >
              <Wind className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Shisha Master</span>
            </Button>
            <div className="flex items-center gap-2 text-golden">
              <Shield className="w-5 h-5" />
              <span className="font-medium hidden sm:inline">Admin Panel</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 pb-2 scrollbar-hide">
            <TabsList className="inline-flex w-auto min-w-max bg-card/60 backdrop-blur-xl">
              <TabsTrigger value="dashboard" className="gap-1.5 px-3">
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="orders" className="gap-1.5 px-3 relative">
                <ClipboardList className="w-4 h-4" />
                <span className="hidden sm:inline">Orders</span>
                {pendingOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full text-xs flex items-center justify-center text-white">
                    {pendingOrders.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="new-order" className="gap-1.5 px-3">
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">New</span>
              </TabsTrigger>
              <TabsTrigger value="menu" className="gap-1.5 px-3">
                <UtensilsCrossed className="w-4 h-4" />
                <span className="hidden sm:inline">Menu</span>
              </TabsTrigger>
              <TabsTrigger value="reservations" className="gap-1.5 px-3">
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">{t("admin.reservations")}</span>
              </TabsTrigger>
              <TabsTrigger value="staff" className="gap-1.5 px-3">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Staff</span>
              </TabsTrigger>
              <TabsTrigger value="customers" className="gap-1.5 px-3">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Customers</span>
              </TabsTrigger>
              <TabsTrigger value="feedback" className="gap-1.5 px-3">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Feedback</span>
              </TabsTrigger>
              <TabsTrigger value="training" className="gap-1.5 px-3">
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Training</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1.5 px-3">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="gap-1.5 px-3">
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">Leaders</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <BusinessMetrics
              purchases={allPurchases}
              feedbacks={allFeedbacks}
              totalUsers={stats.totalUsers}
            />
            
            
            {/* Current Orders + Settings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <OrdersTable
                orders={pendingOrders}
                onUpdatePaymentStatus={handleUpdatePaymentStatus}
                onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
                onOrderEdited={() => { fetchAllPurchases(); fetchAllProfiles(); }}
                showFilters={false}
                title="Current Orders"
                isAdmin
              />
              
              <div className="space-y-6">
                <StrengthDistributionChart purchases={allPurchases} />
                <TopShishaFlavors purchases={allPurchases} />
                <TopCustomers purchases={allPurchases} />
                {/* Delivery Settings */}
                <DeliverySettings t={t} />
                
                {/* Recent Activity */}
                <OrdersTable
                  orders={allPurchases.slice(0, 5)}
                  onUpdatePaymentStatus={handleUpdatePaymentStatus}
                  onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
                  onOrderEdited={() => { fetchAllPurchases(); fetchAllProfiles(); }}
                  showFilters={false}
                  title="Recent Orders"
                  isAdmin
                />
              </div>
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <OrdersTable
              orders={allPurchases}
              onUpdatePaymentStatus={handleUpdatePaymentStatus}
              onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
              onOrderEdited={() => { fetchAllPurchases(); fetchAllProfiles(); }}
              title="All Orders"
              isAdmin
            />
          </TabsContent>

          {/* New Order Tab */}
          <TabsContent value="new-order">
            <div className="max-w-2xl mx-auto">
              <ManualOrderForm onOrderCreated={() => {
                fetchAllPurchases();
                setActiveTab("orders");
              }} />
            </div>
          </TabsContent>

          {/* Menu Tab */}
          <TabsContent value="menu">
            <MenuEditor />
          </TabsContent>

          {/* Reservations Tab */}
          <TabsContent value="reservations">
            <ReservationsList />
          </TabsContent>

          {/* Staff Tab */}
          <TabsContent value="staff">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <UsersTable
                profiles={profiles}
                userRoles={allUserRoles}
                onSelectUser={setSelectedUser}
                selectedUserId={selectedUser?.id}
                onToggleAdmin={handleToggleAdmin}
                t={t}
                filterMode="staff"
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
              
              {isMobile ? (
                <Sheet open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
                  <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>{selectedUser?.full_name || selectedUser?.email || "User"}</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4">
                      <UserDetails
                        user={selectedUser}
                        purchases={selectedUser ? allPurchases.filter(p => p.created_by === selectedUser.id) : []}
                        isAdmin={selectedUser ? isUserAdmin(selectedUser.id) : false}
                        userRoles={allUserRoles}
                        viewMode="staff"
                        onAddPurchase={() => setShowAddPurchase(true)}
                        onUserUpdated={() => { fetchAllProfiles(); fetchAllUserRoles(); }}
                        onUserDeleted={() => {
                          setSelectedUser(null);
                          fetchAllProfiles();
                          fetchAllUserRoles();
                        }}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              ) : (
                <UserDetails
                  user={selectedUser}
                  purchases={selectedUser ? allPurchases.filter(p => p.created_by === selectedUser.id) : []}
                  isAdmin={selectedUser ? isUserAdmin(selectedUser.id) : false}
                  userRoles={allUserRoles}
                  viewMode="staff"
                  onAddPurchase={() => setShowAddPurchase(true)}
                  onUserUpdated={() => { fetchAllProfiles(); fetchAllUserRoles(); }}
                  onUserDeleted={() => {
                    setSelectedUser(null);
                    fetchAllProfiles();
                    fetchAllUserRoles();
                  }}
                />
              )}
            </div>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <UsersTable
                profiles={profiles}
                userRoles={allUserRoles}
                purchases={allPurchases}
                onSelectUser={setSelectedUser}
                selectedUserId={selectedUser?.id}
                onToggleAdmin={handleToggleAdmin}
                t={t}
                filterMode="customers"
                onMerged={() => {
                  setSelectedUser(null);
                  fetchAllProfiles();
                  fetchAllPurchases();
                }}
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
              
              {isMobile ? (
                <Sheet open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
                  <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>{selectedUser?.full_name || selectedUser?.email || "Customer"}</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4">
                      <UserDetails
                        user={selectedUser}
                        purchases={userPurchases}
                        isAdmin={selectedUser ? isUserAdmin(selectedUser.id) : false}
                        userRoles={allUserRoles}
                        onAddPurchase={() => setShowAddPurchase(true)}
                        onUserUpdated={() => { fetchAllProfiles(); fetchAllUserRoles(); }}
                        onUserDeleted={() => {
                          setSelectedUser(null);
                          fetchAllProfiles();
                          fetchAllUserRoles();
                        }}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              ) : (
                <UserDetails
                  user={selectedUser}
                  purchases={userPurchases}
                  isAdmin={selectedUser ? isUserAdmin(selectedUser.id) : false}
                  userRoles={allUserRoles}
                  onAddPurchase={() => setShowAddPurchase(true)}
                  onUserUpdated={() => { fetchAllProfiles(); fetchAllUserRoles(); }}
                  onUserDeleted={() => {
                    setSelectedUser(null);
                    fetchAllProfiles();
                    fetchAllUserRoles();
                  }}
                />
              )}
            </div>
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback">
            <FeedbackList 
              onStatsUpdate={(count, avgRating) => setFeedbackStats({ count, avgRating })}
            />
          </TabsContent>

          {/* Training Tab */}
          <TabsContent value="training">
            <TrainingMaterials />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <AnalyticsDashboard />
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard">
            <Leaderboard />
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Purchase Dialog */}
      <Dialog open={showAddPurchase} onOpenChange={setShowAddPurchase}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Add Purchase
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Number of hookahs</label>
              <Input
                type="number"
                min={1}
                value={purchaseForm.hookahCount}
                onChange={(e) => setPurchaseForm(f => ({ ...f, hookahCount: parseInt(e.target.value) || 1 }))}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Amount (IDR)</label>
              <Input
                type="number"
                placeholder="Optional"
                value={purchaseForm.amount}
                onChange={(e) => setPurchaseForm(f => ({ ...f, amount: e.target.value }))}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Notes</label>
              <Input
                placeholder="Optional"
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
                <span className="text-sm">Free drink</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={purchaseForm.freeSnack}
                  onChange={(e) => setPurchaseForm(f => ({ ...f, freeSnack: e.target.checked }))}
                  className="rounded"
                />
                <Cookie className="w-4 h-4 text-golden" />
                <span className="text-sm">Free snack</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddPurchase(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddPurchase}
              disabled={saving}
              className="bg-golden hover:bg-golden/90"
            >
              {saving ? "Saving..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Admin = () => {
  return (
    <AdminLanguageProvider>
      <AdminContent />
    </AdminLanguageProvider>
  );
};

export default Admin;
