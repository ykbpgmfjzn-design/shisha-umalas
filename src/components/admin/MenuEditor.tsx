import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, GripVertical, Star, Eye, EyeOff, Languages, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

interface DbMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  price_display: string;
  strength: string;
  is_signature: boolean;
  item_type: string;
  keywords: string[];
  sort_order: number;
  is_active: boolean;
  name_translations: Record<string, string> | any;
  description_translations: Record<string, string> | any;
}

const STRENGTHS = ["Ultra Light", "Light", "Medium", "Bold Strong", "Extra"];
const ITEM_TYPES = ["hookah", "snack", "drink", "extra"];

const emptyForm: Omit<DbMenuItem, "sort_order" | "name_translations" | "description_translations"> = {
  id: "",
  name: "",
  description: "",
  price: 0,
  price_display: "",
  strength: "Light",
  is_signature: false,
  item_type: "hookah",
  keywords: [],
  is_active: true,
};

export default function MenuEditor() {
  const [items, setItems] = useState<DbMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DbMenuItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [keywordsText, setKeywordsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const dragItemRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      toast.error("Failed to load menu items");
      console.error(error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setKeywordsText("");
    setDialogOpen(true);
  };

  const openEdit = (item: DbMenuItem) => {
    setEditing(item);
    setForm({
      id: item.id,
      name: item.name,
      description: item.description || "",
      price: item.price,
      price_display: item.price_display,
      strength: item.strength,
      is_signature: item.is_signature,
      item_type: item.item_type,
      keywords: item.keywords,
      is_active: item.is_active,
    });
    setKeywordsText(item.keywords.join(", "));
    setDialogOpen(true);
  };

  const handlePriceChange = (value: string) => {
    const price = parseInt(value) || 0;
    const display = price >= 1000 ? `IDR ${Math.round(price / 1000)}K` : `IDR ${price}`;
    setForm((f) => ({ ...f, price, price_display: display }));
  };

  const handleSave = async () => {
    if (!form.id || !form.name || !form.price) {
      toast.error("Fill in ID, name, and price");
      return;
    }

    setSaving(true);
    const keywords = keywordsText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    let savedId = form.id;

    if (editing) {
      const { error } = await supabase
        .from("menu_items")
        .update({
          name: form.name,
          description: form.description,
          price: form.price,
          price_display: form.price_display,
          strength: form.strength,
          is_signature: form.is_signature,
          item_type: form.item_type,
          keywords,
          is_active: form.is_active,
        })
        .eq("id", editing.id);

      if (error) {
        toast.error("Failed to update item");
        console.error(error);
        setSaving(false);
        return;
      }
      savedId = editing.id;
      toast.success("Item updated");
    } else {
      const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) : 0;
      const { error } = await supabase.from("menu_items").insert({
        id: form.id,
        name: form.name,
        description: form.description,
        price: form.price,
        price_display: form.price_display,
        strength: form.strength,
        is_signature: form.is_signature,
        item_type: form.item_type,
        keywords,
        is_active: form.is_active,
        sort_order: maxOrder + 1,
      });

      if (error) {
        toast.error("Failed to add item");
        console.error(error);
        setSaving(false);
        return;
      }
      toast.success("Item added");
    }

    setSaving(false);
    setDialogOpen(false);
    fetchItems();

    // Trigger AI translation in background
    triggerTranslation(savedId, form.name, form.description);
  };

  const triggerTranslation = async (itemId: string, name: string, description: string) => {
    setTranslating(itemId);
    try {
      const { error } = await supabase.functions.invoke("translate-menu-item", {
        body: { itemId, name, description: description || undefined },
      });
      if (error) {
        console.error("Translation error:", error);
        toast.error("Auto-translation failed");
      } else {
        toast.success("Translations generated", { description: "Menu item translated to 6 languages" });
        fetchItems();
      }
    } catch (err) {
      console.error("Translation error:", err);
    } finally {
      setTranslating(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this menu item?")) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      toast.success("Item deleted");
      fetchItems();
    }
  };

  const toggleActive = async (item: DbMenuItem) => {
    const { error } = await supabase
      .from("menu_items")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);

    if (error) {
      toast.error("Failed to toggle");
    } else {
      fetchItems();
    }
  };

  const canDrag = filter === "all";

  const handleDragStart = (index: number) => {
    dragItemRef.current = index;
    setDraggingIdx(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverRef.current = index;
  };

  const handleDrop = async () => {
    const from = dragItemRef.current;
    const to = dragOverRef.current;
    setDraggingIdx(null);
    if (from === null || to === null || from === to) return;

    const reordered = [...filteredItems];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    // Optimistic update
    const updated = reordered.map((item, i) => ({ ...item, sort_order: i }));
    setItems(updated);

    // Persist to DB
    const updates = updated.map((item, i) =>
      supabase.from("menu_items").update({ sort_order: i }).eq("id", item.id)
    );
    const results = await Promise.all(updates);
    const hasError = results.some((r) => r.error);
    if (hasError) {
      toast.error("Failed to save order");
      fetchItems();
    } else {
      toast.success("Order saved");
    }

    dragItemRef.current = null;
    dragOverRef.current = null;
  };

  const filteredItems =
    filter === "all" ? items : items.filter((i) => i.strength === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-display">Menu Items</h2>
          <p className="text-sm text-muted-foreground">{items.length} items total</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {STRENGTHS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {filteredItems.map((item, index) => (
          <Card
            key={item.id}
            draggable={canDrag}
            onDragStart={() => canDrag && handleDragStart(index)}
            onDragOver={(e) => canDrag && handleDragOver(e, index)}
            onDrop={() => canDrag && handleDrop()}
            onDragEnd={() => setDraggingIdx(null)}
            className={`transition-all ${!item.is_active ? "opacity-50" : ""} ${
              draggingIdx === index ? "opacity-30 scale-95" : ""
            } ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <GripVertical className={`w-4 h-4 text-muted-foreground flex-shrink-0 hidden sm:block ${
                  canDrag ? "" : "opacity-30"
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{item.name}</span>
                    {item.is_signature && (
                      <Star className="w-3.5 h-3.5 text-golden fill-golden flex-shrink-0" />
                    )}
                    <Badge variant="outline" className="text-xs">
                      {item.strength}
                    </Badge>
                    {!item.is_active && (
                      <Badge variant="secondary" className="text-xs">
                        Hidden
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span>{item.price_display} • {item.item_type}</span>
                    {Object.keys(item.name_translations || {}).length > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                        <Languages className="w-3 h-3" />
                        {Object.keys(item.name_translations).length}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => triggerTranslation(item.id, item.name, item.description)}
                    disabled={translating === item.id}
                    title="Translate"
                  >
                    {translating === item.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Languages className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleActive(item)}
                    title={item.is_active ? "Hide" : "Show"}
                  >
                    {item.is_active ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(item)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Edit Menu Item" : "Add Menu Item"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">ID (slug)</Label>
                <Input
                  value={form.id}
                  onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                  placeholder="e.g. wl-vanilla"
                  disabled={!!editing}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Whiteline Vanilla"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Price (IDR)</Label>
                <Input
                  type="number"
                  value={form.price || ""}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  placeholder="280000"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Display Price</Label>
                <Input
                  value={form.price_display}
                  onChange={(e) => setForm((f) => ({ ...f, price_display: e.target.value }))}
                  placeholder="IDR 280K"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Strength</Label>
                <Select
                  value={form.strength}
                  onValueChange={(v) => setForm((f) => ({ ...f, strength: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STRENGTHS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select
                  value={form.item_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, item_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description (English)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Creamy vanilla with a silky smooth finish"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Keywords (comma-separated)</Label>
              <Input
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder="vanilla, ваниль, vanila"
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_signature}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_signature: v }))}
                />
                <Label className="text-sm">Signature</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
                <Label className="text-sm">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
