import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PurchaseWithProfile } from "@/hooks/useAdmin";

interface TopCustomersProps {
  purchases: PurchaseWithProfile[];
}

const TopCustomers = ({ purchases }: TopCustomersProps) => {
  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; orders: number; total: number }>();

    for (const p of purchases) {
      if (p.payment_status?.toLowerCase() !== "paid") continue;
      const name = p.profile?.full_name || p.customer_name || "Unknown";
      const key = name.toLowerCase().replace(/^(mr\.?|mrs\.?|miss)\s*/i, "").trim();
      const existing = map.get(key) || { name, orders: 0, total: 0 };
      existing.orders += 1;
      existing.total += Number(p.amount) || 0;
      if (name.length > existing.name.length) existing.name = name;
      map.set(key, existing);
    }

    return Array.from(map.values())
      .sort((a, b) => b.orders - a.orders || b.total - a.total)
      .slice(0, 5);
  }, [purchases]);

  const medals = ["🥇", "🥈", "🥉", "4", "5"];

  return (
    <Card className="bg-card/60 backdrop-blur-xl border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="w-4 h-4 text-golden" />
          Top 5 Customers
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right pr-4">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topCustomers.map((c, i) => (
              <TableRow key={c.name}>
                <TableCell className="pl-4 text-center">{medals[i]}</TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-right">{c.orders}</TableCell>
                <TableCell className="text-right pr-4 text-muted-foreground">
                  IDR {c.total.toLocaleString("id-ID")}
                </TableCell>
              </TableRow>
            ))}
            {topCustomers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  No data yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default TopCustomers;
