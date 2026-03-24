import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Trash2, Edit2, DollarSign, TrendingUp,
  Calendar, Package, LogOut, Save, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLogout } from "@/hooks/useLogout";
import { AdminLanguageProvider } from "@/contexts/LanguageContext";
import SalesPeriodFilter, { type SalesPeriod, type DateRange, getDateRangeForPeriod } from "@/components/admin/SalesPeriodFilter";
import StaffLanguageSelector from "@/components/StaffLanguageSelector";
import { format } from "date-fns";

interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  supplier: string | null;
  invoice_number: string | null;
  expense_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

const CATEGORIES = [
  { value: "tobacco", label: "🍂 Tobacco" },
  { value: "charcoal", label: "🔥 Charcoal" },
  { value: "equipment", label: "🔧 Equipment" },
  { value: "supplies", label: "📦 Supplies" },
  { value: "other", label: "📋 Other" },
];

const emptyForm = {
  description: "",
  category: "tobacco",
  amount: "",
  supplier: "",
  invoice_number: "",
  expense_date: new Date().toISOString().split("T")[0],
  notes: "",
};

const ExpensesContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout } = useLogout();

  const [hasAccess, setHasAccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [period, setPeriod] = useState<SalesPeriod>("current");
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [categoryFilter, setCategoryFilter] = useState("all");

  const checkAccess = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const userRoles = roles?.map(r => r.role) || [];
    const access = userRoles.some(r => ["admin", "owner", "accounting"].includes(r));
    const admin = userRoles.some(r => ["admin", "owner"].includes(r));
    setHasAccess(access);
    setIsAdmin(admin);
    setLoading(false);
  }, [navigate]);

  const fetchExpenses = useCallback(async () => {
    let query = supabase.from("tobacco_expenses").select("*").order("expense_date", { ascending: false });

    const range = getDateRangeForPeriod(period, dateRange);
    if (range.from) query = query.gte("expense_date", range.from.toISOString().split("T")[0]);
    if (range.to) query = query.lte("expense_date", range.to.toISOString().split("T")[0]);
    if (categoryFilter !== "all") query = query.eq("category", categoryFilter);

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error loading expenses", description: error.message, variant: "destructive" });
    } else {
      setExpenses(data || []);
    }
  }, [period, dateRange, categoryFilter, toast]);

  useEffect(() => { checkAccess(); }, [checkAccess]);
  useEffect(() => { if (hasAccess) fetchExpenses(); }, [hasAccess, fetchExpenses]);

  const handleSave = async () => {
    if (!form.description || !form.amount) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      description: form.description,
      category: form.category,
      amount: parseFloat(form.amount),
      supplier: form.supplier || null,
      invoice_number: form.invoice_number || null,
      expense_date: form.expense_date,
      notes: form.notes || null,
      created_by: user?.id || null,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("tobacco_expenses").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("tobacco_expenses").insert(payload));
    }

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingId ? "Expense updated" : "Expense added" });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      fetchExpenses();
    }
    setSaving(false);
  };

  const handleEdit = (exp: Expense) => {
    setEditingId(exp.id);
    setForm({
      description: exp.description,
      category: exp.category,
      amount: String(exp.amount),
      supplier: exp.supplier || "",
      invoice_number: exp.invoice_number || "",
      expense_date: exp.expense_date,
      notes: exp.notes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("tobacco_expenses").delete().eq("id", id);
    if (error) {
      toast({ title: "Error deleting", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Expense deleted" });
      fetchExpenses();
    }
    setDeleteConfirm(null);
  };

  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const tobaccoTotal = expenses.filter(e => e.category === "tobacco").reduce((sum, e) => sum + Number(e.amount), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">You don't have access to this page.</p>
            <Button className="mt-4" onClick={() => navigate("/")}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">💰 Expense Tracker</h1>
              <p className="text-sm text-muted-foreground">Track tobacco & supplies expenses</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StaffLanguageSelector />
            {isAdmin && (
              <Button onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Expense
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={logout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <DollarSign className="h-4 w-4" /> Total Expenses
                </div>
                <p className="text-2xl font-bold text-foreground mt-1">
                  Rp {totalAmount.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Package className="h-4 w-4" /> Tobacco Only
                </div>
                <p className="text-2xl font-bold text-foreground mt-1">
                  Rp {tobaccoTotal.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <TrendingUp className="h-4 w-4" /> Entries
                </div>
                <p className="text-2xl font-bold text-foreground mt-1">{expenses.length}</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <SalesPeriodFilter period={period} dateRange={dateRange} onPeriodChange={setPeriod} onDateRangeChange={setDateRange} />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {isAdmin && <TableHead className="w-[80px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">
                      No expenses found for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map(exp => {
                    const cat = CATEGORIES.find(c => c.value === exp.category);
                    return (
                      <TableRow key={exp.id}>
                        <TableCell className="text-sm">
                          {format(new Date(exp.expense_date), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{exp.description}</div>
                          {exp.notes && <div className="text-xs text-muted-foreground">{exp.notes}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{cat?.label || exp.category}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {exp.supplier || "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          Rp {Number(exp.amount).toLocaleString()}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(exp)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm(exp.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Description *</label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Al Fakher 1kg Grape" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Category</label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Amount (Rp) *</label>
                <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="150000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Supplier</label>
                <Input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Vendor name" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Date</label>
                <Input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Invoice #</label>
              <Input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="INV-001" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Notes</label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional details..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Expenses = () => (
  <AdminLanguageProvider>
    <ExpensesContent />
  </AdminLanguageProvider>
);

export default Expenses;
