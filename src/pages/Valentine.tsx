import { motion } from "framer-motion";
import { Heart, ShoppingCart, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { useMemo } from "react";
import Cart from "@/components/Cart";
import BottomNavigation from "@/components/BottomNavigation";
import shishaLeft from "@/assets/valentine-shisha-left.png";
import decorRight from "@/assets/valentine-decor-right.png";

const HEART_EMOJIS = ["❤️", "💕", "💗", "🌸", "🩷", "💖", "🌹", "🪻"];

const FloatingHearts = () => {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        emoji: HEART_EMOJIS[i % HEART_EMOJIS.length],
        left: `${Math.random() * 100}%`,
        size: 14 + Math.random() * 16,
        duration: 6 + Math.random() * 8,
        delay: Math.random() * 10,
        swayX: (Math.random() - 0.5) * 60,
      })),
    []
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute select-none"
          style={{ left: p.left, top: -30, fontSize: p.size }}
          animate={{
            y: ["0vh", "105vh"],
            x: [0, p.swayX, 0],
            rotate: [0, 360],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          {p.emoji}
        </motion.span>
      ))}
    </div>
  );
};

const loveEssenceItems = [
  { id: "valentine-love-essence-watermelon", name: "Love Essence — Herbaline Watermelon", shortName: "Herbaline Watermelon", price: 280000, priceDisplay: "280K IDR", itemType: "hookah" as const, isSignature: true },
  { id: "valentine-love-essence-strawberry", name: "Love Essence — Herbaline Strawberry", shortName: "Herbaline Strawberry", price: 280000, priceDisplay: "280K IDR", itemType: "hookah" as const, isSignature: true },
  { id: "valentine-love-essence-mango", name: "Love Essence — Whiteline Mango", shortName: "Whiteline Mango", price: 280000, priceDisplay: "280K IDR", itemType: "hookah" as const, isSignature: true },
  { id: "valentine-love-essence-lychee", name: "Love Essence — Whiteline Lychee", shortName: "Whiteline Lychee", price: 280000, priceDisplay: "280K IDR", itemType: "hookah" as const, isSignature: true },
];

const valentineItems = [
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
    description: "Whiteline Strawberry + Whiteline Vanilla + Whiteline Mint — Strawberry and vanilla deepen the sweetness, swept gently with a kiss of mint — a promise spun under candlelight",
    price: 450000,
    priceDisplay: "450K IDR",
    itemType: "hookah" as const,
    isSignature: true,
  },
  {
    id: "valentine-forever-love",
    name: "Forever Love",
    description: "Blackline Ajman Queen (sweet strawberry) — A passionate, irresistible affair — intense, daring, unforgettable",
    price: 475000,
    priceDisplay: "475K IDR",
    itemType: "hookah" as const,
    isSignature: true,
  },
];

const Valentine = () => {
  const navigate = useNavigate();
  const { addItem } = useCart();

  const handleAddToCart = (item: { id: string; name: string; description?: string; price: number; priceDisplay: string; itemType: "hookah"; isSignature: boolean }) => {
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
    <main className="relative min-h-screen bg-gradient-to-b from-[hsl(350,80%,96%)] via-[hsl(350,60%,94%)] to-background pb-24 overflow-hidden">
      <FloatingHearts />
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3 max-w-lg mx-auto">
          <button onClick={() => navigate("/")} className="text-foreground p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display text-lg text-foreground flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500 fill-red-500" />
            Signature Romance
          </h1>
        </div>
      </div>

      {/* Decorative Hero Section */}
      <div className="relative pt-6 pb-2 max-w-lg mx-auto overflow-hidden">
        {/* Left decoration - shisha */}
        <motion.img
          src={shishaLeft}
          alt=""
          aria-hidden
          className="absolute -left-8 top-0 w-32 h-auto opacity-60 pointer-events-none"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 0.6, x: 0 }}
          transition={{ duration: 0.8 }}
        />
        {/* Right decoration - glasses */}
        <motion.img
          src={decorRight}
          alt=""
          aria-hidden
          className="absolute -right-8 top-4 w-32 h-auto opacity-60 pointer-events-none"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 0.6, x: 0 }}
          transition={{ duration: 0.8 }}
        />

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center relative z-10 px-14"
        >
          <p className="text-muted-foreground text-xs tracking-[0.4em] uppercase mb-1">Shisha Cool</p>
          <h2
            className="font-display text-4xl md:text-5xl bg-gradient-to-r from-red-700 via-red-500 to-red-700 bg-clip-text text-transparent leading-tight"
            style={{ textShadow: "none" }}
          >
            Valentine<br/>Series
          </h2>
          <div className="mt-3 mx-auto w-20 h-px bg-gradient-to-r from-transparent via-golden to-transparent" />
        </motion.div>
      </div>

      {/* Menu Items */}
      <div className="px-4 pt-4 pb-4 max-w-lg mx-auto space-y-4">

        {/* Love Essence Group */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-card/80 backdrop-blur-sm border border-red-200/30 rounded-2xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-red-400 fill-red-400 flex-shrink-0" />
            <h3 className="font-display text-lg text-foreground">Love Essence</h3>
            <span className="text-golden font-semibold text-base ml-auto">280K IDR</span>
          </div>
          <div className="space-y-2">
            {loveEssenceItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 pl-6">
                <span className="text-sm text-muted-foreground">{item.shortName}</span>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleAddToCart(item)}
                  className="flex-shrink-0 bg-red-500 hover:bg-red-600 text-white rounded-lg p-2 shadow transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" />
                </motion.button>
              </div>
            ))}
          </div>
        </motion.div>

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
