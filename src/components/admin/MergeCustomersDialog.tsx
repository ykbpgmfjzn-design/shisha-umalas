import { useState } from "react";
import { Loader2, Merge, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizeCustomerName } from "@/lib/utils";
import type { Profile } from "@/hooks/useProfile";

interface MergeCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Profile[];
  onMerged: () => void;
}

const MergeCustomersDialog = ({
  open,
  onOpenChange,
  customers,
  onMerged,
}: MergeCustomersDialogProps) => {
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  const primary = customers.find((c) => c.id === primaryId) || customers[0];
  const secondary = customers.find((c) => c.id !== primary?.id);

  if (customers.length !== 2 || !primary || !secondary) return null;

  const primaryIsWalkin = primary.id.startsWith("walkin_");
  const secondaryIsWalkin = secondary.id.startsWith("walkin_");

  const handleMerge = async () => {
    setMerging(true);
    try {
      // Case 1: Both are walk-ins — normalize secondary purchases to primary name
      if (primaryIsWalkin && secondaryIsWalkin) {
        const secondaryNormName = secondary.id.replace("walkin_", "");
        // Find all purchases with matching normalized customer_name
        const { data: purchases } = await supabase
          .from("purchases")
          .select("id, customer_name")
          .is("user_id", null);

        let mergedCount = 0;
        if (purchases) {
          const toUpdate = purchases.filter(
            (p) =>
              p.customer_name &&
              normalizeCustomerName(p.customer_name) === secondaryNormName
          );
          mergedCount = toUpdate.length;
          for (const p of toUpdate) {
            await supabase
              .from("purchases")
              .update({ customer_name: primary.full_name })
              .eq("id", p.id);
          }
        }
        toast.success(
          `Merged ${mergedCount} walk-in orders into "${primary.full_name}"`
        );
      }
      // Case 2: Primary is registered, secondary is walk-in
      else if (!primaryIsWalkin && secondaryIsWalkin) {
        const secondaryNormName = secondary.id.replace("walkin_", "");
        const { data: purchases } = await supabase
          .from("purchases")
          .select("id, customer_name")
          .is("user_id", null);

        if (purchases) {
          const toUpdate = purchases.filter(
            (p) =>
              p.customer_name &&
              normalizeCustomerName(p.customer_name) === secondaryNormName
          );
          for (const p of toUpdate) {
            await supabase
              .from("purchases")
              .update({
                user_id: primary.id,
                customer_name: primary.full_name || p.customer_name,
              })
              .eq("id", p.id);
          }
        }
        toast.success("Walk-in orders linked to registered account");
      }
      // Case 3: Primary is walk-in, secondary is registered — not ideal, swap
      else if (primaryIsWalkin && !secondaryIsWalkin) {
        toast.error(
          "Cannot merge a registered user into a walk-in. Select the registered user as primary."
        );
        setMerging(false);
        return;
      }
      // Case 4: Both registered
      else {
        // Transfer purchases
        const { error: purchaseError } = await supabase
          .from("purchases")
          .update({ user_id: primary.id })
          .eq("user_id", secondary.id);

        if (purchaseError) throw purchaseError;

        // Update primary profile totals
        const { data: totalData } = await supabase
          .from("purchases")
          .select("hookah_count")
          .eq("user_id", primary.id);

        const newTotal = totalData?.reduce((s, p) => s + p.hookah_count, 0) || 0;
        const newLevel = Math.min(10, 1 + Math.floor(newTotal / 30));

        await supabase
          .from("profiles")
          .update({
            total_hookahs_ordered: newTotal,
            loyalty_level: newLevel,
            loyalty_points: newTotal,
          })
          .eq("id", primary.id);

        // Delete secondary user via edge function
        const res = await supabase.functions.invoke("delete-user", {
          body: { userId: secondary.id },
        });

        if (res.error || res.data?.error) {
          console.error("Delete secondary failed:", res.error || res.data?.error);
          toast.warning(
            "Orders transferred but could not delete secondary account. Remove manually."
          );
        } else {
          toast.success("Customers merged successfully");
        }
      }

      onMerged();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Merge error:", err);
      toast.error(err.message || "Failed to merge customers");
    } finally {
      setMerging(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Merge className="w-5 h-5" />
            Merge Customers
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Select which customer to keep as primary. All orders from the
                other customer will be transferred.
              </p>

              <div className="space-y-2">
                {customers.map((c) => {
                  const isWalkin = c.id.startsWith("walkin_");
                  const selected = c.id === (primaryId || customers[0]?.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPrimaryId(c.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-muted/30 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm text-foreground">
                            {c.full_name || c.email || "No name"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isWalkin ? "Walk-in" : c.email || "Registered"}
                            {c.phone && ` • ${c.phone}`}
                          </p>
                        </div>
                        {selected && (
                          <span className="text-xs font-medium text-primary">
                            Primary
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {primaryIsWalkin && !secondaryIsWalkin && (
                <p className="text-xs text-destructive">
                  ⚠ A registered user cannot be merged into a walk-in. Switch
                  the primary.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={merging}
          >
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={merging || (primaryIsWalkin && !secondaryIsWalkin)}
            className="bg-primary hover:bg-primary/90"
          >
            {merging ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Merge className="w-4 h-4 mr-2" />
            )}
            Merge
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default MergeCustomersDialog;
