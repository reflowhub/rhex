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
  category: string;
  cosmeticGrade: string;
  sellPriceAUD: number;
  image: string | null;
}

export interface UpsellCartItem {
  upsellId: string;
  name: string;
  priceAUD: number;
  image: string | null;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (inventoryId: string) => void;
  clearCart: () => void;
  itemCount: number;
  isInCart: (inventoryId: string) => boolean;
  // Upsell items
  upsellItems: UpsellCartItem[];
  addUpsellItem: (item: Omit<UpsellCartItem, "quantity">) => void;
  removeUpsellItem: (upsellId: string) => void;
  updateUpsellQuantity: (upsellId: string, quantity: number) => void;
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
  upsellItems: [],
  addUpsellItem: () => {},
  removeUpsellItem: () => {},
  updateUpsellQuantity: () => {},
});

const STORAGE_KEY = "shop-cart";
const UPSELL_STORAGE_KEY = "shop-cart-upsells";

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [upsellItems, setUpsellItems] = useState<UpsellCartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount (migrate old items without category)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CartItem[];
        setItems(parsed.map((item) => ({ ...item, category: item.category ?? "Phone" })));
      }
    } catch {}
    try {
      const savedUpsells = localStorage.getItem(UPSELL_STORAGE_KEY);
      if (savedUpsells) setUpsellItems(JSON.parse(savedUpsells));
    } catch {}
    setLoaded(true);
  }, []);

  // Persist to localStorage on change (skip initial load)
  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, loaded]);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(UPSELL_STORAGE_KEY, JSON.stringify(upsellItems));
    }
  }, [upsellItems, loaded]);

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
    setUpsellItems([]);
  }, []);

  const isInCart = useCallback(
    (inventoryId: string) => items.some((i) => i.inventoryId === inventoryId),
    [items]
  );

  // Upsell methods
  const addUpsellItem = useCallback(
    (item: Omit<UpsellCartItem, "quantity">) => {
      setUpsellItems((prev) => {
        const existing = prev.find((u) => u.upsellId === item.upsellId);
        if (existing) {
          return prev.map((u) =>
            u.upsellId === item.upsellId
              ? { ...u, quantity: u.quantity + 1 }
              : u
          );
        }
        return [...prev, { ...item, quantity: 1 }];
      });
    },
    []
  );

  const removeUpsellItem = useCallback((upsellId: string) => {
    setUpsellItems((prev) => prev.filter((u) => u.upsellId !== upsellId));
  }, []);

  const updateUpsellQuantity = useCallback(
    (upsellId: string, quantity: number) => {
      if (quantity <= 0) {
        setUpsellItems((prev) => prev.filter((u) => u.upsellId !== upsellId));
      } else {
        setUpsellItems((prev) =>
          prev.map((u) =>
            u.upsellId === upsellId ? { ...u, quantity } : u
          )
        );
      }
    },
    []
  );

  const upsellTotal = upsellItems.reduce((sum, u) => sum + u.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        clearCart,
        itemCount: items.length + upsellTotal,
        isInCart,
        upsellItems,
        addUpsellItem,
        removeUpsellItem,
        updateUpsellQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
