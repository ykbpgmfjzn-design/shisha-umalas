import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, Minus, User, Search, ShoppingCart, Check, Wind } from "lucide-react";
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

export default function ManualOrderForm({ onOrderCreated }: { onOrderCreated?: () => void }) {
  const [customers, setCustomers] = useState<ExistingCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<ExistingCustomer | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [notes, setNotes] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [deliveryStatus, setDeliveryStatus] = useState("pending");
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

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error("Добавьте позиции в заказ");
      return;
    }
    if (!selectedCustomer && !customerName.trim()) {
      toast.error("Укажите имя клиента");
      return;
    }

    setSubmitting(true);

    const orderNotes = cart
      .map((e) => `${e.quantity}x ${e.item.name}`)
      .join(", ");
    const fullNotes = notes
      ? `${orderNotes}\n---\n${notes}`
      : orderNotes;

    const insertData: Record<string, unknown> = {
      hookah_count: hookahCount || 1,
      amount: totalAmount,
      notes: fullNotes,
      payment_status: paymentStatus,
      delivery_status: deliveryStatus,
    };

    if (selectedCustomer) {
      insertData.user_id = selectedCustomer.id;
      insertData.customer_name = selectedCustomer.full_name || selectedCustomer.email;
    } else {
      insertData.customer_name = customerName.trim();
    }

    const { error } = await supabase.from("purchases").insert(insertData);

    if (error) {
      console.error("Insert error:", error);
      toast.error("Ошибка создания заказа");
      setSubmitting(false);
      return;
    }

    toast.success("Заказ создан!");
    // Reset form
    setCart([]);
    setNotes("");
    setCustomerName("");
    setSelectedCustomer(null);
    setPaymentStatus("pending");
    setDeliveryStatus("pending");
    setSubmitting(false);
    onOrderCreated?.();
  };

  const strengthOrder = ["Ultra Light", "Light", "Medium", "Bold Strong", "Extra"];

  return (
    <div className="space-y-6">
      {/* Customer Selection */}
      <Card className="bg-card/60 backdrop-blur-xl border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Клиент
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
                Изменить
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
                    Найти существующего клиента...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Имя, email или телефон..."
                      value={customerSearch}
                      onValueChange={setCustomerSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Не найдено</CommandEmpty>
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
                <span className="text-xs text-muted-foreground">или новый клиент</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Input
                placeholder="Имя нового клиента"
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
            Позиции
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
                  Корзина
                  <Badge variant="secondary" className="ml-auto">
                    {cart.reduce((s, e) => s + e.quantity, 0)} позиций
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
                  <span>Итого</span>
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
          <CardTitle className="text-base">Статусы и заметки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Оплата</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">⏳ Не оплачено</SelectItem>
                  <SelectItem value="paid">✅ Оплачено</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Доставка</Label>
              <Select value={deliveryStatus} onValueChange={setDeliveryStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">⏳ Ожидание</SelectItem>
                  <SelectItem value="preparing">🔥 Готовится</SelectItem>
                  <SelectItem value="delivered">✅ Доставлено</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Заметки</Label>
            <Textarea
              placeholder="Дополнительные заметки к заказу..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={submitting || cart.length === 0}
        className="w-full h-12 text-base"
        size="lg"
      >
        {submitting ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground" />
        ) : (
          <>
            <Check className="h-5 w-5 mr-2" />
            Создать заказ • Rp {totalAmount.toLocaleString("id-ID")}
          </>
        )}
      </Button>
    </div>
  );
}
