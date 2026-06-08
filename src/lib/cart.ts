import { useEffect, useState } from "react";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  max: number;
};

const KEY = "banquinha_cart_v1";

type Listener = () => void;
const listeners = new Set<Listener>();
let items: CartItem[] = [];
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) items = JSON.parse(raw);
  } catch {}
  hydrated = true;
}

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

export const cart = {
  add(p: { id: string; name: string; price: number; max: number }) {
    hydrate();
    const existing = items.find((i) => i.id === p.id);
    if (existing) {
      if (existing.qty >= p.max) return false;
      existing.qty += 1;
    } else {
      items = [...items, { id: p.id, name: p.name, price: p.price, qty: 1, max: p.max }];
    }
    emit();
    return true;
  },
  setQty(id: string, qty: number) {
    hydrate();
    items = items
      .map((i) => (i.id === id ? { ...i, qty: Math.max(0, Math.min(qty, i.max)) } : i))
      .filter((i) => i.qty > 0);
    emit();
  },
  remove(id: string) {
    hydrate();
    items = items.filter((i) => i.id !== id);
    emit();
  },
  clear() {
    items = [];
    emit();
  },
  get() {
    hydrate();
    return items;
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useCart() {
  const [snap, setSnap] = useState<CartItem[]>([]);
  useEffect(() => {
    setSnap(cart.get());
    return cart.subscribe(() => setSnap([...cart.get()]));
  }, []);
  return snap;
}