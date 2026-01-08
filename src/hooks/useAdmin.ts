import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "./useProfile";
import type { Database } from "@/integrations/supabase/types";
import { logActivity } from "./useActivityLog";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface PurchaseWithProfile {
  id: string;
  user_id: string;
  hookah_count: number;
  amount: number | null;
  discount_applied: number | null;
  free_drink_used: boolean | null;
  free_snack_used: boolean | null;
  notes: string | null;
  created_at: string;
  payment_status: string | null;
  paid_at: string | null;
  xendit_invoice_url: string | null;
  // Joined profile data
  profile?: {
    email: string | null;
    full_name: string | null;
    room_number: string | null;
    guest_type: string;
  };
}

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  todayOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  totalHookahs: number;
  totalUsers: number;
}

export const useAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allPurchases, setAllPurchases] = useState<PurchaseWithProfile[]>([]);
  const [userPurchases, setUserPurchases] = useState<PurchaseWithProfile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [allUserRoles, setAllUserRoles] = useState<UserRole[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    todayOrders: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    totalHookahs: 0,
    totalUsers: 0,
  });

  // Check if current user is admin
  const checkAdminStatus = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    setIsAdmin(!!data);
    setLoading(false);
  }, []);

  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  // Fetch all profiles
  const fetchAllProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setProfiles(data as Profile[]);
    }
    return { data, error };
  }, []);

  // Fetch ALL purchases (for dashboard)
  const fetchAllPurchases = useCallback(async () => {
    const { data: purchases, error } = await supabase
      .from("purchases")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && purchases) {
      // Fetch profiles for each purchase
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email, full_name, room_number, guest_type");

      const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      const purchasesWithProfiles = purchases.map(p => ({
        ...p,
        profile: profileMap.get(p.user_id) || undefined,
      })) as PurchaseWithProfile[];

      setAllPurchases(purchasesWithProfiles);

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayPurchases = purchasesWithProfiles.filter(
        p => new Date(p.created_at) >= today
      );

      setStats({
        totalOrders: purchasesWithProfiles.length,
        pendingOrders: purchasesWithProfiles.filter(p => p.payment_status === "pending").length,
        completedOrders: purchasesWithProfiles.filter(p => p.payment_status === "PAID").length,
        todayOrders: todayPurchases.length,
        totalRevenue: purchasesWithProfiles.reduce((sum, p) => sum + (p.amount || 0), 0),
        todayRevenue: todayPurchases.reduce((sum, p) => sum + (p.amount || 0), 0),
        totalHookahs: purchasesWithProfiles.reduce((sum, p) => sum + p.hookah_count, 0),
        totalUsers: profilesData?.length || 0,
      });
    }
    return { data: purchases, error };
  }, []);

  // Fetch purchases for a specific user
  const fetchUserPurchases = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("purchases")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setUserPurchases(data as PurchaseWithProfile[]);
    }
    return { data, error };
  }, []);

  // Fetch all user roles
  const fetchAllUserRoles = useCallback(async () => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("*");

    if (!error && data) {
      setAllUserRoles(data as UserRole[]);
    }
    return { data, error };
  }, []);

  // Fetch user roles for a specific user
  const fetchUserRoles = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", userId);

    if (!error && data) {
      setUserRoles(data as UserRole[]);
    }
    return { data, error };
  }, []);

  // Add role to user
  const addUserRole = useCallback(async (userId: string, role: AppRole) => {
    const { data, error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role })
      .select()
      .single();

    return { data, error };
  }, []);

  // Remove role from user
  const removeUserRole = useCallback(async (userId: string, role: AppRole) => {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);

    return { error };
  }, []);

  // Update purchase status
  const updatePurchaseStatus = useCallback(async (
    purchaseId: string,
    status: string,
    notes?: string
  ) => {
    const { data, error } = await supabase
      .from("purchases")
      .update({
        payment_status: status,
        notes: notes,
        paid_at: status === "PAID" ? new Date().toISOString() : null,
      })
      .eq("id", purchaseId)
      .select()
      .single();

    // Log order status change
    if (!error && data) {
      const action = status === "cancelled" 
        ? "Заказ отменён" 
        : status === "PAID" 
          ? "Заказ оплачен" 
          : `Статус заказа изменён на ${status}`;
      
      await logActivity('order', action, {
        purchase_id: purchaseId,
        new_status: status,
        hookah_count: data.hookah_count,
        amount: data.amount,
        user_id: data.user_id,
      });
    }

    return { data, error };
  }, []);

  // Add purchase for a user
  const addPurchase = useCallback(async (
    userId: string, 
    hookahCount: number, 
    amount?: number,
    discountApplied?: number,
    freeDrinkUsed?: boolean,
    freeSnackUsed?: boolean,
    notes?: string
  ) => {
    const { data, error } = await supabase
      .from("purchases")
      .insert({
        user_id: userId,
        hookah_count: hookahCount,
        amount: amount || null,
        discount_applied: discountApplied || 0,
        free_drink_used: freeDrinkUsed || false,
        free_snack_used: freeSnackUsed || false,
        notes: notes || null,
        payment_status: "pending",
      })
      .select()
      .single();

    return { data, error };
  }, []);

  return {
    isAdmin,
    loading,
    profiles,
    allPurchases,
    userPurchases,
    userRoles,
    allUserRoles,
    stats,
    fetchAllProfiles,
    fetchAllPurchases,
    fetchUserPurchases,
    fetchAllUserRoles,
    fetchUserRoles,
    addUserRole,
    removeUserRole,
    updatePurchaseStatus,
    addPurchase,
    refetchAdmin: checkAdminStatus,
  };
};
