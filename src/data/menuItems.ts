import type { ItemType } from '@/hooks/useCart';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  priceDisplay: string;
  strength: string;
  isSignature?: boolean;
  itemType: ItemType;
  keywords: string[];
}

export const menuItems: MenuItem[] = [
  // Ultra Light
  { id: 'wl-vanilla', name: 'Whiteline Vanilla', price: 280000, priceDisplay: 'IDR 280K', strength: 'Ultra Light', itemType: 'hookah', keywords: ['vanilla', 'ваниль', 'vanila', 'whiteline vanilla', 'вайтлайн ваниль', 'ванилька', 'ванильный'] },
  { id: 'wl-oolong', name: 'Whiteline Oolong Tea', price: 280000, priceDisplay: 'IDR 280K', strength: 'Ultra Light', itemType: 'hookah', keywords: ['oolong', 'tea', 'чай', 'улун', 'teh', 'whiteline oolong', 'чайный'] },
  { id: 'hl-watermelon', name: 'Herbaline Watermelon', price: 280000, priceDisplay: 'IDR 280K', strength: 'Ultra Light', itemType: 'hookah', keywords: ['watermelon', 'арбуз', 'semangka', 'herbaline watermelon', 'гербалайн арбуз', 'арбузный', 'арбузик'] },
  { id: 'vanilla-breeze', name: 'Vanilla Breeze', price: 320000, priceDisplay: 'IDR 320K', strength: 'Ultra Light', isSignature: true, itemType: 'hookah', keywords: ['vanilla breeze', 'breeze', 'ваниль бриз', 'бриз', 'ванильный бриз'] },
  { id: 'watermelon-wave', name: 'Watermelon Wave', price: 320000, priceDisplay: 'IDR 320K', strength: 'Ultra Light', isSignature: true, itemType: 'hookah', keywords: ['watermelon wave', 'wave', 'арбуз волна', 'волна', 'арбузная волна', 'арбузная', 'арбузный волна'] },
  
  // Light
  { id: 'wl-mint', name: 'Whiteline Mint', price: 295000, priceDisplay: 'IDR 295K', strength: 'Light', itemType: 'hookah', keywords: ['mint', 'мята', 'мятный', 'мента', 'whiteline mint', 'вайтлайн мята'] },
  { id: 'af-two-apple', name: 'Al Fakher Two Apple', price: 295000, priceDisplay: 'IDR 295K', strength: 'Light', itemType: 'hookah', keywords: ['apple', 'two apple', 'double apple', 'яблоко', 'два яблока', 'apel', 'al fakher'] },
  { id: 'minty-grapes', name: 'Minty Grapes', price: 335000, priceDisplay: 'IDR 335K', strength: 'Light', isSignature: true, itemType: 'hookah', keywords: ['minty grapes', 'grape', 'виноград мята', 'anggur'] },
  { id: 'minty-gum', name: 'Minty Gum', price: 335000, priceDisplay: 'IDR 335K', strength: 'Light', isSignature: true, itemType: 'hookah', keywords: ['minty gum', 'gum', 'жвачка мята', 'permen'] },
  
  // Medium
  { id: 'bl-african', name: 'Blackline African Queen', price: 325000, priceDisplay: 'IDR 325K', strength: 'Medium', itemType: 'hookah', keywords: ['african queen', 'african', 'queen', 'tropical', 'африка', 'королева', 'тропик', 'blackline african'] },
  { id: 'bl-spicy-lime', name: 'Blackline Spicey Lime', price: 325000, priceDisplay: 'IDR 325K', strength: 'Medium', itemType: 'hookah', keywords: ['spicey lime', 'spicy lime', 'lime', 'spicy', 'лайм', 'острый', 'jeruk', 'blackline spicy'] },
  { id: 'bl-booster', name: 'Blackline Booster', price: 325000, priceDisplay: 'IDR 325K', strength: 'Medium', itemType: 'hookah', keywords: ['booster', 'energy', 'бустер', 'энергия', 'blackline booster'] },
  { id: 'tipsy-lime', name: 'Tipsy Lime', price: 405000, priceDisplay: 'IDR 405K', strength: 'Medium', isSignature: true, itemType: 'hookah', keywords: ['tipsy lime', 'tipsy', 'лайм коктейль'] },
  { id: 'evening-moscow', name: 'Evening Moscow', price: 405000, priceDisplay: 'IDR 405K', strength: 'Medium', isSignature: true, itemType: 'hookah', keywords: ['evening moscow', 'moscow', 'evening', 'москва', 'вечер'] },
  
  // Bold Strong
  { id: 'tangiers-cooling', name: 'Tangiers Cooling', price: 450000, priceDisplay: 'IDR 450K', strength: 'Bold Strong', itemType: 'hookah', keywords: ['tangiers cooling', 'cooling', 'tangiers', 'холод', 'прохлада', 'dingin'] },
  { id: 'tangiers-schnozz', name: 'Tangiers Schnozzberry', price: 450000, priceDisplay: 'IDR 450K', strength: 'Bold Strong', itemType: 'hookah', keywords: ['schnozzberry', 'tangiers schnozzberry', 'berry', 'ягода', 'beri'] },
  { id: 'darkside-polar', name: 'Darkside Polar Cream', price: 450000, priceDisplay: 'IDR 450K', strength: 'Bold Strong', itemType: 'hookah', keywords: ['polar cream', 'darkside polar', 'cream', 'polar', 'крем', 'полярный', 'krim'] },
  { id: 'berry-kiss', name: 'Berry Kiss', price: 485000, priceDisplay: 'IDR 485K', strength: 'Bold Strong', isSignature: true, itemType: 'hookah', keywords: ['berry kiss', 'kiss', 'ягода поцелуй'] },
  { id: 'wild-heart', name: 'Wild Heart', price: 485000, priceDisplay: 'IDR 485K', strength: 'Bold Strong', isSignature: true, itemType: 'hookah', keywords: ['wild heart', 'wild', 'heart', 'дикий', 'сердце', 'liar'] },
];

