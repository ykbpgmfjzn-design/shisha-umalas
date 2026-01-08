import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Clock, Save } from "lucide-react";
import { toast } from "sonner";

interface DeliverySettingsProps {
  t: (key: string) => string;
}

export default function DeliverySettings({ t }: DeliverySettingsProps) {
  const [deliveryTime, setDeliveryTime] = useState("15");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "delivery_time_minutes")
      .maybeSingle();
    
    if (data?.value) {
      setDeliveryTime(data.value);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    
    const { error } = await supabase
      .from("app_settings")
      .upsert({ 
        key: "delivery_time_minutes", 
        value: deliveryTime,
        updated_at: new Date().toISOString()
      });

    if (error) {
      toast.error(t("admin.settingsError"));
    } else {
      toast.success(t("admin.settingsSaved"));
    }
    
    setSaving(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          {t("admin.settings")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="deliveryTime" className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {t("admin.deliveryTime")}
          </Label>
          <div className="flex gap-2">
            <Input
              id="deliveryTime"
              type="number"
              min="1"
              max="60"
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
              className="max-w-[100px]"
            />
            <span className="flex items-center text-sm text-muted-foreground">
              {t("admin.minutes")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("admin.deliveryTimeDesc")}
          </p>
        </div>
        
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? t("admin.saving") : t("admin.save")}
        </Button>
      </CardContent>
    </Card>
  );
}
