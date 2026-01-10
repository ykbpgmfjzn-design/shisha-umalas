import { useState, useCallback, useEffect } from "react";

export type ItemType = "hookah" | "drink" | "snack" | "extra";

export interface CartItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  priceDisplay: string;
  quantity: number;
  strength?: string;
  isSignature?: boolean;
  itemType: ItemType;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  hookahCount: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  submitOrderProgrammatically: () => Promise<boolean>;
  setSubmitHandler: (handler: () => Promise<boolean>) => void;
}

// Load cart from localStorage on init
const loadCartFromStorage = (): CartItem[] => {
  try {
    const saved = localStorage.getItem('shisha-cart');
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log('[Cart] Loaded from localStorage:', parsed);
      return Array.isArray(parsed) ? parsed : [];
    }
    return [];
  } catch (e) {
    console.error('[Cart] Error loading from localStorage:', e);
    return [];
  }
};

export const useCartState = (): CartContextType => {
  const [items, setItems] = useState<CartItem[]>(loadCartFromStorage);
  const [isOpen, setIsOpen] = useState(false);
  const [submitHandler, setSubmitHandlerState] = useState<(() => Promise<boolean>) | null>(null);

  const setSubmitHandler = useCallback((handler: () => Promise<boolean>) => {
    setSubmitHandlerState(() => handler);
  }, []);

  const submitOrderProgrammatically = useCallback(async (): Promise<boolean> => {
    if (submitHandler) {
      console.log('[Cart] Submitting order programmatically');
      return await submitHandler();
    }
    console.log('[Cart] No submit handler registered');
    return false;
  }, [submitHandler]);

  // Save cart to localStorage whenever items change
  useEffect(() => {
    console.log('[Cart] Saving to localStorage:', items);
    localStorage.setItem('shisha-cart', JSON.stringify(items));
  }, [items]);

  // Listen for storage changes (from other tabs or page refresh)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'shisha-cart' && e.newValue) {
        try {
          const newItems = JSON.parse(e.newValue);
          console.log('[Cart] Storage event - updating items:', newItems);
          setItems(newItems);
        } catch (err) {
          console.error('[Cart] Error parsing storage event:', err);
        }
      }
    };

    // Also sync on focus (in case localStorage changed while tab was inactive)
    const handleFocus = () => {
      const currentItems = loadCartFromStorage();
      console.log('[Cart] Window focus - checking localStorage:', currentItems);
      setItems(prev => {
        if (JSON.stringify(currentItems) !== JSON.stringify(prev)) {
          return currentItems;
        }
        return prev;
      });
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []); // Empty dependency - only set up listeners once

  const addItem = useCallback((newItem: Omit<CartItem, "quantity">) => {
    console.log('[Cart] Adding item:', newItem.name);
    setItems((prev) => {
      const existingItem = prev.find((item) => item.id === newItem.id);
      let newItems;
      if (existingItem) {
        newItems = prev.map((item) =>
          item.id === newItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        newItems = [...prev, { ...newItem, quantity: 1 }];
      }
      console.log('[Cart] New items state:', newItems);
      // Immediately save to localStorage for persistence
      localStorage.setItem('shisha-cart', JSON.stringify(newItems));
      console.log('[Cart] Saved to localStorage immediately');
      return newItems;
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const newItems = prev.filter((item) => item.id !== id);
      localStorage.setItem('shisha-cart', JSON.stringify(newItems));
      return newItems;
    });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) => {
      let newItems;
      if (quantity <= 0) {
        newItems = prev.filter((item) => item.id !== id);
      } else {
        newItems = prev.map((item) => (item.id === id ? { ...item, quantity } : item));
      }
      localStorage.setItem('shisha-cart', JSON.stringify(newItems));
      return newItems;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.setItem('shisha-cart', JSON.stringify([]));
  }, []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const hookahCount = items
    .filter((item) => item.itemType === "hookah")
    .reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    totalItems,
    totalPrice,
    hookahCount,
    isOpen,
    setIsOpen,
    submitOrderProgrammatically,
    setSubmitHandler,
  };
};