export const findMenuItemByKeyword = (text: string): MenuItem | undefined => {
  const lowerText = text.toLowerCase();
  
  // First try to find by exact name match
  const exactMatch = menuItems.find(item => 
    lowerText.includes(item.name.toLowerCase())
  );
  if (exactMatch) return exactMatch;
  
  // Then try by keywords
  return menuItems.find(item => 
    item.keywords.some(kw => {
      const lowerKw = kw.toLowerCase();
      return lowerText.includes(lowerKw) || lowerKw.includes(lowerText);
    })
  );
};

export const findMenuItemsByStrength = (strength: string): MenuItem[] => {
  const lowerStrength = strength.toLowerCase();
  const strengthMap: Record<string, string> = {
    'ultra light': 'Ultra Light',
    'ultralight': 'Ultra Light',
    'ультралегкий': 'Ultra Light',
    'light': 'Light',
    'легкий': 'Light',
    'medium': 'Medium',
    'средний': 'Medium',
    'bold': 'Bold Strong',
    'bold strong': 'Bold Strong',
    'strong': 'Bold Strong',
    'тяжелый': 'Bold Strong',
    'крепкий': 'Bold Strong',
  };
  
  const mappedStrength = strengthMap[lowerStrength] || strength;
  return menuItems.filter(item => item.strength === mappedStrength);
};

export const getStrengthFromKeyword = (keyword: string): string | undefined => {
  const lowerKeyword = keyword.toLowerCase();
  const strengthKeywords: Record<string, string> = {
    'ultra light': 'Ultra Light',
    'ultralight': 'Ultra Light',
    'ультралегкий': 'Ultra Light',
    'ультра легкий': 'Ultra Light',
    'light': 'Light',
    'легкий': 'Light',
    'легко': 'Light',
    'medium': 'Medium',
    'средний': 'Medium',
    'средне': 'Medium',
    'bold': 'Bold Strong',
    'bold strong': 'Bold Strong',
    'strong': 'Bold Strong',
    'тяжелый': 'Bold Strong',
    'крепкий': 'Bold Strong',
    'сильный': 'Bold Strong',
  };
  
  for (const [key, value] of Object.entries(strengthKeywords)) {
    if (lowerKeyword.includes(key)) {
      return value;
    }
  }
  return undefined;
};
