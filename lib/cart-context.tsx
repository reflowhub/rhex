"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CartItem {
  inventoryId: string;
  make: string;
  model: string;
  storage: string;
  cosmeticGrade: string;
  sellPriceNZD: number;
  image: string | null;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (inventoryId: string) => void;
  clearCart: () => void;
  itemCount: number;
  isInCart: (inventoryId: string) => boolean;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const CartContext = createContext<CartContextType>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  clearCart: () => {},
  itemCount: 0,
  isInCart: () => false,
});

const STORAGE_KEY = "shop-cart";

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setItems(JSON.parse(saved));
    } catch {}
    setLoaded(true);
  }, []);

  // Persist to localStorage on change (skip initial load)
  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, loaded]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      // Each inventory item is a unique physical unit — no duplicates
      if (prev.some((i) => i.inventoryId === item.inventoryId)) return prev;
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((inventoryId: string) => {
    setItems((prev) => prev.filter((i) => i.inventoryId !== inventoryId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const isInCart = useCallback(
    (inventoryId: string) => items.some((i) => i.inventoryId === inventoryId),
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        clearCart,
        itemCount: items.length,
        isInCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
