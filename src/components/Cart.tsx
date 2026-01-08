import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, X, Plus, Minus, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Cart = () => {
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalPrice, hookahCount, isOpen, setIsOpen } = useCart();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmitOrder = async () => {
    if (!user) {
      toast.error(t("cart.loginRequired"));
      return;
    }

    if (items.length === 0) {
      toast.error(t("cart.emptyCart"));
      return;
    }

    setIsSubmitting(true);

    try {
      const orderNotes = items.map(item => `${item.quantity}x ${item.name}`).join(", ");
      
      const { data, error } = await supabase.from("purchases").insert({
        user_id: user.id,
        hookah_count: hookahCount,
        amount: totalPrice,
        notes: orderNotes,
      }).select().single();

      if (error) throw error;

      // Navigate to confirmation page with order details
      const params = new URLSearchParams({
        id: data.id,
        total: (totalPrice / 1000).toFixed(0),
        items: orderNotes,
        count: hookahCount.toString(),
      });
      
      clearCart();
      setIsOpen(false);
      navigate(`/order-confirmation?${params.toString()}`);
    } catch (error) {
      console.error("Order error:", error);
      toast.error(t("cart.orderError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Cart Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 z-40 bg-golden text-background p-4 rounded-full shadow-lg hover:bg-golden/90 transition-colors"
      >
        <ShoppingCart className="w-6 h-6" />
        {totalItems > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-2 -right-2 bg-sunset text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center"
          >
            {totalItems}
          </motion.span>
        )}
      </motion.button>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border shadow-2xl z-50 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-6 h-6 text-golden" />
                  <h2 className="font-display text-2xl text-foreground">{t("cart.title")}</h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto p-6">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <ShoppingCart className="w-16 h-16 mb-4 opacity-30" />
                    <p className="text-lg">{t("cart.empty")}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {items.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        className="bg-muted/50 rounded-xl p-4 border border-border/50"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className={`font-display text-lg ${item.isSignature ? "text-golden" : "text-foreground"}`}>
                              {item.name}
                            </h3>
                            {item.description && (
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            )}
                            {item.strength && (
                              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                                {item.strength}
                              </span>
                            )}
                            {!item.strength && item.itemType && (
                              <span className="text-xs text-accent uppercase tracking-wider">
                                {item.itemType}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-1.5 hover:bg-destructive/20 rounded-lg transition-colors text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="p-1.5 bg-background hover:bg-muted rounded-lg transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-semibold">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="p-1.5 bg-background hover:bg-muted rounded-lg transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="font-display text-lg text-golden">
                            IDR {(item.price * item.quantity / 1000).toFixed(0)}K
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {items.length > 0 && (
                <div className="border-t border-border p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("cart.total")}</span>
                    <span className="font-display text-2xl text-golden">
                      IDR {(totalPrice / 1000).toFixed(0)}K
                    </span>
                  </div>
                  
                  {!user ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground mb-3">{t("cart.loginToOrder")}</p>
                      <Button
                        onClick={() => window.location.href = "/auth"}
                        className="w-full bg-golden hover:bg-golden/90 text-background"
                      >
                        {t("cart.login")}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={handleSubmitOrder}
                      disabled={isSubmitting}
                      className="w-full bg-golden hover:bg-golden/90 text-background h-14 text-lg font-display"
                    >
                      {isSubmitting ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1 }}
                          className="w-5 h-5 border-2 border-background border-t-transparent rounded-full"
                        />
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-2" />
                          {t("cart.submit")}
                        </>
                      )}
                    </Button>
                  )}

                  <button
                    onClick={clearCart}
                    className="w-full text-muted-foreground hover:text-destructive text-sm transition-colors"
                  >
                    {t("cart.clear")}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Cart;
