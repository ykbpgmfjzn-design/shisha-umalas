import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Wind, BookOpen } from "lucide-react";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";
import OrdersList from "@/components/shisha-master/OrdersList";
import TrainingMaterials from "@/components/shisha-master/TrainingMaterials";

function ShishaMasterContent() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const userRoles = roles?.map(r => r.role) || [];
      const allowed = userRoles.includes("admin") || userRoles.includes("shisha_master");
      
      if (!allowed) {
        navigate("/");
        return;
      }

      setHasAccess(true);
      setLoading(false);
    };

    checkAccess();
  }, [navigate]);

  if (loading || !hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Wind className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">{t("shishaMaster.title")}</h1>
            </div>
          </div>
          <LanguageSelector />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="orders" className="gap-2">
              <Wind className="h-4 w-4" />
              {t("shishaMaster.orders.activeOrders")}
            </TabsTrigger>
            <TabsTrigger value="training" className="gap-2">
              <BookOpen className="h-4 w-4" />
              {t("shishaMaster.training.title")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <OrdersList />
          </TabsContent>

          <TabsContent value="training">
            <TrainingMaterials />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default function ShishaMaster() {
  return (
    <LanguageProvider>
      <ShishaMasterContent />
    </LanguageProvider>
  );
}
