import { createContext, useContext, useState, ReactNode } from "react";

export type Language = "en" | "ru" | "id" | "uk" | "fr" | "hi" | "zh";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Hero
    "hero.title": "SHISHA",
    "hero.subtitle": "MENU",
    "hero.tagline": "Experience the Art of Smoke",
    
    // Menu
    "menu.ourSelection": "Our Selection",
    "menu.curatedFlavors": "Curated Flavors",
    "menu.singleFlavor": "Single Flavor",
    "menu.signatureMixes": "Signature Mixes",
    "menu.signature": "Signature",
    
    // Strength levels
    "strength.ultraLight": "Ultra Light",
    "strength.light": "Light",
    "strength.medium": "Medium",
    "strength.boldStrong": "Bold Strong",
    
    // Footer
    "footer.inhale": "Inhale the",
    "footer.moment": "Moment",
    "footer.description": "Each puff tells a story. Let the smoke carry your thoughts as the sunset paints the sky in shades of gold.",
    "footer.tagline": "Premium Shisha Experience",
  },
  ru: {
    "hero.title": "КАЛЬЯН",
    "hero.subtitle": "МЕНЮ",
    "hero.tagline": "Искусство дыма",
    "menu.ourSelection": "Наш выбор",
    "menu.curatedFlavors": "Избранные вкусы",
    "menu.singleFlavor": "Одиночный вкус",
    "menu.signatureMixes": "Фирменные миксы",
    "menu.signature": "Фирменный",
    "strength.ultraLight": "Ультра лёгкий",
    "strength.light": "Лёгкий",
    "strength.medium": "Средний",
    "strength.boldStrong": "Крепкий",
    "footer.inhale": "Вдохни",
    "footer.moment": "Момент",
    "footer.description": "Каждая затяжка рассказывает историю. Пусть дым унесёт твои мысли, пока закат окрашивает небо в золотые оттенки.",
    "footer.tagline": "Премиум кальянный опыт",
  },
  id: {
    "hero.title": "SHISHA",
    "hero.subtitle": "MENU",
    "hero.tagline": "Rasakan Seni Asap",
    "menu.ourSelection": "Pilihan Kami",
    "menu.curatedFlavors": "Rasa Terpilih",
    "menu.singleFlavor": "Rasa Tunggal",
    "menu.signatureMixes": "Campuran Khas",
    "menu.signature": "Khas",
    "strength.ultraLight": "Ultra Ringan",
    "strength.light": "Ringan",
    "strength.medium": "Sedang",
    "strength.boldStrong": "Kuat",
    "footer.inhale": "Hirup",
    "footer.moment": "Momen",
    "footer.description": "Setiap hisapan menceritakan sebuah kisah. Biarkan asap membawa pikiranmu saat matahari terbenam melukis langit dengan warna emas.",
    "footer.tagline": "Pengalaman Shisha Premium",
  },
  uk: {
    "hero.title": "КАЛЬЯН",
    "hero.subtitle": "МЕНЮ",
    "hero.tagline": "Відчуй мистецтво диму",
    "menu.ourSelection": "Наш вибір",
    "menu.curatedFlavors": "Вибрані смаки",
    "menu.singleFlavor": "Одиночний смак",
    "menu.signatureMixes": "Фірмові мікси",
    "menu.signature": "Фірмовий",
    "strength.ultraLight": "Ультра легкий",
    "strength.light": "Легкий",
    "strength.medium": "Середній",
    "strength.boldStrong": "Міцний",
    "footer.inhale": "Вдихни",
    "footer.moment": "Мить",
    "footer.description": "Кожна затяжка розповідає історію. Нехай дим несе твої думки, поки захід сонця малює небо золотими відтінками.",
    "footer.tagline": "Преміум кальянний досвід",
  },
  fr: {
    "hero.title": "CHICHA",
    "hero.subtitle": "MENU",
    "hero.tagline": "L'Art de la Fumée",
    "menu.ourSelection": "Notre Sélection",
    "menu.curatedFlavors": "Saveurs Raffinées",
    "menu.singleFlavor": "Saveur Unique",
    "menu.signatureMixes": "Mélanges Signature",
    "menu.signature": "Signature",
    "strength.ultraLight": "Ultra Léger",
    "strength.light": "Léger",
    "strength.medium": "Moyen",
    "strength.boldStrong": "Corsé",
    "footer.inhale": "Inspirez le",
    "footer.moment": "Moment",
    "footer.description": "Chaque bouffée raconte une histoire. Laissez la fumée emporter vos pensées tandis que le coucher de soleil peint le ciel de nuances dorées.",
    "footer.tagline": "Expérience Chicha Premium",
  },
  hi: {
    "hero.title": "हुक्का",
    "hero.subtitle": "मेन्यू",
    "hero.tagline": "धुएं की कला का अनुभव करें",
    "menu.ourSelection": "हमारा चयन",
    "menu.curatedFlavors": "चुने हुए स्वाद",
    "menu.singleFlavor": "सिंगल फ्लेवर",
    "menu.signatureMixes": "सिग्नेचर मिक्स",
    "menu.signature": "सिग्नेचर",
    "strength.ultraLight": "अल्ट्रा लाइट",
    "strength.light": "लाइट",
    "strength.medium": "मध्यम",
    "strength.boldStrong": "स्ट्रॉन्ग",
    "footer.inhale": "इस पल को",
    "footer.moment": "महसूस करें",
    "footer.description": "हर कश एक कहानी कहता है। धुएं को अपने विचारों को ले जाने दें जब सूर्यास्त आकाश को सुनहरे रंगों में रंग देता है।",
    "footer.tagline": "प्रीमियम हुक्का अनुभव",
  },
  zh: {
    "hero.title": "水烟",
    "hero.subtitle": "菜单",
    "hero.tagline": "体验烟雾艺术",
    "menu.ourSelection": "我们的精选",
    "menu.curatedFlavors": "精选口味",
    "menu.singleFlavor": "单一口味",
    "menu.signatureMixes": "招牌混合",
    "menu.signature": "招牌",
    "strength.ultraLight": "超轻",
    "strength.light": "轻度",
    "strength.medium": "中度",
    "strength.boldStrong": "浓烈",
    "footer.inhale": "感受这",
    "footer.moment": "一刻",
    "footer.description": "每一口都讲述一个故事。让烟雾带走你的思绪，当夕阳将天空染成金色。",
    "footer.tagline": "高端水烟体验",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>("en");

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
