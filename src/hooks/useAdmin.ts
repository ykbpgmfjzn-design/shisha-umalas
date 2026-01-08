import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "./useProfile";
import type { Purchase } from "./usePurchases";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export const useAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);

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

  // Fetch all profiles (admin only - requires RLS policy update)
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

  // Fetch all purchases for a user
  const fetchUserPurchases = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("purchases")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAllPurchases(data as Purchase[]);
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
    userRoles,
    fetchAllProfiles,
    fetchUserPurchases,
    fetchUserRoles,
    addUserRole,
    removeUserRole,
    addPurchase,
    refetchAdmin: checkAdminStatus,
  };
};
