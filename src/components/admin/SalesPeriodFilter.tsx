import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type SalesPeriod = "all" | "current" | "previous" | "custom";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface SalesPeriodFilterProps {
  period: SalesPeriod;
  onPeriodChange: (period: SalesPeriod) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

export function getDateRangeForPeriod(period: SalesPeriod, customRange: DateRange): { from: Date | null; to: Date | null } {
  const now = new Date();
  switch (period) {
    case "current":
      return { from: startOfMonth(now), to: now };
    case "previous": {
      const prevStart = startOfMonth(subMonths(now, 1));
      return { from: prevStart, to: startOfMonth(now) };
    }
    case "custom":
      return { from: customRange.from || null, to: customRange.to || now };
    case "all":
    default:
      return { from: null, to: null };
  }
}

const SalesPeriodFilter = ({ period, onPeriodChange, dateRange, onDateRangeChange }: SalesPeriodFilterProps) => {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const pills: { key: SalesPeriod; label: string }[] = [
    { key: "all", label: "All Time" },
    { key: "current", label: format(new Date(), "MMM yyyy") },
    { key: "previous", label: format(startOfMonth(subMonths(new Date(), 1)), "MMM yyyy") },
  ];

  const customLabel = dateRange.from && dateRange.to
    ? `${format(dateRange.from, "dd MMM")} – ${format(dateRange.to, "dd MMM")}`
    : dateRange.from
      ? `From ${format(dateRange.from, "dd MMM")}`
      : "Custom";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {pills.map((p) => (
        <button
          key={p.key}
          onClick={() => onPeriodChange(p.key)}
          className={cn(
            "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
            period === p.key
              ? "bg-primary text-primary-foreground"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          )}
        >
          {p.label}
        </button>
      ))}

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={() => {
              if (period !== "custom") onPeriodChange("custom");
            }}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors inline-flex items-center gap-1",
              period === "custom"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            <CalendarDays className="w-3 h-3" />
            {period === "custom" ? customLabel : "Custom"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={{ from: dateRange.from, to: dateRange.to }}
            onSelect={(range) => {
              onDateRangeChange({ from: range?.from, to: range?.to });
              onPeriodChange("custom");
              if (range?.from && range?.to) {
                setCalendarOpen(false);
              }
            }}
            numberOfMonths={1}
            disabled={(date) => date > new Date()}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default SalesPeriodFilter;
