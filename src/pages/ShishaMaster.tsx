import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Wind, BookOpen, History, PlusCircle, Trophy } from "lucide-react";
import { AdminLanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import OrdersList, { useActiveOrdersCount } from "@/components/shisha-master/OrdersList";
import TrainingMaterials from "@/components/shisha-master/TrainingMaterials";
import ManualOrderForm from "@/components/shisha-master/ManualOrderForm";
import Leaderboard from "@/components/shisha-master/Leaderboard";

function ShishaMasterContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromAdmin = searchParams.get("from") === "admin";
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const activeOrdersCount = useActiveOrdersCount();

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
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(fromAdmin ? "/admin" : "/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Wind className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Shisha Master</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="active" className="space-y-6" onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 max-w-2xl mx-auto">
            <TabsList className="grid flex-1 grid-cols-4 h-auto">
              <TabsTrigger value="active" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                <Wind className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{t("shishaMaster.orders.active") || "Active"}</span>
                {activeOrdersCount > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-5 min-w-[20px] p-0 flex items-center justify-center text-xs">
                    {activeOrdersCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="new-order" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{t("shishaMaster.newOrder") || "New"}</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                <History className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{t("shishaMaster.orders.history") || "History"}</span>
              </TabsTrigger>
              <TabsTrigger value="training" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                <BookOpen className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">SOP</span>
              </TabsTrigger>
            </TabsList>

            <TabsList className="shrink-0 bg-primary/15 border border-primary/30 self-center sm:self-auto">
              <TabsTrigger value="leaderboard" className="gap-1.5 px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Trophy className="h-4 w-4 shrink-0" />
                <span>Leaders</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="active">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <OrdersList showHistory={false} />
            </motion.div>
          </TabsContent>
          <TabsContent value="new-order">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <ManualOrderForm />
            </motion.div>
          </TabsContent>
          <TabsContent value="history">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <OrdersList showHistory={true} />
            </motion.div>
          </TabsContent>
          <TabsContent value="leaderboard">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <Leaderboard />
            </motion.div>
          </TabsContent>
          <TabsContent value="training">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <TrainingMaterials />
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default function ShishaMaster() {
  return (
    <AdminLanguageProvider>
      <ShishaMasterContent />
    </AdminLanguageProvider>
  );
}
