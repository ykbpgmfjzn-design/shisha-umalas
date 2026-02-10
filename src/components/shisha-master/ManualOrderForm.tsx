import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Minus, User, Search, ShoppingCart, Check, Wind, Save, Camera, ImagePlus, X, Loader2, CalendarIcon } from "lucide-react";
import { menuItems, MenuItem } from "@/data/menuItems";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface ExistingCustomer {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  loyalty_level: number;
  total_hookahs_ordered: number;
}

interface CartEntry {
  item: MenuItem;
  quantity: number;
}

export interface EditOrderData {
  id: string;
  user_id: string | null;
  customer_name: string | null;
  hookah_count: number;
  amount: number | null;
  notes: string | null;
  payment_status: string | null;
  delivery_status: string;
  created_at?: string;
}

interface ManualOrderFormProps {
  onOrderCreated?: () => void;
  editOrder?: EditOrderData | null;
  onEditComplete?: () => void;
}

function parseCartFromNotes(notes: string | null): CartEntry[] {
  if (!notes) return [];
  // Notes format: "1x Whiteline Vanilla, 2x Berry Kiss\n---\nextra notes"
  const itemsPart = notes.split("\n---\n")[0];
  const entries: CartEntry[] = [];
  const parts = itemsPart.split(", ");
  for (const part of parts) {
    const match = part.match(/^(\d+)x\s+(.+)$/);
    if (match) {
      const qty = parseInt(match[1], 10);
      const name = match[2].trim();
      const menuItem = menuItems.find((m) => m.name === name);
      if (menuItem) {
        entries.push({ item: menuItem, quantity: qty });
      }
    }
  }
  return entries;
}

function parseExtraNotesFromNotes(notes: string | null): string {
  if (!notes) return "";
  const parts = notes.split("\n---\n");
  return parts.length > 1 ? parts.slice(1).join("\n---\n") : "";
}

