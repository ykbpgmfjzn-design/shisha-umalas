import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "./useActivityLog";

export function useLogout() {
  const navigate = useNavigate();

  const logout = async () => {
    // Log before signing out (while we still have the user context)
    await logActivity('auth', 'Выход из системы', {});
    
    await supabase.auth.signOut();
    navigate("/");
  };

  return { logout };
}