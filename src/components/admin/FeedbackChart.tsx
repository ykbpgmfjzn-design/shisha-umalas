import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";

interface Feedback {
  id: string;
  rating: number;
  created_at: string;
}

interface FeedbackChartProps {
  feedbacks: Feedback[];
}

const FeedbackChart = ({ feedbacks }: FeedbackChartProps) => {
  const chartData = useMemo(() => {
    // Last 7 days
    const days: { date: Date; label: string; count: number; avgRating: number }[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = startOfDay(subDays(new Date(), i));
      const label = format(date, "d MMM", { locale: ru });
      
      const dayFeedbacks = feedbacks.filter((fb) => {
        const fbDate = startOfDay(new Date(fb.created_at));
        return fbDate.getTime() === date.getTime();
      });
      
      const count = dayFeedbacks.length;
      const avgRating = count > 0 
        ? dayFeedbacks.reduce((sum, fb) => sum + fb.rating, 0) / count 
        : 0;
      
      days.push({ date, label, count, avgRating });
    }
    
    return days;
  }, [feedbacks]);

  const maxCount = Math.max(...chartData.map(d => d.count), 1);

  return (
    <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-golden" />
        <h3 className="font-medium text-sm">Отзывы за 7 дней</h3>
      </div>
      
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis 
              dataKey="label" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              domain={[0, maxCount]} 
              hide 
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
                      <p className="text-xs font-medium">{data.label}</p>
                      <p className="text-xs text-muted-foreground">
                        Отзывов: {data.count}
                      </p>
                      {data.avgRating > 0 && (
                        <p className="text-xs text-golden">
                          Ср. оценка: {data.avgRating.toFixed(1)} ★
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.count > 0 ? 'hsl(var(--golden))' : 'hsl(var(--muted))'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default FeedbackChart;
