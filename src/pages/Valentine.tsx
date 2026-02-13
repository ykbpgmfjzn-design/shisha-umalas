import { motion } from "framer-motion";
import { Heart, ShoppingCart, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import Cart from "@/components/Cart";
import BottomNavigation from "@/components/BottomNavigation";
import valentineBanner from "@/assets/valentine-banner.png";

const valentineItems = [
  {
    id: "valentine-love-essence",
    name: "Love Essence",
    description: "Herbaline Watermelon + Herbaline Strawberry + Whiteline Mango + Whiteline Lychee",
    price: 280000,
    priceDisplay: "280K IDR",
    itemType: "hookah" as const,
    isSignature: true,
  },
  {
    id: "valentine-fresh-romance",
    name: "Fresh Romance",
    description: "Herbaline Watermelon + Whiteline Mint — The story begins on a warm summer night — juicy watermelon and cool mint spark a fresh, sweet first connection",
    price: 300000,
    priceDisplay: "300K IDR",
    itemType: "hookah" as const,
    isSignature: true,
  },
  {
    id: "valentine-first-love",
    name: "First Love",
    description: "Whiteline Vanilla + Whiteline Lychee — Vanilla and lychee softly unfold, capturing the innocence and butterflies of a love just discovered",
    price: 325000,
    priceDisplay: "325K IDR",
    itemType: "hookah" as const,
    isSignature: true,
  },
  {
    id: "valentine-two-hearts",
    name: "Two Hearts",
    description: "Whiteline Mango + Herbaline Strawberry — Mango and strawberry entwine in harmony, as two souls beat as one in vibrant Valentine embrace",
    price: 335000,
    priceDisplay: "335K IDR",
    itemType: "hookah" as const,
    isSignature: true,
  },
  {
    id: "valentine-pink-promise",
    name: "Pink Promise",
    description: "Whiteline Strawberry + Whiteline Vanilla + Whiteline Mint — Strawberry and vanilla deepen the sweetness, swirled gently with a kiss of mint — a promise whispered under candlelight",
    price: 450000,
    priceDisplay: "450K IDR",
    itemType: "hookah" as const,
    isSignature: true,
  },
  {
    id: "valentine-forbidden-love",
    name: "Forbidden Love",
    description: "Blackline African Queen + Herbaline Strawberry — Bold African Queen meets sweet strawberry in a passionate, irresistible affair — intense, daring, and unforgettable",
    price: 475000,
    priceDisplay: "475K IDR",
    itemType: "hookah" as const,
    isSignature: true,
  },
];

const Valentine = () => {
  const navigate = useNavigate();
  const { addItem } = useCart();

  const handleAddToCart = (item: typeof valentineItems[0]) => {
    addItem({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      priceDisplay: item.priceDisplay,
      itemType: item.itemType,
      isSignature: item.isSignature,
    });
    toast.success(`${item.name} added to cart 💕`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[hsl(350,80%,96%)] via-[hsl(350,60%,94%)] to-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3 max-w-lg mx-auto">
          <button onClick={() => navigate("/")} className="text-foreground p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display text-lg text-foreground flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500 fill-red-500" />
            Valentine Series
          </h1>
        </div>
      </div>

      {/* Banner Image */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="px-4 pt-4 max-w-lg mx-auto"
      >
        <img
          src={valentineBanner}
          alt="Shisha Cool Valentine Series"
          className="w-full rounded-2xl shadow-xl"
        />
      </motion.div>

      {/* Menu Items */}
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
        <h2 className="text-center font-display text-xl text-foreground mb-6">
          Order Your Valentine Hookah
        </h2>

        {valentineItems.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
            className="bg-card/80 backdrop-blur-sm border border-red-200/30 rounded-2xl p-4 shadow-sm"
          >
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Heart className="w-4 h-4 text-red-400 fill-red-400 flex-shrink-0" />
                  <h3 className="font-display text-lg text-foreground">{item.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                  {item.description}
                </p>
                <span className="text-golden font-semibold text-base">{item.priceDisplay}</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => handleAddToCart(item)}
                className="flex-shrink-0 bg-red-500 hover:bg-red-600 text-white rounded-xl p-3 shadow-lg transition-colors"
              >
                <ShoppingCart className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      <Cart />
      <BottomNavigation />
    </main>
  );
};

export default Valentine;
