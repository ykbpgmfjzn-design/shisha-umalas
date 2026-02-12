import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Wind } from "lucide-react";
import { menuItems } from "@/data/menuItems";
import type { PurchaseWithProfile } from "@/hooks/useAdmin";

interface Props {
  purchases: PurchaseWithProfile[];
}

const STRENGTH_COLORS: Record<string, string> = {
  "Ultra Light": "hsl(var(--smoke))",
  "Light": "hsl(var(--smoke-light))",
  "Medium": "hsl(var(--golden))",
  "Bold Strong": "hsl(var(--sunset))",
  "Extra": "hsl(120 40% 45%)",
};

function parseStrengthFromNotes(notes: string | null, menuLookup: Map<string, string>): { strength: string; qty: number }[] {
  if (!notes) return [];
  const itemsPart = notes.split("\n---\n")[0];
  const results: { strength: string; qty: number }[] = [];
  for (const part of itemsPart.split(", ")) {
    const match = part.match(/^(\d+)x\s+(.+)$/);
    if (match) {
      let name = match[2].trim();
      name = name.replace(/\s*DOKU Invoice:.*$/i, "").trim();
      name = name.replace(/\s*@[\d,.]+$/, "").trim();
      const strength = menuLookup.get(name.toLowerCase());
      if (strength) {
        results.push({ strength, qty: parseInt(match[1], 10) });
      }
    }
  }
  return results;
}

const StrengthDistributionChart = ({ purchases }: Props) => {
  const data = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const item of menuItems) {
      lookup.set(item.name.toLowerCase(), item.strength);
    }

    const map = new Map<string, number>();
    for (const p of purchases) {
      const items = parseStrengthFromNotes(p.notes, lookup);
      for (const item of items) {
        map.set(item.strength, (map.get(item.strength) || 0) + item.qty);
      }
    }

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [purchases]);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0) {
    return (
      <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wind className="w-5 h-5 text-golden" />
          <h3 className="font-display text-lg">Sales by Strength</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-6">No order data yet</p>
      </div>
    );
  }

  return (
    <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Wind className="w-5 h-5 text-golden" />
        <h3 className="font-display text-lg">Sales by Strength</h3>
        <span className="ml-auto text-xs text-muted-foreground">all time</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-40 h-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={STRENGTH_COLORS[entry.name] || "hsl(var(--muted))"}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
                  return (
                    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                      <p className="font-medium">{d.name}</p>
                      <p className="text-muted-foreground">{d.value} sold ({pct}%)</p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 space-y-2">
          {data.map((d) => {
            const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
            return (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: STRENGTH_COLORS[d.name] || "hsl(var(--muted))" }}
                />
                <span className="truncate flex-1">{d.name}</span>
                <span className="text-muted-foreground text-xs tabular-nums">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StrengthDistributionChart;