export default function ManualOrderForm({ onOrderCreated, editOrder, onEditComplete }: ManualOrderFormProps) {
  const { t } = useLanguage();
  const isEditing = !!editOrder;

  const [customers, setCustomers] = useState<ExistingCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<ExistingCustomer | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [notes, setNotes] = useState("");
  const [customerPhotoUrl, setCustomerPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [deliveryStatus, setDeliveryStatus] = useState("pending");
  const [orderDate, setOrderDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Group menu items by strength
  const groupedMenu = useMemo(() => {
    const groups: Record<string, MenuItem[]> = {};
    menuItems.forEach((item) => {
      if (!groups[item.strength]) groups[item.strength] = [];
      groups[item.strength].push(item);
    });
    return groups;
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Pre-fill form when editing
  useEffect(() => {
    if (editOrder) {
      setCart(parseCartFromNotes(editOrder.notes));
      setNotes(parseExtraNotesFromNotes(editOrder.notes));
      setPaymentStatus(editOrder.payment_status || "pending");
      setDeliveryStatus(editOrder.delivery_status || "pending");
      setCustomerName(editOrder.customer_name || "");
      // Format created_at for datetime-local input
      if (editOrder.created_at) {
        const d = new Date(editOrder.created_at);
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setOrderDate(local);
      } else {
        setOrderDate("");
      }
    } else {
      resetForm();
    }
  }, [editOrder]);

  // Set selectedCustomer after customers are loaded for edit mode
  useEffect(() => {
    if (editOrder?.user_id && customers.length > 0) {
      const found = customers.find((c) => c.id === editOrder.user_id);
      if (found) setSelectedCustomer(found);
    }
  }, [editOrder, customers]);

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, loyalty_level, total_hookahs_ordered")
      .order("full_name");
    if (data) setCustomers(data);
  };

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((e) => e.item.id === item.id);
      if (existing) {
        return prev.map((e) =>
          e.item.id === item.id ? { ...e, quantity: e.quantity + 1 } : e
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateCartQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((e) =>
          e.item.id === itemId ? { ...e, quantity: e.quantity + delta } : e
        )
        .filter((e) => e.quantity > 0)
    );
  };

  const totalAmount = useMemo(
    () => cart.reduce((sum, e) => sum + e.item.price * e.quantity, 0),
    [cart]
  );

  const hookahCount = useMemo(
    () =>
      cart
        .filter((e) => e.item.itemType === "hookah")
        .reduce((sum, e) => sum + e.quantity, 0),
    [cart]
  );

  const resetForm = () => {
    setCart([]);
    setNotes("");
    setCustomerName("");
    setSelectedCustomer(null);
    setCustomerPhotoUrl(null);
    setPaymentStatus("pending");
    setDeliveryStatus("pending");
    setOrderDate("");
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { compressImage } = await import("@/lib/compressImage");
      const compressed = await compressImage(file);
      const fileExt = compressed.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("customer-photos")
        .upload(fileName, compressed);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("customer-photos")
        .getPublicUrl(fileName);
      setCustomerPhotoUrl(urlData.publicUrl);
      const saved = Math.round((1 - compressed.size / file.size) * 100);
      if (saved > 5) {
        toast.success(`${t("shishaMaster.form.photoCompressed")} (-${saved}%)`);
      }
    } catch (err: any) {
      console.error("Photo upload error:", err);
      toast.error(err.message || "Upload error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = () => {
    setCustomerPhotoUrl(null);
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error(t("shishaMaster.form.addItems"));
      return;
    }
    if (!selectedCustomer && !customerName.trim()) {
      toast.error(t("shishaMaster.form.specifyName"));
      return;
    }

    setSubmitting(true);

    const orderNotes = cart
      .map((e) => `${e.quantity}x ${e.item.name}`)
      .join(", ");
    const fullNotes = notes
      ? `${orderNotes}\n---\n${notes}`
      : orderNotes;

    const orderData: Record<string, unknown> = {
      hookah_count: hookahCount || 1,
      amount: totalAmount,
      notes: fullNotes,
      payment_status: paymentStatus,
      delivery_status: deliveryStatus,
      customer_photo_url: customerPhotoUrl,
    };

    // Set custom order date if provided
    if (orderDate) {
      orderData.created_at = new Date(orderDate).toISOString();
    }

    if (selectedCustomer) {
      orderData.user_id = selectedCustomer.id;
      orderData.customer_name = selectedCustomer.full_name || selectedCustomer.email;
    } else {
      orderData.user_id = null;
      orderData.customer_name = customerName.trim();
    }

    let error;

    if (isEditing && editOrder) {
      const res = await supabase
        .from("purchases")
        .update(orderData)
        .eq("id", editOrder.id);
      error = res.error;
    } else {
      const res = await supabase.from("purchases").insert(orderData);
      error = res.error;
    }

    if (error) {
      console.error("Order error:", error);
      toast.error(isEditing ? t("shishaMaster.form.errorUpdate") : t("shishaMaster.form.errorCreate"));
      setSubmitting(false);
      return;
    }

    toast.success(isEditing ? t("shishaMaster.form.orderUpdated") : t("shishaMaster.form.orderCreated"));
    resetForm();
    setSubmitting(false);

    if (isEditing) {
      onEditComplete?.();
    } else {
      onOrderCreated?.();
    }
  };

  const strengthOrder = ["Ultra Light", "Light", "Medium", "Bold Strong", "Extra"];

  return (
    <div className="space-y-6">
      {/* Customer Selection */}
      <Card className="bg-card/60 backdrop-blur-xl border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            {t("shishaMaster.form.client")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedCustomer ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div>
                <p className="font-medium">
                  {selectedCustomer.full_name || selectedCustomer.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  Lvl {selectedCustomer.loyalty_level} • {selectedCustomer.total_hookahs_ordered} hookahs
                  {selectedCustomer.phone && ` • ${selectedCustomer.phone}`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCustomer(null)}
              >
                {t("shishaMaster.form.change")}
              </Button>
            </div>
          ) : (
            <>
              <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-muted-foreground"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    {t("shishaMaster.form.findClient")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder={t("shishaMaster.form.nameEmailPhone")}
                      value={customerSearch}
                      onValueChange={setCustomerSearch}
                    />
                    <CommandList>
                      <CommandEmpty>{t("shishaMaster.form.notFound")}</CommandEmpty>
                      <CommandGroup>
                        {filteredCustomers.slice(0, 20).map((c) => (
                          <CommandItem
                            key={c.id}
                            onSelect={() => {
                              setSelectedCustomer(c);
                              setCustomerName("");
                              setCustomerPopoverOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {c.full_name || c.email || "—"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Lvl {c.loyalty_level} • {c.total_hookahs_ordered} hookahs
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">{t("shishaMaster.form.orNewClient")}</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Input
                placeholder={t("shishaMaster.form.newClientName")}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Menu Items Selection */}
      <Card className="bg-card/60 backdrop-blur-xl border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wind className="h-4 w-4 text-primary" />
            {t("shishaMaster.form.items")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {strengthOrder.map((strength) => {
            const items = groupedMenu[strength];
            if (!items) return null;
            return (
              <div key={strength}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {strength}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {items.map((item) => {
                    const inCart = cart.find((e) => e.item.id === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-all ${
                          inCart
                            ? "bg-primary/10 border border-primary/30"
                            : "bg-muted/30 border border-transparent hover:bg-muted/50"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {item.isSignature && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                              ★
                            </Badge>
                          )}
                          <span className={inCart ? "font-medium" : ""}>
                            {item.name}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {item.priceDisplay}
                          </span>
                          {inCart && (
                            <Badge className="h-5 min-w-[20px] p-0 flex items-center justify-center text-xs">
                              {inCart.quantity}
                            </Badge>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Cart Summary */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Card className="bg-card/60 backdrop-blur-xl border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  {t("shishaMaster.form.cart")}
                  <Badge variant="secondary" className="ml-auto">
                    {cart.reduce((s, e) => s + e.quantity, 0)} {t("shishaMaster.form.itemsCount")}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {cart.map((entry) => (
                  <div
                    key={entry.item.id}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm">{entry.item.name}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateCartQty(entry.item.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">
                        {entry.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateCartQty(entry.item.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm text-muted-foreground w-20 text-right">
                        {(entry.item.price * entry.quantity).toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-border flex items-center justify-between font-semibold">
                  <span>{t("shishaMaster.form.total")}</span>
                  <span>Rp {totalAmount.toLocaleString("id-ID")}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status & Notes */}
      <Card className="bg-card/60 backdrop-blur-xl border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("shishaMaster.form.statusAndNotes")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">{t("shishaMaster.form.payment")}</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">⏳ {t("shishaMaster.form.unpaid")}</SelectItem>
                  <SelectItem value="paid">✅ {t("shishaMaster.form.paid")}</SelectItem>
                </SelectContent>
              </Select>
          </div>

          {/* Order Date */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" />
              {t("shishaMaster.form.orderDate") || "Order date"}
            </Label>
            <Input
              type="datetime-local"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full"
            />
            {!orderDate && (
              <p className="text-xs text-muted-foreground">
                {t("shishaMaster.form.orderDateHint") || "Leave empty for current time"}
              </p>
            )}
          </div>
            <div className="space-y-2">
              <Label className="text-xs">{t("shishaMaster.form.delivery")}</Label>
              <Select value={deliveryStatus} onValueChange={setDeliveryStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">⏳ {t("shishaMaster.form.waiting")}</SelectItem>
                  <SelectItem value="preparing">🔥 {t("shishaMaster.form.preparing")}</SelectItem>
                  <SelectItem value="delivered">✅ {t("shishaMaster.form.delivered")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">{t("shishaMaster.form.notes")}</Label>
            <Textarea
              placeholder={t("shishaMaster.form.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Customer Photo */}
          <div className="space-y-2">
            <Label className="text-xs">{t("shishaMaster.form.customerPhoto")}</Label>
            {customerPhotoUrl ? (
              <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border">
                <img src={customerPhotoUrl} alt="Customer" className="w-full h-full object-cover" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={removePhoto}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={uploadingPhoto}>
                    <span>
                      {uploadingPhoto ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4 mr-2" />
                      )}
                      {t("shishaMaster.form.takePhoto")}
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                  />
                </label>
                <label className="cursor-pointer">
                  <Button variant="ghost" size="sm" asChild disabled={uploadingPhoto}>
                    <span>
                      <ImagePlus className="h-4 w-4 mr-2" />
                      {t("shishaMaster.form.fromGallery")}
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                  />
                </label>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex gap-3">
        {isEditing && (
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onEditComplete?.();
            }}
            className="flex-1 h-12"
            size="lg"
          >
            {t("shishaMaster.form.cancel")}
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={submitting || cart.length === 0}
          className="flex-1 h-12 text-base"
          size="lg"
        >
          {submitting ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground" />
          ) : isEditing ? (
            <>
              <Save className="h-5 w-5 mr-2" />
              {t("shishaMaster.form.save")} • Rp {totalAmount.toLocaleString("id-ID")}
            </>
          ) : (
            <>
              <Check className="h-5 w-5 mr-2" />
              {t("shishaMaster.form.createOrder")} • Rp {totalAmount.toLocaleString("id-ID")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
