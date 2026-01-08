import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export const useUserRoles = () => {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      setRoles(data?.map(r => r.role) || []);
      setLoading(false);
    };

    fetchRoles();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRoles();
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasRole = (role: AppRole) => roles.includes(role);

  return { 
    roles, 
    loading, 
    hasRole,
    isOwner: hasRole("owner"),
    isAdmin: hasRole("admin") || hasRole("owner"),
    isAccounting: hasRole("accounting"),
    isShishaMaster: hasRole("shisha_master"),
  };
};
