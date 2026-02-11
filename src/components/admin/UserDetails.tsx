import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Crown, Building2, Users, Plus, Hash, Calendar,
  Coffee, Cookie, Shield, Pencil, Save, X, Loader2, Trash2
} from "lucide-react";
import PhotoLightbox from "@/components/PhotoLightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Profile } from "@/hooks/useProfile";
import type { PurchaseWithProfile, UserRole } from "@/hooks/useAdmin";

interface UserDetailsProps {
  user: Profile | null;
  purchases: PurchaseWithProfile[];
  isAdmin: boolean;
  userRoles?: UserRole[];
  onAddPurchase: () => void;
  onUserUpdated?: () => void;
  onUserDeleted?: () => void;
}

const UserDetails = ({ user, purchases, isAdmin, userRoles = [], onAddPurchase, onUserUpdated, onUserDeleted }: UserDetailsProps) => {
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    room_number: "",
    loyalty_level: 1,
    total_hookahs_ordered: 0,
    staff_display_name: "",
  });

  const isStaff = user ? userRoles.some(r => r.user_id === user.id && ["shisha_master", "admin", "owner", "accounting"].includes(r.role)) : false;
  const staffRole = user ? userRoles.find(r => r.user_id === user.id && r.role === "shisha_master") || userRoles.find(r => r.user_id === user.id) : null;

  useEffect(() => {
    if (user) {
      setEditForm({
        full_name: user.full_name || "",
        phone: user.phone || "",
        room_number: user.room_number || "",
        loyalty_level: user.loyalty_level,
        total_hookahs_ordered: user.total_hookahs_ordered,
        staff_display_name: staffRole?.display_name || "",
      });
      setEditing(false);
    }
  }, [user, staffRole?.display_name]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editForm.full_name || null,
        phone: editForm.phone || null,
        room_number: editForm.room_number || null,
        loyalty_level: editForm.loyalty_level,
        total_hookahs_ordered: editForm.total_hookahs_ordered,
      })
      .eq("id", user.id);

    // Update staff display_name if this is a staff member
    if (!error && isStaff) {
      await supabase
        .from("user_roles")
        .update({ display_name: editForm.staff_display_name || null })
        .eq("user_id", user.id);
    }

    setSaving(false);

    if (error) {
      toast.error("Failed to update user");
      console.error("Update error:", error);
    } else {
      toast.success("User updated");
      setEditing(false);
      onUserUpdated?.();
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;
    setDeleting(true);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("delete-user", {
      body: { userId: user.id },
    });

    setDeleting(false);
    setDeleteDialogOpen(false);

    if (res.error || res.data?.error) {
      toast.error(res.data?.error || res.error?.message || "Failed to delete user");
    } else {
      toast.success("User deleted");
      onUserDeleted?.();
    }
  };

  if (!user) {
    return (
      <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-6 flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
        <Users className="w-12 h-12 mb-4 opacity-50" />
        <p>Select a user</p>
      </div>
    );
  }

  return (
    <>
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl truncate">{user.email}</h2>
            {isAdmin && (
              <Badge variant="outline" className="border-red-400 text-red-400">
                <Shield className="w-3 h-3 mr-1" />
                Admin
              </Badge>
            )}
          </div>
          {!editing && (
            <p className="text-sm text-muted-foreground">
              {user.full_name || "No name"} • 
              {user.guest_type === "special" 
                ? ` Room ${user.room_number}` 
                : " Guest"}
              {user.phone && ` • ${user.phone}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <>
              <div className="text-right">
                <div className="flex items-center gap-2 text-golden">
                  <Crown className="w-5 h-5" />
                  <span className="text-2xl font-bold">Lvl {user.loyalty_level}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {user.total_hookahs_ordered} hookahs
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(true)}
                className="text-muted-foreground hover:text-foreground ml-2"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeleteDialogOpen(true)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setEditForm({
                    full_name: user.full_name || "",
                    phone: user.phone || "",
                    room_number: user.room_number || "",
                    loyalty_level: user.loyalty_level,
                    total_hookahs_ordered: user.total_hookahs_ordered,
                    staff_display_name: staffRole?.display_name || "",
                  });
                }}
                className="text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="space-y-3 mb-4 p-4 rounded-xl bg-muted/30 border border-border/50">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Full name"
                className="bg-background/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Phone</label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+62..."
                className="bg-background/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Room</label>
              <Input
                value={editForm.room_number}
                onChange={(e) => setEditForm(f => ({ ...f, room_number: e.target.value }))}
                placeholder="Room #"
                className="bg-background/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Loyalty Lvl</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={editForm.loyalty_level}
                onChange={(e) => setEditForm(f => ({ ...f, loyalty_level: parseInt(e.target.value) || 1 }))}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Total Hookahs</label>
              <Input
                type="number"
                min={0}
                value={editForm.total_hookahs_ordered}
                onChange={(e) => setEditForm(f => ({ ...f, total_hookahs_ordered: parseInt(e.target.value) || 0 }))}
                className="bg-background/50"
              />
            </div>
          </div>
          {isStaff && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Staff Display Name</label>
              <Input
                value={editForm.staff_display_name}
                onChange={(e) => setEditForm(f => ({ ...f, staff_display_name: e.target.value }))}
                placeholder="Name shown in orders & leaderboard"
                className="bg-background/50"
              />
            </div>
          )}
        </div>
      )}

      <Button
        onClick={onAddPurchase}
        className="w-full mb-6 bg-gradient-to-r from-golden to-sunset hover:from-sunset hover:to-golden"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Purchase
      </Button>

      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
        <h3 className="font-medium text-sm text-muted-foreground mb-3">
          Order History ({purchases.length})
        </h3>
        
        {purchases.map((purchase) => (
          <div key={purchase.id} className="p-4 rounded-xl bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {purchase.customer_photo_url ? (
                  <img loading="lazy" src={purchase.customer_photo_url} alt="" className="h-8 w-8 rounded-full object-cover border border-border shrink-0 cursor-pointer" onClick={() => setLightboxPhoto(purchase.customer_photo_url)} />
                ) : (
                  <Hash className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="font-medium">{purchase.hookah_count} hookah(s)</span>
              </div>
              {purchase.amount && (
                <span className="text-golden font-medium">
                  IDR {purchase.amount.toLocaleString('id-ID')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(purchase.created_at)}
              </div>
              {purchase.free_drink_used && (
                <div className="flex items-center gap-1 text-golden">
                  <Coffee className="w-3 h-3" />
                  Drink
                </div>
              )}
              {purchase.free_snack_used && (
                <div className="flex items-center gap-1 text-golden">
                  <Cookie className="w-3 h-3" />
                  Snack
                </div>
              )}
            </div>
            {purchase.notes && (
              <p className="text-xs text-muted-foreground mt-2">
                {purchase.notes}
              </p>
            )}
          </div>
        ))}

        {purchases.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No orders
          </p>
        )}
      </div>
    </motion.div>
    <PhotoLightbox src={lightboxPhoto} open={!!lightboxPhoto} onOpenChange={(open) => !open && setLightboxPhoto(null)} />
    
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete User</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{user?.full_name || user?.email}</strong>? 
            This will permanently remove their account, profile, and all associated data. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteUser}
            disabled={deleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default UserDetails;
