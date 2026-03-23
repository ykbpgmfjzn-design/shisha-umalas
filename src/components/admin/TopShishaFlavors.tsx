import { useMemo } from "react";
import { Flame } from "lucide-react";
import type { PurchaseWithProfile } from "@/hooks/useAdmin";

interface TopShishaFlavorsProps {
  purchases: PurchaseWithProfile[];
}

interface FlavorStat {
  name: string;
  count: number;
  revenue: number;
}

function parseItemsFromNotes(notes: string | null): { name: string; qty: number }[] {
  if (!notes) return [];
  const itemsPart = notes.split("\n---\n")[0];
  const results: { name: string; qty: number }[] = [];
  for (const part of itemsPart.split(", ")) {
    const match = part.match(/^(\d+)x\s+(.+)$/);
    if (match) {
      let name = match[2].trim();
      // Strip known suffixes
      name = name.replace(/\s*DOKU Invoice:.*$/i, "").trim();
      // Strip custom price suffix like "@150000"
      name = name.replace(/\s*@[\d,.]+$/, "").trim();
      if (name) {
        results.push({ name, qty: parseInt(match[1], 10) });
      }
    }
  }
  return results;
}

const TopShishaFlavors = ({ purchases }: TopShishaFlavorsProps) => {
  const flavors = useMemo(() => {
    const map = new Map<string, FlavorStat>();

    for (const p of purchases) {
      const items = parseItemsFromNotes(p.notes);
      if (items.length === 0) continue;

      // Distribute revenue proportionally by quantity
      const totalQty = items.reduce((s, i) => s + i.qty, 0);
      const orderAmount = p.amount || 0;

      for (const item of items) {
        const existing = map.get(item.name) || { name: item.name, count: 0, revenue: 0 };
        existing.count += item.qty;
        existing.revenue += totalQty > 0 ? (orderAmount * item.qty) / totalQty : 0;
        map.set(item.name, existing);
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count);
  }, [purchases]);

  const maxCount = flavors[0]?.count || 1;

  if (flavors.length === 0) {
    return (
      <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-golden" />
          <h3 className="font-display text-lg">Top Shisha Flavors</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-6">No order data yet</p>
      </div>
    );
  }

  return (
    <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-golden" />
        <h3 className="font-display text-lg">Top Shisha Flavors</h3>
      </div>

      <div className="space-y-3">
        {flavors.map((f, i) => (
          <div key={f.name} className="flex items-center gap-3">
            <span className="text-xs font-bold text-muted-foreground w-5 text-right">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                  <span>{f.count} sold</span>
                  <span className="text-golden font-medium">
                    {f.revenue > 0 ? `Rp ${Math.round(f.revenue).toLocaleString("id-ID")}` : "–"}
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-golden to-sunset transition-all"
                  style={{ width: `${(f.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopShishaFlavors;
