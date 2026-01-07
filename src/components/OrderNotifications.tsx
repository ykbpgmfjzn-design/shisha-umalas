import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, ShoppingBag, Clock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NewOrder {
  id: string;
  user_id: string;
  hookah_count: number;
  amount: number | null;
  notes: string | null;
  created_at: string;
  userEmail?: string;
}

const OrderNotifications = () => {
  const [notifications, setNotifications] = useState<NewOrder[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Subscribe to new purchases
    const channel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'purchases'
        },
        async (payload) => {
          console.log('New order received:', payload);
          
          const newOrder = payload.new as NewOrder;
          
          // Fetch user email
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', newOrder.user_id)
            .single();
          
          const orderWithEmail = {
            ...newOrder,
            userEmail: profile?.email || 'Unknown'
          };
          
          setNotifications(prev => [orderWithEmail, ...prev].slice(0, 10));
          setIsOpen(true);
          
          // Play notification sound
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQUAOYjV8teleQUAN4TV8televQUAM4PV8teleQoALoHV8teJeAsALH/V8tmLeAwAKXzV8teJdg0AJnrV8teHdQ4AInfV8taGcw8AH3TV8tWFcQ8AG3HV8tSDcA8AF27V8tKBbw8AE2vV8tGAbg4AD2jV8M9+bQ4AC2XV8M58bA0AB2LV8Mx6aw0AA1/V8Mt4agwA/1vV8Ml2aAsA+1jV8Mh0ZwoA91XV8MZyZgkA81LV8MVwZQgA7k/V8MNuZAcA6kzV8MFsYwYA5knV8MBqYQUA4kbV8L5oYAQA3kPV8L1mXgMA2kDV8LtlXQIA1T3V8LljWwEA0TrV8LdhWgAA');
          audio.volume = 0.3;
          audio.play().catch(() => {});
          
          toast.success(`Новый заказ: ${newOrder.hookah_count} кальян(ов)`, {
            description: newOrder.notes || 'Без описания',
            duration: 5000,
          });
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const unreadCount = notifications.length;

  return (
    <>
      {/* Notification Bell */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-3 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl hover:bg-golden/10 transition-colors"
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-golden' : 'text-muted-foreground'}`} />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 bg-sunset text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
            >
              {unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Notification Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-golden" />
                  <h3 className="font-display text-lg">Новые заказы</h3>
                </div>
                {notifications.length > 0 && (
                  <button
                    onClick={() => setNotifications([])}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Очистить все
                  </button>
                )}
              </div>

              {/* Notifications List */}
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Bell className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm">Нет новых заказов</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    <AnimatePresence mode="popLayout">
                      {notifications.map((order) => (
                        <motion.div
                          key={order.id}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="relative p-4 bg-muted/50 rounded-xl border border-border/30 group"
                        >
                          <button
                            onClick={() => dismissNotification(order.id)}
                            className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 rounded-lg transition-all"
                          >
                            <X className="w-3 h-3 text-destructive" />
                          </button>

                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-golden/20 rounded-lg flex-shrink-0">
                              <ShoppingBag className="w-4 h-4 text-golden" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">
                                  {order.hookah_count} кальян(ов)
                                </span>
                                {order.amount && (
                                  <span className="text-golden text-sm font-medium">
                                    IDR {(order.amount / 1000).toFixed(0)}K
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                <User className="w-3 h-3" />
                                <span className="truncate">{order.userEmail}</span>
                              </div>
                              
                              {order.notes && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                                  {order.notes}
                                </p>
                              )}
                              
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {formatTime(order.created_at)}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default OrderNotifications;
