import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  room_number: string | null;
  guest_type: "guest" | "special";
  total_hookahs_ordered: number;
  loyalty_level: number;
  loyalty_points: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyLevel {
  level: number;
  name_ru: string;
  name_en: string;
  hookahs_required: number;
  discount_percent: number;
  free_drink: boolean;
  free_snack: boolean;
  special_bonus: string | null;
}

export const useProfile = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loyaltyLevels, setLoyaltyLevels] = useState<LoyaltyLevel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string, userEmail?: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
      return;
    }

    if (data) {
      setProfile(data as Profile);
    } else {
      // Profile doesn't exist, create it
      console.log("Profile not found, creating...");
      const { data: newProfile, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          email: userEmail || null,
        })
        .select()
        .single();

      if (!insertError && newProfile) {
        setProfile(newProfile as Profile);
      } else {
        console.error("Error creating profile:", insertError);
      }
    }
  }, []);

  const fetchLoyaltyLevels = useCallback(async () => {
    const { data, error } = await supabase
      .from("loyalty_levels")
      .select("*")
      .order("level", { ascending: true });

    if (!error && data) {
      setLoyaltyLevels(data as LoyaltyLevel[]);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id, session.user.email);
          }, 0);
        } else {
          setProfile(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email);
      }
    });

    fetchLoyaltyLevels();

    return () => subscription.unsubscribe();
  }, [fetchProfile, fetchLoyaltyLevels]);

  const updateRoomNumber = useCallback(async (roomNumber: string | null) => {
    if (!user) return { error: new Error("Not authenticated") };

    const { error } = await supabase
      .from("profiles")
      .update({ room_number: roomNumber })
      .eq("id", user.id);

    if (!error) {
      await fetchProfile(user.id);
    }

    return { error };
  }, [user, fetchProfile]);

  const getCurrentLevelInfo = useCallback((): LoyaltyLevel | null => {
    if (!profile || loyaltyLevels.length === 0) return null;
    return loyaltyLevels.find(l => l.level === profile.loyalty_level) || null;
  }, [profile, loyaltyLevels]);

  const getNextLevelInfo = useCallback((): LoyaltyLevel | null => {
    if (!profile || loyaltyLevels.length === 0) return null;
    return loyaltyLevels.find(l => l.level === profile.loyalty_level + 1) || null;
  }, [profile, loyaltyLevels]);

  const getHookahsToNextLevel = useCallback((): number => {
    const nextLevel = getNextLevelInfo();
    if (!nextLevel || !profile) return 0;
    return Math.max(0, nextLevel.hookahs_required - profile.total_hookahs_ordered);
  }, [profile, getNextLevelInfo]);

  return {
    user,
    profile,
    loyaltyLevels,
    loading,
    updateRoomNumber,
    getCurrentLevelInfo,
    getNextLevelInfo,
    getHookahsToNextLevel,
    refetchProfile: () => user && fetchProfile(user.id),
  };
};
