import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Purchase {
  id: string;
  user_id: string;
  hookah_count: number;
  amount: number | null;
  discount_applied: number | null;
  free_drink_used: boolean | null;
  free_snack_used: boolean | null;
  notes: string | null;
  created_at: string;
}

export const usePurchases = (userId?: string) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPurchases = useCallback(async () => {
    if (!userId) {
      setPurchases([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("purchases")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPurchases(data as Purchase[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  return { purchases, loading, refetch: fetchPurchases };
};
