import { createContext, useContext, ReactNode } from "react";
import { useCartState, CartItem, ItemType } from "@/hooks/useCart";

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, openCart?: boolean) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  hookahCount: number;
  submitOrderProgrammatically: () => Promise<boolean>;
  setSubmitHandler: (handler: () => Promise<boolean>) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const cartState = useCartState();

  return (
    <CartContext.Provider value={cartState}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
