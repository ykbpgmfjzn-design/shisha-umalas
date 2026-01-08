import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  Activity, 
  LogIn, 
  ShoppingCart, 
  CreditCard, 
  User, 
  Shield, 
  MessageSquare,
  Calendar,
  Clock,
  Filter
} from "lucide-react";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";
import { format } from "date-fns";
import { Json } from "@/integrations/supabase/types";

type ActivityTypeValue = 'auth' | 'order' | 'payment' | 'profile' | 'admin' | 'feedback' | 'reservation';

interface ActivityLog {
  id: string;
  user_id: string | null;
  activity_type: ActivityTypeValue;
  action: string;
  details: Json;
  created_at: string;
  profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

const ACTIVITY_TYPES = [
  { value: 'all', label: 'Все', icon: Activity },
  { value: 'auth', label: 'Авторизация', icon: LogIn },
  { value: 'order', label: 'Заказы', icon: ShoppingCart },
  { value: 'payment', label: 'Платежи', icon: CreditCard },
  { value: 'profile', label: 'Профили', icon: User },
  { value: 'admin', label: 'Админ', icon: Shield },
  { value: 'feedback', label: 'Отзывы', icon: MessageSquare },
  { value: 'reservation', label: 'Брони', icon: Calendar },
];

function ActivityLogsContent() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchLogs();
    }
  }, [hasAccess, activeFilter]);

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
    const allowed = userRoles.includes("owner") || userRoles.includes("admin");
    
    if (!allowed) {
      navigate("/");
      return;
    }

    setHasAccess(true);
  };

  const fetchLogs = async () => {
    setLoading(true);
    
    let query = supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    
    if (activeFilter !== 'all') {
      query = query.eq('activity_type', activeFilter as ActivityTypeValue);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching logs:", error);
      setLoading(false);
      return;
    }

    // Fetch profiles for user_ids
    const logsWithProfiles: ActivityLog[] = await Promise.all(
      (data || []).map(async (log) => {
        if (!log.user_id) return { ...log, profile: null };
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", log.user_id)
          .maybeSingle();
        
        return { ...log, profile };
      })
    );

    setLogs(logsWithProfiles);
    setLoading(false);
  };

  const getActivityIcon = (type: string) => {
    const found = ACTIVITY_TYPES.find(t => t.value === type);
    if (found) {
      const Icon = found.icon;
      return <Icon className="h-4 w-4" />;
    }
    return <Activity className="h-4 w-4" />;
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'auth': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'order': return 'bg-primary/20 text-primary border-primary/30';
      case 'payment': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'profile': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'admin': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'feedback': return 'bg-accent/20 text-accent border-accent/30';
      case 'reservation': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getCounts = () => {
    const counts: Record<string, number> = { all: logs.length };
    ACTIVITY_TYPES.forEach(type => {
      if (type.value !== 'all') {
        counts[type.value] = logs.filter(l => l.activity_type === type.value).length;
      }
    });
    return counts;
  };

  if (loading && !hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const counts = getCounts();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Логи активности</h1>
            </div>
          </div>
          <LanguageSelector />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Filter tabs */}
        <div className="mb-6">
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-2">
              {ACTIVITY_TYPES.map((type) => {
                const Icon = type.icon;
                const isActive = activeFilter === type.value;
                return (
                  <Button
                    key={type.value}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className="shrink-0"
                    onClick={() => setActiveFilter(type.value)}
                  >
                    <Icon className="h-4 w-4 mr-1.5" />
                    {type.label}
                    {counts[type.value] > 0 && (
                      <Badge variant="secondary" className="ml-1.5 text-xs">
                        {counts[type.value]}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Logs list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : logs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Нет записей активности</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <Card key={log.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Activity type badge */}
                    <div className={`p-2 rounded-lg border ${getActivityColor(log.activity_type)}`}>
                      {getActivityIcon(log.activity_type)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground">{log.action}</p>
                          <p className="text-sm text-muted-foreground">
                            {log.profile?.full_name || log.profile?.email || 'Гость'}
                          </p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground shrink-0">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(log.created_at), "HH:mm")}
                          </div>
                          <div>{format(new Date(log.created_at), "dd.MM.yy")}</div>
                        </div>
                      </div>
                      
                      {/* Details */}
                      {log.details && typeof log.details === 'object' && !Array.isArray(log.details) && Object.keys(log.details as object).length > 0 && (
                        <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground font-mono">
                          {JSON.stringify(log.details, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function ActivityLogs() {
  return (
    <LanguageProvider>
      <ActivityLogsContent />
    </LanguageProvider>
  );
}
