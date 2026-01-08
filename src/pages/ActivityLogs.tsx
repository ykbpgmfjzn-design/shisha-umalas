import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ArrowLeft, 
  Activity, 
  LogIn, 
  ShoppingCart, 
  CreditCard, 
  User, 
  Shield, 
  MessageSquare,
  Calendar as CalendarIcon,
  Clock,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Download
} from "lucide-react";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";
import { format, startOfDay, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { Json } from "@/integrations/supabase/types";
import { DateRange } from "react-day-picker";

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
  { value: 'auth', label: 'Вход в систему', icon: LogIn },
  { value: 'order', label: 'Заказы', icon: ShoppingCart },
  { value: 'payment', label: 'Платежи', icon: CreditCard },
  { value: 'profile', label: 'Профили', icon: User },
  { value: 'admin', label: 'Админ действия', icon: Shield },
  { value: 'feedback', label: 'Отзывы', icon: MessageSquare },
  { value: 'reservation', label: 'Бронирования', icon: CalendarIcon },
];

const ITEMS_PER_PAGE = 20;

function ActivityLogsContent() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(ACTIVITY_TYPES.map(t => t.value));
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; email: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchLogs();
      fetchUsers();
    }
  }, [hasAccess, dateRange]);

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

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email")
      .not("email", "is", null);
    
    if (data) {
      setAllUsers(data.filter(u => u.email) as { id: string; email: string }[]);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    
    let query = supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (dateRange?.from) {
      query = query.gte('created_at', startOfDay(dateRange.from).toISOString());
    }
    if (dateRange?.to) {
      query = query.lte('created_at', endOfDay(dateRange.to).toISOString());
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching logs:", error);
      setLoading(false);
      return;
    }

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

  const toggleActivityType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
    setCurrentPage(1);
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setDateRange(undefined);
    setSelectedTypes(ACTIVITY_TYPES.map(t => t.value));
    setSelectedUsers([]);
    setCurrentPage(1);
  };

  const exportToCSV = () => {
    const headers = ['Дата', 'Время', 'Пользователь', 'Тип', 'Действие', 'Детали'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), "dd.MM.yyyy"),
      format(new Date(log.created_at), "HH:mm:ss"),
      log.profile?.email || log.profile?.full_name || 'Гость',
      log.activity_type,
      log.action,
      getDetailsText(log.details).replace(/•/g, ',')
    ]);
    
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-logs-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter(log => {
    const typeMatch = selectedTypes.includes(log.activity_type);
    const userMatch = selectedUsers.length === 0 || (log.user_id && selectedUsers.includes(log.user_id));
    return typeMatch && userMatch;
  });

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getDetailsText = (details: Json): string => {
    if (!details || typeof details !== 'object' || Array.isArray(details)) return '';
    const obj = details as Record<string, unknown>;
    const parts: string[] = [];
    
    if (obj.email) parts.push(`Email: ${obj.email}`);
    if (obj.target_user_email) parts.push(`Пользователь: ${obj.target_user_email}`);
    if (obj.added_role) parts.push(`Роль: ${obj.added_role}`);
    if (obj.removed_role) parts.push(`Роль: ${obj.removed_role}`);
    if (obj.hookah_count) parts.push(`Кальянов: ${obj.hookah_count}`);
    if (obj.amount) parts.push(`Сумма: IDR ${Number(obj.amount).toLocaleString()}`);
    if (obj.rating) parts.push(`Рейтинг: ${obj.rating}★`);
    if (obj.party_size) parts.push(`Гостей: ${obj.party_size}`);
    if (obj.date) parts.push(`Дата: ${obj.date}`);
    if (obj.time) parts.push(`Время: ${obj.time}`);
    if (obj.new_status) parts.push(`Статус: ${obj.new_status}`);
    
    return parts.join(' • ');
  };

  if (loading && !hasAccess) {
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
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
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
        {/* Filters Row */}
        <div className="bg-card rounded-lg border border-border p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Filter Toggle */}
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Фильтр
            </Button>

            {/* Date Range */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy")
                    )
                  ) : (
                    "Период"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ru}
                />
              </PopoverContent>
            </Popover>

            {/* Clear All */}
            {(dateRange || selectedTypes.length < ACTIVITY_TYPES.length || selectedUsers.length > 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="text-primary border-primary"
              >
                Сбросить всё
              </Button>
            )}

            {/* Export CSV */}
            {filteredLogs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                CSV
              </Button>
            )}

            <div className="ml-auto text-sm text-muted-foreground">
              Показано {paginatedLogs.length} из {filteredLogs.length}
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* User Filter */}
              <div>
                <h3 className="text-sm font-medium mb-3">Пользователь</h3>
                <ScrollArea className="h-48 border rounded-md p-2">
                  {allUsers.map(user => (
                    <div key={user.id} className="flex items-center gap-2 py-1">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={() => toggleUser(user.id)}
                      />
                      <label 
                        htmlFor={`user-${user.id}`}
                        className={`text-sm cursor-pointer ${selectedUsers.includes(user.id) ? 'text-primary font-medium' : ''}`}
                      >
                        {user.email}
                      </label>
                    </div>
                  ))}
                </ScrollArea>
              </div>

              {/* Activity Type Filter */}
              <div>
                <h3 className="text-sm font-medium mb-3">Тип активности</h3>
                <div className="space-y-2">
                  {ACTIVITY_TYPES.map(type => (
                    <div key={type.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`type-${type.value}`}
                        checked={selectedTypes.includes(type.value)}
                        onCheckedChange={() => toggleActivityType(type.value)}
                      />
                      <label 
                        htmlFor={`type-${type.value}`}
                        className={`text-sm cursor-pointer flex items-center gap-2 ${selectedTypes.includes(type.value) ? 'text-primary font-medium' : ''}`}
                      >
                        {type.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-12 text-center text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Нет записей активности</p>
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[180px]">Дата и время</TableHead>
                  <TableHead className="w-[200px]">Пользователь</TableHead>
                  <TableHead>Действие</TableHead>
                  <TableHead className="w-[300px]">Детали</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-sm">
                      <div>{format(new Date(log.created_at), "dd MMM yyyy", { locale: ru })}</div>
                      <div className="text-muted-foreground">{format(new Date(log.created_at), "HH:mm:ss")}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {log.profile?.email || log.profile?.full_name || 
                          <span className="text-muted-foreground italic">Гость</span>
                        }
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {getActivityIcon(log.activity_type)}
                        </span>
                        <span className="font-medium">{log.action}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getDetailsText(log.details)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Показано {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length)} из {filteredLogs.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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