import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

export type ActivityType = 'auth' | 'order' | 'payment' | 'profile' | 'admin' | 'feedback' | 'reservation';

export async function logActivity(
  activityType: ActivityType,
  action: string,
  details: Json = {}
) {
  try {
    const { error } = await supabase.rpc('log_activity', {
      _activity_type: activityType,
      _action: action,
      _details: details
    });
    
    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (err) {
    console.error('Activity logging error:', err);
  }
}

export function useActivityLog() {
  return { logActivity };
}
